/* ============================ EES — Execution Excellence Scorecard ============================ */
// Acquisitions segment scorecard. Four levels of goal cascade — Firm annual bullseye,
// Segment annual bullseye, 90-day WIG, 90-day ROCKs — every number derived live from the
// pipeline. Targets and the tracked-period list are user-editable and persist locally.

const EES_LS = 'altus.ees.targets.v1';
const EES_LS_PERIODS = 'altus.ees.periods.v1';

const EES_DEFAULTS = {
  firmTarget: 120000000,
  segmentTarget: 120000000,
  pipelineMultiple: 3,
  wigTarget: 30000000,
  rockLoiTarget: 100000000,
  rockAefPct: 0.7,
  rockOwner: 'Garrett',
};

const eesQKey = (y, q) => y + '-Q' + q;
const eesPad = (n) => String(n).padStart(2, '0');
function eesQuarterPeriod(y, q) {
  const end = new Date(y, q * 3, 0);
  return { id: eesQKey(y, q), label: 'Q' + q + ' ' + y,
    start: y + '-' + eesPad((q - 1) * 3 + 1) + '-01',
    end: y + '-' + eesPad(q * 3) + '-' + eesPad(end.getDate()) };
}
function eesDefaultPeriods() {
  const now = new Date();
  const y = now.getFullYear(), q = Math.floor(now.getMonth() / 3) + 1;
  const prevY = q === 1 ? y - 1 : y, prevQ = q === 1 ? 4 : q - 1;
  return [eesQuarterPeriod(prevY, prevQ), eesQuarterPeriod(y, q)];
}
function eesLoad(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback() : v; }
  catch (e) { return fallback(); }
}
const eesSave = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} };

const eesVal = (d) => Number(d.purchasePrice) || Number(d.askPrice) || 0;
const eesDate = (s) => { if (!s) return null; const t = new Date(s + (String(s).length === 10 ? 'T12:00:00' : '')); return isNaN(t) ? null : t; };
const eesIn = (dt, p) => !!dt && dt >= eesDate(p.start) && dt <= eesDate(p.end);
const eesIsAEF = (d) => d.fund === 'AEF';
const eesM = (n) => '$' + (Math.round(n / 100000) / 10).toFixed(1) + 'MM';

function eesCompute(deals, t, p) {
  const stage = (d) => (window.normalizeStage ? window.normalizeStage(d.stage) : d.stage);
  const live = deals.filter((d) => stage(d) !== 'Dead' && stage(d) !== 'LOI Lost');

  const purchased = live.filter((d) => stage(d) === 'Purchased');
  const underContract = live.filter((d) => stage(d) === 'Under Contract');
  const acquired = purchased.reduce((s, d) => s + eesVal(d), 0);
  const contracted = underContract.reduce((s, d) => s + eesVal(d), 0);

  const qualified = live.filter((d) => window.PIPELINE_STAGES.includes(stage(d)));
  const qualifiedVal = qualified.reduce((s, d) => s + (Number(d.askPrice) || Number(d.purchasePrice) || 0), 0);

  const committed = [...purchased, ...underContract];
  const aefDeployed = committed.filter(eesIsAEF).reduce((s, d) => s + eesVal(d), 0);

  const wigDeals = live.filter((d) => eesIsAEF(d) &&
    (stage(d) === 'Under Contract' || stage(d) === 'Purchased') && eesIn(eesDate(d.dateUnderContract), p));
  const loiDeals = deals.filter((d) => eesIn(eesDate(d.dateLOISubmitted), p));
  const loiAmt = (d) => Number(d.loiAmount) || eesVal(d);
  const loiVal = loiDeals.reduce((s, d) => s + loiAmt(d), 0);
  const loiAefVal = loiDeals.filter(eesIsAEF).reduce((s, d) => s + loiAmt(d), 0);

  return {
    acquired, contracted, deployed: acquired + contracted, purchased, underContract,
    qualified, qualifiedVal, coverageTarget: t.segmentTarget * t.pipelineMultiple,
    aefDeployed, oppDeployed: acquired + contracted - aefDeployed,
    wigDeals, wigVal: wigDeals.reduce((s, d) => s + eesVal(d), 0),
    loiDeals, loiAmt, loiVal, loiAefVal, loiAefShare: loiVal > 0 ? loiAefVal / loiVal : 0,
    untagged: committed.filter((d) => !d.fund).length,
  };
}

/* pace: how far through the period we are, so "behind / on track" means something */
function eesPace(p) {
  const s = eesDate(p.start), e = eesDate(p.end), now = new Date();
  if (!s || !e || e <= s) return 1;
  return Math.max(0, Math.min(1, (now - s) / (e - s)));
}
function eesStatus(pct, pace) {
  if (pct >= 1) return { label: 'Hit', color: 'var(--pos)', bg: 'var(--pos-soft)' };
  if (pct >= pace * 0.9) return { label: 'On track', color: 'var(--accent)', bg: 'var(--accent-soft)' };
  if (pct >= pace * 0.6) return { label: 'At risk', color: 'var(--warn)', bg: 'var(--warn-soft)' };
  return { label: 'Behind', color: 'var(--neg)', bg: 'var(--neg-soft)' };
}

/* ── primitives ── */
function EesBar({ pct, color = 'var(--accent)', height = 9, marker }) {
  const v = Math.max(0, Math.min(1, pct || 0));
  return (
    <div style={{ position: 'relative', height, background: 'var(--panel-3)', borderRadius: 999 }}>
      <div style={{ width: (v * 100).toFixed(1) + '%', height: '100%', background: color,
        borderRadius: 999, transition: 'width .35s cubic-bezier(.4,0,.2,1)' }} />
      {marker != null && marker > 0 && marker < 1 &&
        <div title="Where we should be by now" style={{ position: 'absolute', top: -3, bottom: -3,
          left: (marker * 100).toFixed(1) + '%', width: 2, background: 'var(--ink)', opacity: .35, borderRadius: 2 }} />}
    </div>
  );
}

function EesStatusChip({ s }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
      color: s.color, background: s.bg, borderRadius: 5, padding: '3px 8px', flex: 'none' }}>{s.label}</span>
  );
}

function EesGoal({ label, actual, target, fmt, pace, sub, footnote }) {
  const pct = target > 0 ? actual / target : 0;
  const f = fmt || eesM;
  const s = eesStatus(pct, pace == null ? 1 : pace);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)' }}>{label}</span>
          <EesStatusChip s={s} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flex: 'none' }}>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: '-.025em' }}>{f(actual)}</span>
          <span className="num" style={{ fontSize: 12.5, color: 'var(--faint)' }}>/ {f(target)}</span>
          <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', minWidth: 40, textAlign: 'right' }}>
            {target > 0 ? Math.round(pct * 100) + '%' : '—'}
          </span>
        </div>
      </div>
      <EesBar pct={pct} color={s.color} marker={pace} />
      {(sub || footnote) &&
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, fontSize: 11.5, color: 'var(--muted)' }}>
          <span>{sub}</span><span>{footnote}</span>
        </div>}
    </div>
  );
}

/* collapsible list of contributing deals */
function EesDeals({ deals, onOpen, empty, amount, title }) {
  const [open, setOpen] = React.useState(false);
  if (!deals.length) return <div style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic' }}>{empty}</div>;
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} style={{ border: 'none', background: 'none', padding: 0,
        color: 'var(--accent)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
        {open ? '▾' : '▸'} {title} ({deals.length})
      </button>
      {open &&
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)',
          border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          {deals.map((d) => (
            <div key={d.id} onClick={() => onOpen && onOpen(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--panel)', padding: '8px 12px', cursor: onOpen ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--panel)'; }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              {eesIsAEF(d) &&
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--accent)',
                  background: 'var(--accent-soft)', borderRadius: 4, padding: '2px 6px', flex: 'none' }}>AEF</span>}
              <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>{d.market}</span>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flex: 'none' }}>
                {eesM(amount ? amount(d) : eesVal(d))}
              </span>
            </div>
          ))}
        </div>}
    </div>
  );
}

/* level card in the cascade */
function EesLevel({ step, horizon, title, strategy, children, editing, targets }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 26 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--navy)', color: '#fff',
          fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{step}</span>
        <span style={{ flex: 1, width: 2, background: 'var(--line-2)', marginTop: 6, borderRadius: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', marginBottom: 16 }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              color: 'var(--muted)' }}>{horizon}</span>
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.01em', marginTop: 2 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.6, marginTop: 6, textWrap: 'pretty' }}>{strategy}</div>
          {editing && targets &&
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, padding: '10px 12px',
              background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8 }}>{targets}</div>}
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function EesTarget({ label, value, onChange, pct, plain }) {
  const [txt, setTxt] = React.useState(null);
  const raw = pct ? Math.round(value * 100) : plain ? value : Math.round(value / 1000000);
  const shown = txt != null ? txt : raw;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {!pct && !plain && <span style={{ fontSize: 12, color: 'var(--faint)' }}>$</span>}
        <input className="num" value={shown} onChange={(e) => setTxt(e.target.value)}
          onBlur={() => { const n = Number(String(shown).replace(/[^0-9.]/g, '')) || 0;
            onChange(pct ? n / 100 : plain ? n : n * 1000000); setTxt(null); }}
          style={{ width: 62, border: '1px solid var(--line-2)', borderRadius: 6, padding: '5px 8px',
            background: 'var(--panel)', fontSize: 12.5, fontWeight: 700, textAlign: 'right', color: 'var(--ink)' }} />
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>{pct ? '%' : plain ? '' : 'MM'}</span>
      </span>
    </label>
  );
}

/* ── snapshot text for email / clipboard ── */
function eesSnapshotText(t, c, p) {
  const P = (a, b) => b > 0 ? Math.round((a / b) * 100) + '%' : '—';
  const L = [];
  L.push('ALTUS EQUITY — EES SCORECARD');
  L.push('Acquisitions · ' + p.label + ' (' + p.start + ' → ' + p.end + ') · generated ' + new Date().toLocaleDateString());
  L.push('');
  L.push('1 · FIRM BULLSEYE (annual)');
  L.push('  Acquire ' + eesM(t.firmTarget) + ' through the new fund and opportunistic investments.');
  L.push('  Acquired + in contract: ' + eesM(c.deployed) + ' / ' + eesM(t.firmTarget) + '  (' + P(c.deployed, t.firmTarget) + ')');
  L.push('    Closed ' + eesM(c.acquired) + ' (' + c.purchased.length + ') · Under contract ' + eesM(c.contracted) + ' (' + c.underContract.length + ')');
  L.push('');
  L.push('2 · SEGMENT BULLSEYE — ACQUISITIONS (annual)');
  L.push('  Deploy ' + eesM(t.segmentTarget) + ' at or above conviction-case returns, balanced AEF / opportunistic,');
  L.push('  on a qualified pipeline at ' + t.pipelineMultiple + 'x the deployment target.');
  L.push('  Deployed: ' + eesM(c.deployed) + ' / ' + eesM(t.segmentTarget) + '  (' + P(c.deployed, t.segmentTarget) + ')');
  L.push('  Mix: AEF ' + eesM(c.aefDeployed) + ' · Opportunistic ' + eesM(c.oppDeployed));
  L.push('  Qualified pipeline: ' + eesM(c.qualifiedVal) + ' / ' + eesM(c.coverageTarget) + '  (' + P(c.qualifiedVal, c.coverageTarget) + ', ' + c.qualified.length + ' deals)');
  L.push('');
  L.push('3 · WIG — 90 DAYS (' + p.label + ')');
  L.push('  Get at least ' + eesM(t.wigTarget) + ' in contract specifically for the Altus Endurance Fund.');
  L.push('  In contract for AEF: ' + eesM(c.wigVal) + ' / ' + eesM(t.wigTarget) + '  (' + P(c.wigVal, t.wigTarget) + ')');
  c.wigDeals.forEach((d) => L.push('    · ' + d.name + ' — ' + eesM(eesVal(d))));
  if (!c.wigDeals.length) L.push('    · none yet');
  L.push('');
  L.push('4 · ROCKS — 90 DAYS (' + p.label + ')');
  L.push('  ' + t.rockOwner + ' (Strategic): submit at least ' + eesM(t.rockLoiTarget) + ' of LOIs,');
  L.push('    with at least ' + Math.round(t.rockAefPct * 100) + '% for Altus Endurance Fund targets.');
  L.push('  LOIs submitted: ' + eesM(c.loiVal) + ' / ' + eesM(t.rockLoiTarget) + '  (' + P(c.loiVal, t.rockLoiTarget) + ', ' + c.loiDeals.length + ' LOIs)');
  L.push('  AEF share: ' + Math.round(c.loiAefShare * 100) + '% vs ' + Math.round(t.rockAefPct * 100) + '% required (' + eesM(c.loiAefVal) + ')');
  return L.join('\n');
}

/* ── add-period form ── */
function EesAddPeriod({ existing, onAdd, onCancel }) {
  const now = new Date();
  const [mode, setMode] = React.useState('quarter');
  const [year, setYear] = React.useState(now.getFullYear());
  const [q, setQ] = React.useState(Math.floor(now.getMonth() / 3) + 1);
  const [label, setLabel] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const taken = existing.some((p) => p.id === eesQKey(year, q));
  const inp = { border: '1px solid var(--line-2)', borderRadius: 7, padding: '6px 9px',
    background: 'var(--panel)', fontSize: 12.5, color: 'var(--ink)' };
  const submit = () => {
    if (mode === 'quarter') { if (taken) return; onAdd(eesQuarterPeriod(Number(year), Number(q))); }
    else {
      if (!label.trim() || !start || !end) return;
      onAdd({ id: 'c' + Date.now(), label: label.trim(), start, end });
    }
  };
  return (
    <div style={{ marginTop: 12, padding: 14, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['quarter', 'Quarter'], ['custom', 'Custom range']].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            border: mode === k ? '1px solid var(--accent)' : '1px solid var(--line-2)',
            background: mode === k ? 'var(--accent-soft)' : 'var(--panel)',
            color: mode === k ? 'var(--accent)' : 'var(--slate)',
            borderRadius: 999, padding: '5px 12px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {mode === 'quarter' ? <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Quarter</span>
            <select value={q} onChange={(e) => setQ(Number(e.target.value))} style={inp}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Q{n}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Year</span>
            <input className="num" value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, ''))} style={{ ...inp, width: 76 }} />
          </label>
        </> : <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="H1 2026" style={inp} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Start</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inp} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>End</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inp} />
          </label>
        </>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={onCancel} style={{ border: '1px solid var(--line-2)', background: 'var(--panel)',
            color: 'var(--slate)', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={mode === 'quarter' && taken}
            style={{ border: 'none', background: (mode === 'quarter' && taken) ? 'var(--line-2)' : 'var(--accent)',
              color: '#fff', borderRadius: 8, padding: '7px 15px', fontSize: 12.5, fontWeight: 600,
              cursor: (mode === 'quarter' && taken) ? 'not-allowed' : 'pointer' }}>
            {mode === 'quarter' && taken ? 'Already tracked' : 'Add period'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ EES view ============================ */
function EESView({ deals, onOpen, onPatch }) {
  const [t, setT] = React.useState(() => ({ ...EES_DEFAULTS, ...eesLoad(EES_LS, () => ({})) }));
  const [periods, setPeriods] = React.useState(() => {
    const v = eesLoad(EES_LS_PERIODS, eesDefaultPeriods);
    return Array.isArray(v) && v.length ? v : eesDefaultPeriods();
  });
  const [pid, setPid] = React.useState(() => periods[periods.length - 1].id);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [tagging, setTagging] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [mailTo, setMailTo] = React.useState('');
  const [mailBody, setMailBody] = React.useState('');

  const period = periods.find((p) => p.id === pid) || periods[periods.length - 1];
  const setTarget = (k, v) => setT((prev) => { const n = { ...prev, [k]: v }; eesSave(EES_LS, n); return n; });
  const writePeriods = (arr) => { setPeriods(arr); eesSave(EES_LS_PERIODS, arr); };
  const addPeriod = (p) => {
    const arr = [...periods, p].sort((a, b) => (a.start < b.start ? -1 : 1));
    writePeriods(arr); setPid(p.id); setAdding(false);
  };
  const delPeriod = (p) => {
    if (periods.length <= 1) { setToast('Keep at least one tracked period'); setTimeout(() => setToast(''), 2600); return; }
    if (!window.confirm('Stop tracking ' + p.label + '? Deal data is untouched.')) return;
    const arr = periods.filter((x) => x.id !== p.id);
    writePeriods(arr);
    if (pid === p.id) setPid(arr[arr.length - 1].id);
  };

  const c = React.useMemo(() => eesCompute(deals, t, period), [deals, t, period]);
  const pace = eesPace(period);
  const snapshot = () => eesSnapshotText(t, c, period);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };
  const openSend = () => { setMailBody(snapshot()); setSending(true); };
  const mailHref = () => 'mailto:' + encodeURIComponent(mailTo) +
    '?subject=' + encodeURIComponent('Altus EES Scorecard — Acquisitions — ' + period.label) +
    '&body=' + encodeURIComponent(mailBody);
  const copyBody = async () => {
    try { await navigator.clipboard.writeText(mailBody); flash('Scorecard copied to clipboard'); }
    catch (e) {
      const ta = document.getElementById('ees-mail-body');
      if (ta) { ta.focus(); ta.select(); }
      flash('Press ⌘C / Ctrl+C to copy the selected text');
    }
  };
  const copyIt = async () => {
    try { await navigator.clipboard.writeText(snapshot()); flash('Scorecard copied to clipboard'); }
    catch (e) { flash('Copy failed — use Download instead'); }
  };
  const downloadIt = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([snapshot()], { type: 'text/plain' }));
    a.download = 'Altus-EES-' + period.id + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const btn = (label, onClick, primary, active) => (
    <button key={label} onClick={onClick} style={{
      border: primary ? 'none' : active ? '1px solid var(--accent)' : '1px solid var(--line-2)',
      background: primary ? 'var(--accent)' : active ? 'var(--accent-soft)' : 'var(--panel)',
      color: primary ? '#fff' : active ? 'var(--accent)' : 'var(--slate)',
      borderRadius: 8, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );

  const summary = [
    { label: 'Firm bullseye', actual: c.deployed, target: t.firmTarget, note: 'acquired + in contract' },
    { label: 'Segment deployment', actual: c.deployed, target: t.segmentTarget, note: 'against $' + Math.round(t.segmentTarget / 1e6) + 'MM' },
    { label: 'Pipeline coverage', actual: c.qualifiedVal, target: c.coverageTarget, note: t.pipelineMultiple + 'x requirement' },
    { label: 'WIG · in contract', actual: c.wigVal, target: t.wigTarget, note: 'AEF, ' + period.label },
    { label: 'ROCK · LOIs out', actual: c.loiVal, target: t.rockLoiTarget, note: t.rockOwner + ', ' + period.label },
  ];

  return (
    <div style={{ padding: '22px 26px 80px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.01em', fontSize: 25 }}>EES</h2>
          <p style={{ margin: '3px 0 0', fontSize: 16, color: 'var(--slate)' }}>
            Execution Excellence Scorecard · Acquisitions · tracked live off the pipeline
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {btn('Edit targets', () => setEditing((v) => !v), false, editing)}
          {btn('Tag funds', () => setTagging((v) => !v), false, tagging)}
          {btn('Copy', copyIt)}
          {btn('Download', downloadIt)}
          {btn('Email snapshot', openSend, true)}
        </div>
      </div>

      {/* ── period bar ── */}
      <div style={{ marginTop: 18, background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            color: 'var(--muted)', flex: 'none' }}>90-day period</span>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', flex: 1 }}>
            {periods.map((p) => {
              const on = p.id === period.id;
              return (
                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center',
                  border: on ? '1px solid var(--accent)' : '1px solid var(--line-2)',
                  background: on ? 'var(--accent-soft)' : 'var(--panel)', borderRadius: 999, overflow: 'hidden' }}>
                  <button onClick={() => setPid(p.id)} style={{ border: 'none', background: 'none',
                    color: on ? 'var(--accent)' : 'var(--slate)', padding: '6px 6px 6px 13px',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{p.label}</button>
                  <button onClick={() => delPeriod(p)} title={'Remove ' + p.label}
                    style={{ border: 'none', background: 'none', color: 'var(--faint)', padding: '6px 11px 6px 5px',
                      fontSize: 13, lineHeight: 1, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--neg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; }}>×</button>
                </span>
              );
            })}
            <button onClick={() => setAdding((v) => !v)} style={{ border: '1px dashed var(--line-2)',
              background: 'var(--panel)', color: 'var(--accent)', borderRadius: 999, padding: '6px 13px',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Add period</button>
          </div>
          <span className="num" style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>
            {period.start} → {period.end} · {Math.round(pace * 100)}% elapsed
          </span>
        </div>
        {adding && <EesAddPeriod existing={periods} onAdd={addPeriod} onCancel={() => setAdding(false)} />}
      </div>

      {toast &&
        <div style={{ marginTop: 12, padding: '9px 14px', background: 'var(--accent-soft)', color: 'var(--accent)',
          border: '1px solid var(--accent)', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>{toast}</div>}

      {sending &&
        <div onClick={() => setSending(false)} style={{ position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(15,41,66,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', borderRadius: 14,
            boxShadow: 'var(--shadow-lg)', width: 640, maxWidth: '100%', maxHeight: '86vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Send EES snapshot</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Acquisitions · {period.label}</div>
              </div>
              <button onClick={() => setSending(false)} style={{ border: 'none', background: 'none',
                color: 'var(--faint)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>To</span>
                <input value={mailTo} onChange={(e) => setMailTo(e.target.value)}
                  placeholder="team@altusequity.com, garrett@altusequity.com"
                  style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '9px 11px',
                    background: 'var(--panel)', fontSize: 13, color: 'var(--ink)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Message</span>
                <textarea id="ees-mail-body" value={mailBody} onChange={(e) => setMailBody(e.target.value)}
                  style={{ minHeight: 260, resize: 'vertical', border: '1px solid var(--line-2)', borderRadius: 8,
                    padding: '11px 13px', background: 'var(--panel-2)', fontSize: 12,
                    fontFamily: 'var(--mono)', lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre' }} />
              </label>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                "Open in mail app" hands this to your default email client. Some browsers block that from an embedded
                page — if nothing opens, use <b>Copy text</b> and paste into a new message.
              </div>
            </div>
            <div style={{ padding: '13px 20px', borderTop: '1px solid var(--line)', display: 'flex',
              alignItems: 'center', gap: 9, justifyContent: 'flex-end', background: 'var(--panel-2)' }}>
              <button onClick={downloadIt} style={{ border: '1px solid var(--line-2)', background: 'var(--panel)',
                color: 'var(--slate)', borderRadius: 8, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Download</button>
              <button onClick={copyBody} style={{ border: '1px solid var(--line-2)', background: 'var(--panel)',
                color: 'var(--slate)', borderRadius: 8, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Copy text</button>
              <a href={mailHref()} target="_blank" rel="noopener noreferrer"
                style={{ border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 8,
                  padding: '9px 16px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>Open in mail app</a>
            </div>
          </div>
        </div>}

      {/* ── at-a-glance strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, margin: '18px 0 22px' }}>
        {summary.map((s) => {
          const pct = s.target > 0 ? s.actual / s.target : 0;
          const st = eesStatus(pct, pace);
          return (
            <div key={s.label} style={{ background: 'var(--panel)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.03em',
                color: st.color, marginTop: 4 }}>{Math.round(pct * 100)}%</div>
              <div className="num" style={{ fontSize: 11.5, color: 'var(--slate)', marginBottom: 8 }}>
                {eesM(s.actual)} / {eesM(s.target)}
              </div>
              <EesBar pct={pct} color={st.color} height={6} marker={pace} />
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>{s.note}</div>
            </div>
          );
        })}
      </div>

      {c.untagged > 0 &&
        <div style={{ marginBottom: 18, padding: '11px 14px', background: 'var(--warn-soft)', border: '1px solid var(--warn)',
          borderRadius: 8, fontSize: 12.5, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <b>{c.untagged}</b> committed deal{c.untagged === 1 ? '' : 's'} {c.untagged === 1 ? 'is' : 'are'} not tagged
            Altus Endurance Fund or opportunistic — AEF goals will read low until they are.
          </span>
          <button onClick={() => setTagging(true)} style={{ border: '1px solid var(--warn)', background: 'transparent',
            color: 'var(--warn)', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Tag now</button>
        </div>}

      {tagging &&
        <div style={{ marginBottom: 20, background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Fund eligibility</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Mark deals that count toward Altus Endurance Fund targets. Everything else is opportunistic.
              </div>
            </div>
            <button onClick={() => setTagging(false)} style={{ border: '1px solid var(--line-2)', background: 'var(--panel)',
              color: 'var(--slate)', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(255px,1fr))', gap: 8,
            maxHeight: 300, overflow: 'auto', marginTop: 14 }}>
            {deals.filter((d) => d.stage !== 'Dead').map((d) => {
              const on = eesIsAEF(d);
              return (
                <button key={d.id} onClick={() => onPatch && onPatch(d.id, { fund: on ? 'Opportunistic' : 'AEF' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--line-2)',
                    background: on ? 'var(--accent-soft)' : 'var(--panel)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                  <span style={{ width: 13, height: 13, borderRadius: 3, flex: 'none',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--line-2)',
                    background: on ? 'var(--accent)' : 'transparent', color: '#fff',
                    fontSize: 10, lineHeight: '13px', textAlign: 'center' }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: 'var(--ink)', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span className="num" style={{ fontSize: 11, color: 'var(--muted)', flex: 'none' }}>{eesM(eesVal(d))}</span>
                </button>
              );
            })}
          </div>
        </div>}

      {/* ── the cascade ── */}
      <EesLevel step="1" horizon="1-Year Firm Bullseye · Annual" title="Acquisitions"
        editing={editing}
        targets={<EesTarget label="Acquisition target" value={t.firmTarget} onChange={(v) => setTarget('firmTarget', v)} />}
        strategy={<>Acquire <b className="num">{eesM(t.firmTarget)}</b> of assets through the new fund and opportunistic
          investments while maintaining disciplined underwriting and delivering above-market, risk-adjusted returns.</>}>
        <EesGoal label="Acquired + under contract" actual={c.deployed} target={t.firmTarget}
          sub={c.purchased.length + ' closed · ' + c.underContract.length + ' under contract'}
          footnote={eesM(Math.max(0, t.firmTarget - c.deployed)) + ' remaining'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[['Closed', c.acquired, c.purchased.length + ' deals', 'var(--pos)'],
            ['Under contract', c.contracted, c.underContract.length + ' deals', 'var(--accent)'],
            ['Remaining', Math.max(0, t.firmTarget - c.deployed), 'to bullseye', 'var(--slate)']].map(([l, v, s, col]) => (
            <div key={l} style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 13px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>{l}</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: col, letterSpacing: '-.025em', marginTop: 2 }}>{eesM(v)}</div>
              <div style={{ fontSize: 11, color: 'var(--faint)' }}>{s}</div>
            </div>
          ))}
        </div>
      </EesLevel>

      <EesLevel step="2" horizon="1-Year Segment Bullseye · Annual" title="Acquisitions — deployment & coverage"
        editing={editing}
        targets={<>
          <EesTarget label="Deployment target" value={t.segmentTarget} onChange={(v) => setTarget('segmentTarget', v)} />
          <EesTarget label="Pipeline multiple" value={t.pipelineMultiple} plain onChange={(v) => setTarget('pipelineMultiple', v || 1)} />
        </>}
        strategy={<>Deploy <b className="num">{eesM(t.segmentTarget)}</b> into Acquisitions targets at or above conviction-case
          underwritten returns, with a balanced mix of Altus Endurance Fund-eligible and opportunistic deals — supported by a
          continuously qualified pipeline at <b className="num">{t.pipelineMultiple}x</b> the deployment target.</>}>
        <EesGoal label="Deployed into acquisitions targets" actual={c.deployed} target={t.segmentTarget}
          sub={'AEF ' + eesM(c.aefDeployed) + ' · Opportunistic ' + eesM(c.oppDeployed)} />
        <EesGoal label={'Qualified pipeline coverage (' + t.pipelineMultiple + 'x)'} actual={c.qualifiedVal} target={c.coverageTarget}
          sub={c.qualified.length + ' qualified deals · New Deal → Excel UW'}
          footnote={(t.segmentTarget > 0 ? (c.qualifiedVal / t.segmentTarget).toFixed(1) : '0') + 'x deployment target'} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)', marginBottom: 7 }}>Fund mix of committed capital</div>
          <div style={{ display: 'flex', height: 11, borderRadius: 999, overflow: 'hidden', background: 'var(--panel-3)' }}>
            <div style={{ width: (c.deployed > 0 ? (c.aefDeployed / c.deployed) * 100 : 0) + '%', background: 'var(--accent)' }} />
            <div style={{ width: (c.deployed > 0 ? (c.oppDeployed / c.deployed) * 100 : 0) + '%', background: 'var(--navy-3)' }} />
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 7, fontSize: 11.5, color: 'var(--muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--accent)' }} />
              Altus Endurance Fund · {eesM(c.aefDeployed)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--navy-3)' }} />
              Opportunistic · {eesM(c.oppDeployed)}
            </span>
          </div>
        </div>
      </EesLevel>

      <EesLevel step="3" horizon={'WIG · 90 days · ' + period.label} title="Get AEF assets in contract"
        editing={editing}
        targets={<EesTarget label="In-contract target" value={t.wigTarget} onChange={(v) => setTarget('wigTarget', v)} />}
        strategy={<>Identify and get in contract at least <b className="num">{eesM(t.wigTarget)}</b> of opportunities
          specifically for inclusion in the Altus Endurance Fund.</>}>
        <EesGoal label="AEF assets in contract this period" actual={c.wigVal} target={t.wigTarget} pace={pace}
          sub={c.wigDeals.length + ' deal' + (c.wigDeals.length === 1 ? '' : 's') + ' in contract inside ' + period.label}
          footnote={eesM(Math.max(0, t.wigTarget - c.wigVal)) + ' to go'} />
        <EesDeals deals={c.wigDeals} onOpen={onOpen} title="Contributing deals"
          empty={'Nothing AEF-tagged has gone under contract inside ' + period.label + ' yet.'} />
      </EesLevel>

      <EesLevel step="4" horizon={'ROCKs · 90 days · ' + period.label} title={t.rockOwner + ' — Strategic'}
        editing={editing}
        targets={<>
          <EesTarget label="LOI volume target" value={t.rockLoiTarget} onChange={(v) => setTarget('rockLoiTarget', v)} />
          <EesTarget label="Min AEF share" value={t.rockAefPct} pct onChange={(v) => setTarget('rockAefPct', v)} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Owner</span>
            <input value={t.rockOwner} onChange={(e) => setTarget('rockOwner', e.target.value)}
              style={{ width: 110, border: '1px solid var(--line-2)', borderRadius: 6, padding: '5px 8px',
                background: 'var(--panel)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }} />
          </label>
        </>}
        strategy={<>Submit at least <b className="num">{eesM(t.rockLoiTarget)}</b> of LOIs during the quarter, with at
          least <b className="num">{Math.round(t.rockAefPct * 100)}%</b> for Altus Endurance Fund targets.</>}>
        <EesGoal label="LOIs submitted this period" actual={c.loiVal} target={t.rockLoiTarget} pace={pace}
          sub={c.loiDeals.length + ' LOI' + (c.loiDeals.length === 1 ? '' : 's') + ' dated inside ' + period.label}
          footnote={eesM(Math.max(0, t.rockLoiTarget - c.loiVal)) + ' to go'} />
        <EesGoal label="AEF share of LOI volume" actual={c.loiAefShare} target={t.rockAefPct}
          fmt={(v) => Math.round(v * 100) + '%'}
          sub={eesM(c.loiAefVal) + ' of ' + eesM(c.loiVal) + ' tagged AEF'}
          footnote={c.loiAefShare >= t.rockAefPct ? 'requirement met'
            : Math.max(0, Math.round((t.rockAefPct - c.loiAefShare) * 100)) + ' pts short'} />
        <EesDeals deals={c.loiDeals} onOpen={onOpen} amount={c.loiAmt} title="LOIs submitted"
          empty={'No LOIs carry a submission date inside ' + period.label + '.'} />
      </EesLevel>

      <div style={{ marginLeft: 40, background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Sending this out</div>
        <div style={{ fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.65, marginTop: 6, textWrap: 'pretty' }}>
          <b>Email snapshot</b> opens your mail client with the whole scorecard pre-written — address it and send.
          <b> Copy</b> puts the same text on the clipboard for Slack or a weekly recap. <b>Download</b> saves it as a file.
          All three read the live pipeline at the moment you click.
          <br /><br />
          Recurring automatic delivery needs a small server-side job — this app runs entirely in your browser, so it can't
          send mail on a schedule by itself. Say the word and I'll wire a scheduled function that emails this to a list.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EESView });
