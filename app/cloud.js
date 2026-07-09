// app/cloud.js — Supabase integration (plain JS, loaded before app.jsx).
// Provides auth + deal sync. Degrades gracefully: if Supabase isn't configured or
// the library/network is unavailable, AltusCloud.enabled is false and the app falls
// back to local browser storage exactly as before.
(function () {
  const cfg = (window.ALTUS_CONFIG || {});
  const hasCfg = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);

  let client = null;
  if (hasCfg) {
    try {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    } catch (e) { console.warn('[AltusCloud] init failed:', e); client = null; }
  }

  const enabled = !!client;
  // Login is required whenever cloud is live (Row-Level Security needs an authenticated
  // session). Set window.ALTUS_CONFIG.REQUIRE_LOGIN = false to disable the gate (the app
  // then runs on local storage only, since RLS blocks anonymous reads/writes).
  const requireLogin = enabled && (cfg.REQUIRE_LOGIN !== false);

  // ---- Auth ----
  async function getSession() {
    if (!client) return null;
    try { const { data } = await client.auth.getSession(); return data.session || null; }
    catch (e) { console.warn('[AltusCloud] getSession failed:', e); return null; }
  }
  async function signIn(email, password) {
    if (!client) throw new Error('Cloud not configured');
    const { data, error } = await client.auth.signInWithPassword({ email: (email || '').trim(), password });
    if (error) throw error;
    return data;
  }
  async function signOut() { if (client) { try { await client.auth.signOut(); } catch (e) {} } }
  function onAuthChange(cb) {
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((_evt, session) => cb(session || null));
    return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
  }
  function currentEmail(session) { return session && session.user ? session.user.email : null; }

  // ---- Persisted sync bookkeeping ----
  // Remembers, per table and per row id, the exact fingerprint we last confirmed both
  // sides agree on. This is the "base" in a 3-way merge (base/ours/theirs) and MUST
  // survive page reloads — an in-memory-only cache resets on every load, which is what
  // let a single bad read blow away the whole pipeline on 2026-07-08 (see reconcileTable).
  const SNAP_KEY = 'altus_cloud_sync_v1';
  function loadSnapshots() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY)) || {}; } catch (e) { return {}; }
  }
  const snapshots = loadSnapshots(); // { deals: {id: fp}, contacts: {id: fp}, todos: {id: fp} }
  function persistSnapshots() {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(snapshots)); } catch (e) {}
  }
  function synced(table) { return snapshots[table] || (snapshots[table] = {}); }
  function commitSynced(table, updates) { Object.assign(synced(table), updates); persistSnapshots(); }
  function forgetSynced(table, ids) {
    const s = synced(table);
    ids.forEach((id) => { delete s[id]; });
    persistSnapshots();
  }

  // Generic 3-way merge: never lets a cloud read silently delete or clobber local data
  // it can't account for. `fp` fingerprints an item the same way on both sides so they're
  // comparable; `fromRow` turns a raw cloud row into the app's item shape.
  function reconcileTable(table, localItems, rows, { keyOf, fp, fromRow }) {
    const base = synced(table);
    const localById = new Map(localItems.map((item, i) => [keyOf(item), { item, i }]));
    const cloudById = new Map(rows.map((row) => [String(row.id), row]));

    // Circuit breaker: if this browser has previously confirmed rows existed and the
    // cloud now looks like it lost most/all of them, refuse to touch anything rather
    // than "helpfully" mass-deleting (or mass-resurrecting) on a bad read. A real,
    // intentional bulk delete goes through deleteCloudXxx, which forgets the affected
    // ids immediately — so it never trips this breaker.
    const knownIds = Object.keys(base);
    if (knownIds.length) {
      const wouldDrop = knownIds.filter((id) => {
        if (cloudById.has(id)) return false;
        const entry = localById.get(id);
        return entry && fp(entry.item, entry.i) === base[id]; // unchanged locally, missing from cloud
      });
      const dropFraction = wouldDrop.length / knownIds.length;
      if (wouldDrop.length >= 5 && dropFraction >= 0.25) {
        return { items: localItems, changed: false, suspicious: true, dropped: wouldDrop.length, total: knownIds.length };
      }
    }

    const result = [];
    const toCommit = {};
    const toForget = [];
    let changed = false;

    localItems.forEach((item, i) => {
      const id = keyOf(item);
      const row = cloudById.get(id);
      const oursFp = fp(item, i);
      if (!row) {
        // Missing from cloud. If we hadn't changed it since we last agreed with cloud,
        // trust that it was deleted elsewhere and drop it too; otherwise it's either a
        // brand-new item that's never synced, or an unsynced local edit — keep it and
        // mark changed so the caller applies this result and the normal debounced save
        // effect pushes it.
        if (base[id] !== undefined && base[id] === oursFp) { toForget.push(id); }
        else result.push(item);
        changed = true;
        return;
      }
      const theirsFp = fp(fromRow(row), row.position);
      if (oursFp === theirsFp) {
        // Already in agreement. Still record the fingerprint as the known-good base if
        // we didn't have one yet — otherwise a browser that starts out already in sync
        // (e.g. cache was cleared but re-populated identically) would have an empty
        // synced snapshot and the circuit breaker below would have nothing to protect.
        if (base[id] === undefined) toCommit[id] = theirsFp;
        result.push(item);
        return;
      }
      if (base[id] === oursFp) {
        // Unchanged locally since last sync — cloud has a newer version, take it.
        result.push(fromRow(row));
        toCommit[id] = theirsFp;
        changed = true;
      } else {
        // Changed locally (or a genuine conflict) — keep our copy. Still counts as
        // "changed" so the caller applies this result and the normal debounced save
        // effect fires and re-pushes it (it no longer matches the committed snapshot).
        result.push(item);
        changed = true;
      }
    });

    // Rows that exist only in cloud (added from elsewhere) get appended.
    rows.forEach((row) => {
      const id = String(row.id);
      if (!localById.has(id)) {
        result.push(fromRow(row));
        toCommit[id] = fp(fromRow(row), row.position);
        changed = true;
      }
    });

    if (Object.keys(toCommit).length) commitSynced(table, toCommit);
    if (toForget.length) forgetSynced(table, toForget);
    return { items: result, changed, suspicious: false };
  }

  // ---- Deals ----  rows: { id text pk, data jsonb, position int, updated_at }
  async function loadDeals() {
    if (!client) return null;
    const { data, error } = await client.from('deals').select('id,data,position').order('position', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  const dealFp = (d, i) => JSON.stringify({ data: d, position: i });
  async function saveDeals(deals) {
    if (!client) return;
    const base = synced('deals');
    const changedRows = [];
    const changedSnapshots = {};
    const currentIds = new Set();

    deals.forEach((d, i) => {
      const id = String(d.id);
      currentIds.add(id);
      const snapshot = dealFp(d, i);
      if (base[id] !== snapshot) {
        changedRows.push({ id, data: d, position: i, updated_at: new Date().toISOString() });
        changedSnapshots[id] = snapshot;
      }
    });

    if (changedRows.length) {
      const { error: upErr } = await client.from('deals').upsert(changedRows, { onConflict: 'id' });
      if (upErr) throw upErr; // don't mark as saved if the request failed — will retry next save
      commitSynced('deals', changedSnapshots); // only now mark them synced
    }

    const stale = Object.keys(base).filter((id) => !currentIds.has(id));
    if (stale.length) forgetSynced('deals', stale); // bookkeeping only — never deletes cloud rows
  }

  // Fetches cloud deals and safely merges them into `localDeals` (see reconcileTable).
  // Returns { items, changed, suspicious }. On `suspicious`, localDeals is returned
  // untouched — the caller should surface a warning instead of applying anything.
  async function reconcileDeals(localDeals) {
    const rows = await loadDeals();
    if (rows === null) return { items: localDeals, changed: false, suspicious: false };
    return reconcileTable('deals', localDeals, rows, {
      keyOf: (d) => String(d.id),
      fp: dealFp,
      fromRow: (row) => ({ ...(row.data || {}), id: row.id }),
    });
  }

  // Explicitly remove specific deal IDs from cloud. Called only when the user
  // deliberately deletes deal(s) — never triggered by auto-save.
  async function deleteCloudDeals(ids) {
    if (!client || !ids || !ids.length) return;
    const strIds = ids.map(String);
    const { error } = await client.from('deals').delete().in('id', strIds);
    if (error) throw error;
    forgetSynced('deals', strIds);
  }

  // ---- Contacts ----  rows: { id text pk, data jsonb, updated_at }
  async function loadContacts() {
    if (!client) return null;
    const { data, error } = await client.from('contacts').select('id,data').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  const itemFp = (item) => JSON.stringify(item);
  async function saveContacts(contacts) {
    if (!client) return;
    const base = synced('contacts');
    const changedRows = [];
    const changedSnapshots = {};
    const currentIds = new Set();
    contacts.forEach((c) => {
      const id = String(c.id);
      currentIds.add(id);
      const snapshot = itemFp(c);
      if (base[id] !== snapshot) {
        changedRows.push({ id, data: c, updated_at: new Date().toISOString() });
        changedSnapshots[id] = snapshot;
      }
    });
    if (changedRows.length) {
      const { error } = await client.from('contacts').upsert(changedRows, { onConflict: 'id' });
      if (error) throw error;
      commitSynced('contacts', changedSnapshots);
    }
    const stale = Object.keys(base).filter((id) => !currentIds.has(id));
    if (stale.length) forgetSynced('contacts', stale);
    // NOTE: No auto-delete here — deletion is explicit via deleteCloudContacts, so an
    // incomplete/stale local array can never silently prune real cloud rows.
  }
  async function reconcileContacts(localContacts) {
    const rows = await loadContacts();
    if (rows === null) return { items: localContacts, changed: false, suspicious: false };
    return reconcileTable('contacts', localContacts, rows, {
      keyOf: (c) => String(c.id),
      fp: itemFp,
      fromRow: (row) => ({ ...(row.data || {}), id: row.id }),
    });
  }
  async function deleteCloudContacts(ids) {
    if (!client || !ids || !ids.length) return;
    const strIds = ids.map(String);
    const { error } = await client.from('contacts').delete().in('id', strIds);
    if (error) throw error;
    forgetSynced('contacts', strIds);
  }

  // ---- Tasks / Todos ----  rows: { id text pk, data jsonb, updated_at }
  async function loadTodos() {
    if (!client) return null;
    const { data, error } = await client.from('todos').select('id,data').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  async function saveTodos(todos) {
    if (!client) return;
    const base = synced('todos');
    const changedRows = [];
    const changedSnapshots = {};
    const currentIds = new Set();
    todos.forEach((t) => {
      const id = String(t.id);
      currentIds.add(id);
      const snapshot = itemFp(t);
      if (base[id] !== snapshot) {
        changedRows.push({ id, data: t, updated_at: new Date().toISOString() });
        changedSnapshots[id] = snapshot;
      }
    });
    if (changedRows.length) {
      const { error } = await client.from('todos').upsert(changedRows, { onConflict: 'id' });
      if (error) throw error;
      commitSynced('todos', changedSnapshots);
    }
    const stale = Object.keys(base).filter((id) => !currentIds.has(id));
    if (stale.length) forgetSynced('todos', stale);
    // NOTE: No auto-delete here — deletion is explicit via deleteCloudTodos, so an
    // incomplete/stale local array can never silently prune real cloud rows.
  }
  async function reconcileTodos(localTodos) {
    const rows = await loadTodos();
    if (rows === null) return { items: localTodos, changed: false, suspicious: false };
    return reconcileTable('todos', localTodos, rows, {
      keyOf: (t) => String(t.id),
      fp: itemFp,
      fromRow: (row) => ({ ...(row.data || {}), id: row.id }),
    });
  }
  async function deleteCloudTodos(ids) {
    if (!client || !ids || !ids.length) return;
    const strIds = ids.map(String);
    const { error } = await client.from('todos').delete().in('id', strIds);
    if (error) throw error;
    forgetSynced('todos', strIds);
  }

  // ---- Document storage (Supabase Storage bucket "deal-docs") ----
  // Files live at deal-docs/<dealId>/<uuid>.<ext>; metadata is kept on the deal's
  // `documents` array (jsonb) so it syncs with the rest of the deal record.
  const DOC_BUCKET = 'deal-docs';
  async function uploadDoc(dealId, file, onProgress) {
    if (!client) throw new Error('Cloud storage is not connected.');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const uid = (crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const path = String(dealId) + '/' + uid + '.' + ext;
    const { error } = await client.storage.from(DOC_BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || undefined,
    });
    if (error) throw error;
    return { path, name: file.name, ext, size: file.size, type: file.type || '', uploadedAt: new Date().toISOString() };
  }
  // Short-lived signed URL for viewing/downloading a private object.
  async function signedDocUrl(path, expiresIn) {
    if (!client) throw new Error('Cloud storage is not connected.');
    const { data, error } = await client.storage.from(DOC_BUCKET).createSignedUrl(path, expiresIn || 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  async function deleteDoc(path) {
    if (!client) return;
    const { error } = await client.storage.from(DOC_BUCKET).remove([path]);
    if (error) console.warn('[AltusCloud] doc delete failed:', error);
  }

  // ---- Realtime ----
  // Subscribes to Postgres changes on `table` and invokes `handler(payload)` for
  // every INSERT/UPDATE/DELETE. Returns an unsubscribe function.
  function subscribeTable(table, handler) {
    if (!client) return () => {};
    const channel = client
      .channel('public:' + table)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => handler(payload))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }

  window.AltusCloud = {
    enabled, requireLogin, client, getSession, signIn, signOut, onAuthChange, currentEmail,
    loadDeals, saveDeals, deleteCloudDeals, reconcileDeals,
    loadContacts, saveContacts, deleteCloudContacts, reconcileContacts,
    loadTodos, saveTodos, deleteCloudTodos, reconcileTodos,
    uploadDoc, signedDocUrl, deleteDoc, subscribeTable,
  };
  if (enabled) console.info('[AltusCloud] connected to', cfg.SUPABASE_URL);
})();
