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

  // ---- Deals ----  rows: { id text pk, data jsonb, position int, updated_at }
  async function loadDeals() {
    if (!client) return null;
    const { data, error } = await client.from('deals').select('id,data,position').order('position', { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({ ...(r.data || {}), id: r.id }));
  }
  let lastSavedSnapshot = {}; // remembers what we last successfully sent, per deal
  async function saveDeals(deals) {
    if (!client) return;
    const changedRows = [];
    const changedSnapshots = {};
    const currentIds = new Set();

    deals.forEach((d, i) => {
      const id = String(d.id);
      currentIds.add(id);
      const snapshot = JSON.stringify({ data: d, position: i });
      if (lastSavedSnapshot[id] !== snapshot) {
        changedRows.push({ id, data: d, position: i, updated_at: new Date().toISOString() });
        changedSnapshots[id] = snapshot;
      }
    });

    if (changedRows.length) {
      const { error: upErr } = await client.from('deals').upsert(changedRows, { onConflict: 'id' });
      if (upErr) throw upErr; // don't mark as saved if the request failed — will retry next save
      Object.assign(lastSavedSnapshot, changedSnapshots); // only now mark them synced
    }

    Object.keys(lastSavedSnapshot).forEach((id) => {
      if (!currentIds.has(id)) delete lastSavedSnapshot[id];
    });
    // NOTE: No auto-delete here. Deletion from cloud is done explicitly via
    // deleteCloudDeals(ids) so that a race condition or stale state can never
    // silently wipe deals that the user hasn't intentionally removed.
  }

  // Explicitly remove specific deal IDs from cloud. Called only when the user
  // deliberately deletes deal(s) — never triggered by auto-save.
  async function deleteCloudDeals(ids) {
    if (!client || !ids || !ids.length) return;
    const { error } = await client.from('deals').delete().in('id', ids.map(String));
    if (error) throw error;
  }

  // ---- Contacts ----  rows: { id text pk, data jsonb, updated_at }
  async function loadContacts() {
    if (!client) return null;
    const { data, error } = await client.from('contacts').select('id,data').order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({ ...(r.data || {}), id: r.id }));
  }
  async function saveContacts(contacts) {
    if (!client) return;
    if (contacts.length) {
      const rows = contacts.map((c) => ({ id: String(c.id), data: c, updated_at: new Date().toISOString() }));
      const { error } = await client.from('contacts').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      const ids = contacts.map((c) => String(c.id));
      const list = '(' + ids.map((x) => '"' + x.replace(/"/g, '') + '"').join(',') + ')';
      const { error: delErr } = await client.from('contacts').delete().not('id', 'in', list);
      if (delErr) console.warn('[AltusCloud] contacts prune failed:', delErr);
    } else {
      const { error } = await client.from('contacts').delete().neq('id', '');
      if (error) console.warn('[AltusCloud] contacts clear failed:', error);
    }
  }

  // ---- Tasks / Todos ----  rows: { id text pk, data jsonb, updated_at }
  async function loadTodos() {
    if (!client) return null;
    const { data, error } = await client.from('todos').select('id,data').order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({ ...(r.data || {}), id: r.id }));
  }
  async function saveTodos(todos) {
    if (!client) return;
    if (todos.length) {
      const rows = todos.map((t) => ({ id: String(t.id), data: t, updated_at: new Date().toISOString() }));
      const { error } = await client.from('todos').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      const ids = todos.map((t) => String(t.id));
      const list = '(' + ids.map((x) => '"' + x.replace(/"/g, '') + '"').join(',') + ')';
      const { error: delErr } = await client.from('todos').delete().not('id', 'in', list);
      if (delErr) console.warn('[AltusCloud] todos prune failed:', delErr);
    } else {
      const { error } = await client.from('todos').delete().neq('id', '');
      if (error) console.warn('[AltusCloud] todos clear failed:', error);
    }
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

  window.AltusCloud = { enabled, requireLogin, client, getSession, signIn, signOut, onAuthChange, currentEmail, loadDeals, saveDeals, deleteCloudDeals, loadContacts, saveContacts, loadTodos, saveTodos, uploadDoc, signedDocUrl, deleteDoc };
  if (enabled) console.info('[AltusCloud] connected to', cfg.SUPABASE_URL);
})();
