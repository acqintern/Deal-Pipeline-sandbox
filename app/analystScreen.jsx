// analystScreen.jsx — Analyst Screener tab: going-in cap build, broker vs Altus,
// hurdle verdict, and analyst assessment fields. All numbers live-linked from Full UW.
const { useState: useSA, useEffect: useEA } = React;

const numA = (v, d = 0) => (v == null || v === '' || isNaN(Number(v)) ? d : Number(v));
const moneyA = (v) => v == null || v === '' ? '—' : '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pctA = (v, dec = 2) => v == null || v === '' ? '—' : (v * 100).toFixed(dec) + '%';
const shortA = (v) => {
  if (v == null || v === '') return '—';
  const n = Math.abs(v);
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
};

const HURDLE = 0.065;

/* ── shared primitives ── */
function ASCard({ children, style }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', ...style }}>
      {children}
    </div>
  );
}
function ASCardHead({ title, sub, right }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em',
          textTransform: 'uppercase', color: 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}
function ASLbl({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em',
      textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>
  );
}
function ASTextarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line-2)',
        borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
        background: 'var(--panel-2)', outline: 'none', color: 'var(--ink)',
        fontFamily: 'var(--font)', resize: 'vertical' }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--panel)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.background = 'var(--panel-2)'; }} />
  );
}
function ASInput({ value, onChange, placeholder, prefix, suffix, type = 'text' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0,
      border: '1px solid var(--line-2)', borderRadius: 7, overflow: 'hidden',
      height: 34, width: '100%', background: 'var(--panel)' }}
      onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
      onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.boxShadow = 'none'; }}>
      {prefix && <span style={{ padding: '0 0 0 10px', color: 'var(--faint)', fontSize: 12.5 }}>{prefix}</span>}
      <input value={value ?? ''} type={type} inputMode={type === 'number' ? 'decimal' : undefined}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ border: 'none', outline: 'none', background: 'transparent',
          width: '100%', padding: prefix ? '0 10px 0 4px' : '0 10px',
          fontSize: 13.5, color: 'var(--ink)', height: '100%', fontFamily: 'var(--font)' }} />
      {suffix && <span style={{ padding: '0 10px 0 0', color: 'var(--faint)', fontSize: 12.5 }}>{suffix}</span>}
    </div>
  );
}

/* ── NOI build row ── */
function BuildRow({ label, altus, broker, delta, isNOI, indent, faint, positive }) {
  const rowBg = isNOI ? 'var(--panel-2)' : 'transparent';
  const color = isNOI ? 'var(--ink)' : faint ? 'var(--faint)' : 'var(--slate)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px',
      gap: 0, padding: '8px 20px', borderBottom: '1px solid var(--line)',
      background: rowBg, alignItems: 'center' }}>
      <span style={{ fontSize: isNOI ? 13 : 12.5, fontWeight: isNOI ? 700 : 400,
        color, paddingLeft: indent ? 16 : 0 }}>{label}</span>
      <span className="num" style={{ fontSize: isNOI ? 14 : 13, fontWeight: isNOI ? 700 : 500,
        color: isNOI ? 'var(--accent)' : color, textAlign: 'right' }}>{altus}</span>
      <span className="num" style={{ fontSize: isNOI ? 14 : 13, fontWeight: isNOI ? 600 : 400,
        color: broker === '—' ? 'var(--faint)' : color, textAlign: 'right' }}>{broker}</span>
      <span className="num" style={{ fontSize: 12, textAlign: 'right',
        color: delta === '—' || delta == null ? 'var(--faint)'
          : positive ? 'var(--pos)' : 'var(--neg)' }}>{delta}</span>
    </div>
  );
}

/* ── Operating expense per-unit benchmark (opex_benchmarks.md ranges) ── */
const OPEX_LINES = [
  { key: 'opexGA', label: 'General & Admin', lo: 200, hi: 350 },
  { key: 'opexMaintenance', label: 'Maintenance & Repairs', lo: 600, hi: 900 },
  { key: 'opexPayroll', label: 'Payroll', lo: 1250, hi: 1850, floor: 1250 },
  { key: 'opexMarketing', label: 'Marketing', lo: 100, hi: 350 },
  { key: 'opexContractServices', label: 'Contract Services', lo: 250, hi: 500 },
  { key: 'opexInsurance', label: 'Insurance', lo: 700, hi: 1200 },
  { key: 'opexReserves', label: 'Replacement Reserves', lo: 250, hi: 400 },
  { key: 'opexTaxes', label: 'Property Taxes', lo: null, hi: null },
  { key: 'opexUtilities', label: 'Utilities', lo: null, hi: null },
];

function OpexBenchRow({ line, deal, set, units }) {
  const raw = deal[line.key];
  const perUnit = raw != null && raw !== '' && units > 0 ? Number(raw) / units : null;
  let flag = null;
  if (perUnit != null && line.lo != null) {
    if (perUnit > line.hi) flag = 'high';
    else if (perUnit < (line.floor != null ? line.floor : line.lo)) flag = 'low';
  }
  const flagColor = flag === 'high' ? 'var(--neg)' : flag === 'low' ? 'var(--warn)' : 'var(--faint)';
  const flagLabel = flag === 'high' ? 'Above range — check for inefficiency'
    : flag === 'low' ? (line.floor != null ? 'Below floor — verify, don\'t assume savings' : 'Below range')
    : (perUnit != null ? 'In range' : '—');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 170px 200px',
      padding: '7px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>{line.label}</span>
      <div><ASInput value={raw ?? ''} prefix="$" onChange={(v) => set(line.key, v === '' ? null : Number(v))} placeholder="from T12" /></div>
      <span className="num" style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 600,
        color: perUnit == null ? 'var(--faint)' : 'var(--ink)' }}>
        {perUnit != null ? moneyA(perUnit) + '/u' : '—'}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'right' }}>
        {line.lo != null ? moneyA(line.lo) + '–' + moneyA(line.hi) + '/u' : 'match T12/broker'}
      </span>
      <span style={{ fontSize: 11, textAlign: 'right', fontWeight: 600, color: flagColor }}>{flagLabel}</span>
    </div>
  );
}

function ManagementFeeRow({ deal, set, egi }) {
  const raw = deal.opexManagement;
  const pct = raw != null && raw !== '' && egi > 0 ? Number(raw) / egi * 100 : null;
  const flag = pct == null ? null : pct < 3 ? 'low' : pct > 3.5 ? 'high' : null;
  const flagColor = flag === 'high' ? 'var(--neg)' : flag === 'low' ? 'var(--warn)' : 'var(--faint)';
  const flagLabel = flag === 'high' ? 'Above range — check for inefficiency'
    : flag === 'low' ? 'Below 3% floor — verify, don\'t assume savings'
    : (pct != null ? 'In range' : '—');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 170px 200px',
      padding: '7px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Management Fee</span>
      <div><ASInput value={raw ?? ''} prefix="$" onChange={(v) => set('opexManagement', v === '' ? null : Number(v))} placeholder="from T12" /></div>
      <span className="num" style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 600,
        color: pct == null ? 'var(--faint)' : 'var(--ink)' }}>
        {pct != null ? pct.toFixed(2) + '%' : '—'}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'right' }}>3.0%–3.5% of EGI</span>
      <span style={{ fontSize: 11, textAlign: 'right', fontWeight: 600, color: flagColor }}>{flagLabel}</span>
    </div>
  );
}

/* ── Main tab ── */
function AnalystScreenTab({ deal, set }) {
  const units = numA(deal.units, 1);
  const price = numA(deal.purchasePrice, 0);
  const askPrice = numA(deal.askPrice, 0);
  const capex = numA(deal.capex, 0);
  const basis = price + capex;

  // Pull live from Full UW if populated, else Quick UW
  const hasFullUW = window.hasUWInputs && window.hasUWInputs(deal);
  const uw = hasFullUW && window.computeUW ? window.computeUW(deal) : null;
  const qm = window.computeMetrics ? window.computeMetrics(deal) : {};

  // Altus NOI build
  const gpr = uw ? uw.gpr0 : numA(deal.gprAnnual, 0);
  const econLoss = uw ? uw.econLoss0 : (numA(deal.physVacLoss) + numA(deal.lossToLease) + numA(deal.badDebt) + numA(deal.concessions));
  const otherInc = uw ? uw.otherIncome : numA(deal.otherIncome, 0);
  const egi = uw ? uw.egi0 : (gpr > 0 ? gpr - econLoss + otherInc : numA(deal.trailingEGI, 0));
  const opex = uw ? uw.opexBase : (numA(deal.marketOpexPerUnit, 0) * units || numA(deal.currentOpexTotal, 0));
  const noi = egi - opex;

  // Going-in cap rate: Yr1 YOC from Full UW, else Quick UW
  const yr1 = uw && uw.rows[1] ? uw.rows[1] : null;
  const altusNOI = yr1 ? yr1.noi : noi;
  const altusCap = basis > 0 && altusNOI > 0 ? altusNOI / basis : null;

  // Stabilized yield on cost: Yr3 YOC from Full UW, else Quick UW stabilized cap
  const stabYear = uw ? (uw.stabYear || 3) : 3;
  const yr3row = uw ? (uw.rows[stabYear] || uw.rows[uw.rows.length - 1]) : null;
  const stabYOC = yr3row ? yr3row.yieldOnCost : (qm.stabilizedCap || null);
  const stabBps = altusCap != null && stabYOC != null ? Math.round((stabYOC - altusCap) * 10000) : null;

  // Broker side
  const brokerEGI = numA(deal.brokerEGI, 0);
  const brokerCapRateRaw = numA(deal.brokerCapRate, 0); // stored as percent e.g. 5.5
  const brokerCapRate = brokerCapRateRaw > 0 ? brokerCapRateRaw / 100 : null;
  // Broker NOI: if broker cap rate + ask price → back into NOI, else EGI-based
  const brokerNOI = brokerCapRate && askPrice ? brokerCapRate * askPrice
    : brokerEGI > 0 ? brokerEGI - opex : null; // use Altus opex as floor if broker NOI unknown
  const brokerCapFromNOI = brokerNOI && askPrice ? brokerNOI / askPrice : brokerCapRate;

  // Cap delta
  const capDelta = altusCap != null && brokerCapFromNOI != null ? altusCap - brokerCapFromNOI : null;
  const noiBps = capDelta != null ? Math.round(capDelta * 10000) : null;

  // Hurdle math
  const passesHurdle = altusCap != null && altusCap >= HURDLE;
  const hurdleGap = altusCap != null ? altusCap - HURDLE : null; // negative = miss
  const priceToClose = altusNOI > 0 ? altusNOI / HURDLE : null; // price needed to hit 6.5%
  const priceDelta = priceToClose && price ? price - priceToClose : null; // positive = overpaying

  // Analyst fields
  const analystVintageFit = deal.analystVintageFit || '';
  const analystVerdict = deal.analystVerdict || '';

  const inputSty = { border: '1px solid var(--line-2)', borderRadius: 7, padding: '0 10px',
    background: 'var(--panel)', fontSize: 13, height: 34, width: '100%',
    boxSizing: 'border-box', color: 'var(--ink)', fontFamily: 'var(--font)', outline: 'none',
    cursor: 'pointer' };

  const noUWWarning = !hasFullUW && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      background: 'var(--warn-soft)', border: '1px solid rgba(184,114,20,.2)',
      borderRadius: 8, marginBottom: 18, fontSize: 12.5, color: 'var(--warn)' }}>
      <Icon name="flag" size={13} style={{ flex: 'none' }} />
      Full UW income section not yet filled — cap rate pulls from Quick UW inputs.
      Fill the Income &amp; Economic Vacancy section for a precise build.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {noUWWarning}

      {/* ── Hurdle verdict banner ── */}
      <ASCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr', alignItems: 'center', padding: '20px 28px', gap: 0 }}>
          {/* Going-in cap */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              Altus Going-In Cap{uw ? ' (Yr 1 YOC)' : ''}
            </div>
            <div className="num" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1,
              color: altusCap == null ? 'var(--faint)' : altusCap >= HURDLE ? 'var(--pos)' : 'var(--neg)' }}>
              {altusCap != null ? (altusCap * 100).toFixed(2) + '%' : '—'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
              {uw ? 'Full UW · live' : 'Quick UW · estimate'}
            </div>
          </div>

          {/* vs arrow */}
          <div style={{ padding: '0 24px', color: 'var(--faint)', fontSize: 18 }}>vs</div>

          {/* Hurdle */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Altus Hurdle</div>
            <div className="num" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: 'var(--slate)' }}>6.50%</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>going-in cap minimum</div>
          </div>

          {/* divider */}
          <div style={{ width: 1, height: 64, background: 'var(--line)', margin: '0 24px' }} />

          {/* Stabilized YOC */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              Stabilized YOC{uw ? ' (Yr ' + stabYear + ')' : ''}
            </div>
            <div className="num" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1,
              color: stabYOC == null ? 'var(--faint)' : 'var(--accent)' }}>
              {stabYOC != null ? (stabYOC * 100).toFixed(2) + '%' : '—'}
            </div>
            {stabBps != null && (
              <div className="num" style={{ fontSize: 11.5, marginTop: 6,
                color: stabBps >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {stabBps >= 0 ? '+' : ''}{stabBps} bps vs going-in
              </div>
            )}
            {stabBps == null && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>—</div>}
          </div>

          {/* divider */}
          <div style={{ width: 1, height: 64, background: 'var(--line)', margin: '0 24px' }} />

          {/* Verdict */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Verdict</div>
            {altusCap == null ? (
              <div style={{ fontSize: 14, color: 'var(--faint)', fontStyle: 'italic' }}>Enter pricing + income to compute</div>
            ) : passesHurdle ? (
              <React.Fragment>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px',
                  background: 'var(--pos-soft)', border: '1px solid var(--pos)', borderRadius: 999 }}>
                  <Icon name="check" size={15} style={{ color: 'var(--pos)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--pos)' }}>Clears Hurdle</span>
                </div>
                <div className="num" style={{ fontSize: 11.5, color: 'var(--pos)', marginTop: 6 }}>
                  +{(hurdleGap * 100).toFixed(0)} bps above threshold
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px',
                  background: 'var(--neg-soft)', border: '1px solid var(--neg)', borderRadius: 999 }}>
                  <Icon name="close" size={15} style={{ color: 'var(--neg)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--neg)' }}>Misses Hurdle</span>
                </div>
                <div className="num" style={{ fontSize: 11.5, color: 'var(--neg)', marginTop: 6 }}>
                  {Math.abs(hurdleGap * 100).toFixed(0)} bps short
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      </ASCard>

      {/* ── Two-column body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>

        {/* LEFT: NOI build + bridge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* NOI build table */}
          <ASCard>
            <ASCardHead title="Going-In Cap Build"
              sub="Altus NOI vs. broker numbers — live from Full UW"
              right={
                <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                  {uw ? '↑ linked to Full UW' : '↑ linked to Quick UW'}
                </div>
              } />

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px',
              padding: '8px 20px', borderBottom: '2px solid var(--line)', gap: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Line Item</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', textAlign: 'right' }}>Altus</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Broker</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Delta</span>
            </div>

            <BuildRow label="Gross Potential Rent"
              altus={gpr > 0 ? moneyA(gpr) : '—'}
              broker={brokerEGI > 0 ? '(pro forma)' : '—'}
              delta="—" faint />
            {(uw || econLoss > 0) &&
              <BuildRow label="Economic Loss" indent
                altus={econLoss > 0 ? '(' + moneyA(econLoss) + ')' : '—'}
                broker="—" delta="—" faint />}
            {otherInc > 0 &&
              <BuildRow label="Other Income" indent
                altus={moneyA(otherInc)} broker="—" delta="—" faint />}
            <BuildRow label="Effective Gross Income"
              altus={egi > 0 ? moneyA(egi) : '—'}
              broker={brokerEGI > 0 ? moneyA(brokerEGI) : '—'}
              delta={egi > 0 && brokerEGI > 0 ? moneyA(egi - brokerEGI) : '—'}
              positive={egi >= brokerEGI} />
            <BuildRow label="Operating Expenses"
              altus={opex > 0 ? '(' + moneyA(opex) + ')' : '—'}
              broker={opex > 0 ? '(' + moneyA(opex) + ')' : '—'}
              delta={opex > 0 ? moneyA(0) : '—'} positive />
            {units > 1 && opex > 0 &&
              <BuildRow label={'OpEx/unit · ' + units + ' units'} indent faint
                altus={moneyA(opex / units) + '/u'}
                broker={moneyA(opex / units) + '/u'} delta="—" />}
            <BuildRow label="Net Operating Income" isNOI
              altus={altusNOI > 0 ? moneyA(altusNOI) : '—'}
              broker={brokerNOI ? moneyA(brokerNOI) : '—'}
              delta={altusNOI > 0 && brokerNOI ? moneyA(altusNOI - brokerNOI) : '—'}
              positive={altusNOI >= (brokerNOI || 0)} />

            {/* Cap rate row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px',
              padding: '12px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center',
              background: 'var(--panel-3)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Going-In Cap Rate</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800, textAlign: 'right',
                color: altusCap == null ? 'var(--faint)' : altusCap >= HURDLE ? 'var(--pos)' : 'var(--neg)' }}>
                {altusCap != null ? (altusCap * 100).toFixed(2) + '%' : '—'}
              </span>
              <span className="num" style={{ fontSize: 14, fontWeight: 600, textAlign: 'right',
                color: brokerCapFromNOI ? 'var(--slate)' : 'var(--faint)' }}>
                {brokerCapFromNOI ? (brokerCapFromNOI * 100).toFixed(2) + '%' : '—'}
              </span>
              <span className="num" style={{ fontSize: 12, textAlign: 'right',
                color: noiBps == null ? 'var(--faint)' : noiBps >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {noiBps != null ? (noiBps >= 0 ? '+' : '') + noiBps + ' bps' : '—'}
              </span>
            </div>

            {/* Basis row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px',
              padding: '10px 20px', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>÷ Total Basis (price + capex)</span>
              <span className="num" style={{ fontSize: 13, textAlign: 'right', color: 'var(--slate)', fontWeight: 600 }}>
                {basis > 0 ? shortA(basis) : '—'}
              </span>
              <span className="num" style={{ fontSize: 13, textAlign: 'right', color: askPrice > 0 ? 'var(--slate)' : 'var(--faint)', fontWeight: 400 }}>
                {askPrice > 0 ? shortA(askPrice) + ' ask' : '—'}
              </span>
              <span />
            </div>

            {/* Broker cap rate input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--panel-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', flex: 'none' }}>Broker's advertised cap rate</div>
                <div style={{ width: 120 }}>
                  <ASInput value={deal.brokerCapRate ?? ''} suffix="%"
                    onChange={(v) => set('brokerCapRate', v === '' ? null : Number(v))}
                    placeholder="e.g. 5.25" />
                </div>
                {brokerCapFromNOI && altusCap && (
                  <div className="num" style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                    {Math.abs(noiBps)} bps {noiBps >= 0 ? 'above' : 'below'} broker
                  </div>
                )}
              </div>
            </div>
          </ASCard>

          {/* Bridge analysis */}
          <ASCard>
            <ASCardHead title="Bridge to 6.50% Hurdle"
              sub="What it takes to clear — negotiate with these numbers" />
            <div style={{ padding: '18px 20px' }}>
              {altusNOI <= 0 || price <= 0 ? (
                <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>
                  Enter purchase price and income to compute the bridge.
                </div>
              ) : passesHurdle ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', background: 'var(--pos-soft)',
                    border: '1px solid var(--pos)', borderRadius: 8 }}>
                    <Icon name="check" size={14} style={{ color: 'var(--pos)', flex: 'none' }} />
                    <span style={{ fontSize: 13, color: 'var(--pos)', fontWeight: 500 }}>
                      Deal clears at current price. No bridge needed.
                    </span>
                  </div>
                  <BridgeRow label="NOI at current price" value={moneyA(altusNOI)} accent="var(--accent)" />
                  <BridgeRow label="Cap rate" value={(altusCap * 100).toFixed(2) + '%'} accent="var(--pos)" />
                  <BridgeRow label="Headroom above 6.5%" value={'+' + (hurdleGap * 100).toFixed(0) + ' bps'} accent="var(--pos)" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', background: 'var(--warn-soft)',
                    border: '1px solid rgba(184,114,20,.25)', borderRadius: 8 }}>
                    <Icon name="flag" size={14} style={{ color: 'var(--warn)', flex: 'none' }} />
                    <div style={{ fontSize: 13, color: 'var(--warn)' }}>
                      Deal misses by <span className="num" style={{ fontWeight: 700 }}>{Math.abs(hurdleGap * 100).toFixed(0)} bps</span>.
                      Use the numbers below to negotiate or reprice.
                    </div>
                  </div>
                  <BridgeRow label="Altus NOI" value={moneyA(altusNOI)} accent="var(--accent)" />
                  <BridgeRow label="Price to clear 6.5%"
                    value={shortA(priceToClose)}
                    sub={'= NOI ÷ 6.5%'}
                    accent="var(--ink)" />
                  <BridgeRow label="Current UW Price"
                    value={shortA(price)}
                    accent="var(--slate)" />
                  <BridgeRow label="Required price cut"
                    value={(priceDelta >= 0 ? '−' : '+') + shortA(Math.abs(priceDelta))}
                    sub={price > 0 ? ((priceDelta / price) * 100).toFixed(1) + '% reduction from UW price' : ''}
                    accent={priceDelta >= 0 ? 'var(--neg)' : 'var(--pos)'} />
                  {units > 0 && priceDelta > 0 && (
                    <BridgeRow label="Required cut per unit"
                      value={'−' + moneyA(priceDelta / units) + '/unit'}
                      accent="var(--neg)" />
                  )}
                </div>
              )}
            </div>
          </ASCard>

          {/* Operating expense per-unit benchmark — analysis only, does not feed the NOI build above */}
          <ASCard>
            <ASCardHead title="Operating Expense Benchmark (Per Unit)"
              sub="Enter each T12 line item — flags anything outside Altus's benchmark range for operational efficiency review" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 170px 200px',
              padding: '8px 20px', borderBottom: '2px solid var(--line)', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Line Item</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>T12 Actual ($/yr)</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>$/Unit</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Altus Benchmark</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Flag</span>
            </div>
            {OPEX_LINES.map((line) => <OpexBenchRow key={line.key} line={line} deal={deal} set={set} units={units} />)}
            <ManagementFeeRow deal={deal} set={set} egi={egi} />
          </ASCard>
        </div>

        {/* RIGHT: Analyst assessment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Broker story */}
          <ASCard>
            <ASCardHead title="Broker's Story" sub="What they're selling — and whether it holds" />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <ASLbl>Broker's Business Plan</ASLbl>
                <ASTextarea value={deal.analystBrokerStory} rows={4}
                  placeholder="Summarize what the broker is marketing: value-add scope, rent premium, renovation pace, exit assumption, any stated upside drivers…"
                  onChange={(v) => set('analystBrokerStory', v)} />
              </div>
              <div>
                <ASLbl>Vintage / Capex Fit</ASLbl>
                <select value={analystVintageFit}
                  onChange={(e) => set('analystVintageFit', e.target.value)}
                  style={inputSty}>
                  <option value="">— select —</option>
                  <option value="good">Good fit — scope matches vintage and condition</option>
                  <option value="marginal">Marginal — plan works but execution risk is real</option>
                  <option value="poor">Poor fit — scope / vintage mismatch, credibility issue</option>
                </select>
                {analystVintageFit === 'poor' && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--neg)' }}>
                    Flag this in the IC memo. Credibility of the renovation plan is a primary risk.
                  </div>
                )}
              </div>
              <div>
                <ASLbl>Altus Read on the Story</ASLbl>
                <ASTextarea value={deal.analystStoryRead} rows={4}
                  placeholder="Is the plan credible for this vintage? What evidence supports or undermines it? What would have to be true for it to work?"
                  onChange={(v) => set('analystStoryRead', v)} />
              </div>
            </div>
          </ASCard>

          {/* Value-add assumption */}
          <ASCard>
            <ASCardHead title="Altus Value-Add View"
              sub="Analyst's own assumption — feeds the full underwrite" />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div>
                  <ASLbl>Achievable Rent Premium</ASLbl>
                  <ASInput value={deal.analystRentPremium ?? ''}
                    onChange={(v) => set('analystRentPremium', v === '' ? null : Number(v))}
                    prefix="$" suffix="/unit/mo"
                    placeholder="e.g. 150" />
                  {deal.analystRentPremium && (
                    <div className="num" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      {moneyA(numA(deal.analystRentPremium) * 12 * units)}/yr portfolio-wide
                    </div>
                  )}
                </div>
                <div>
                  <ASLbl>Renovation Pace</ASLbl>
                  <ASInput value={deal.analystPace ?? ''}
                    onChange={(v) => set('analystPace', v === '' ? null : Number(v))}
                    suffix="turns/yr"
                    placeholder="e.g. 30" />
                </div>
                <div>
                  <ASLbl>Broker's Stated Premium</ASLbl>
                  <ASInput value={deal.brokerRentPremium ?? ''}
                    onChange={(v) => set('brokerRentPremium', v === '' ? null : Number(v))}
                    prefix="$" suffix="/unit/mo"
                    placeholder="from OM" />
                </div>
                <div>
                  <ASLbl>Broker's Stated Pace</ASLbl>
                  <ASInput value={deal.brokerRenovPace ?? ''}
                    onChange={(v) => set('brokerRenovPace', v === '' ? null : Number(v))}
                    suffix="turns/yr"
                    placeholder="from OM" />
                </div>
              </div>

              {/* Premium delta */}
              {deal.analystRentPremium && deal.brokerRentPremium && (() => {
                const diff = numA(deal.analystRentPremium) - numA(deal.brokerRentPremium);
                return (
                  <div style={{ padding: '10px 14px', borderRadius: 8,
                    background: diff < 0 ? 'var(--neg-soft)' : diff > 0 ? 'var(--pos-soft)' : 'var(--panel-2)',
                    border: '1px solid ' + (diff < 0 ? 'rgba(201,60,64,.2)' : diff > 0 ? 'rgba(12,122,67,.2)' : 'var(--line)') }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600,
                      color: diff < 0 ? 'var(--neg)' : diff > 0 ? 'var(--pos)' : 'var(--slate)' }}>
                      Altus {diff === 0 ? 'agrees with broker' : (diff < 0 ? '−' : '+') + moneyA(Math.abs(diff)) + '/unit/mo vs. broker'}
                    </span>
                    {diff !== 0 && units > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 10 }}>
                        {moneyA(Math.abs(diff) * 12 * units)}/yr difference at full lease-up
                      </span>
                    )}
                  </div>
                );
              })()}

              <div>
                <ASLbl>Value-Add Rationale</ASLbl>
                <ASTextarea value={deal.analystVARationale} rows={3}
                  placeholder="Why is Altus's premium/pace different from broker's? Comparable programs, market evidence, condition notes…"
                  onChange={(v) => set('analystVARationale', v)} />
              </div>
            </div>
          </ASCard>

          {/* Verdict */}
          <ASCard>
            <ASCardHead title="Screen Verdict" sub="Analyst recommendation after the screen" />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <ASLbl>Recommendation</ASLbl>
                <select value={analystVerdict}
                  onChange={(e) => set('analystVerdict', e.target.value)}
                  style={{ ...inputSty,
                    color: analystVerdict === 'proceed' ? 'var(--pos)'
                      : analystVerdict === 'pass' ? 'var(--neg)'
                      : analystVerdict === 'price' ? 'var(--warn)'
                      : 'var(--ink)',
                    fontWeight: analystVerdict ? 600 : 400 }}>
                  <option value="">— select recommendation —</option>
                  <option value="proceed">Proceed to Full Underwrite</option>
                  <option value="price">Proceed — Needs Price Cut First</option>
                  <option value="watch">Watch — Re-screen at Lower Basis</option>
                  <option value="pass">Pass</option>
                </select>
              </div>
              <div>
                <ASLbl>Rationale / Next Steps</ASLbl>
                <ASTextarea value={deal.analystVerdictNotes} rows={4}
                  placeholder="State the call plainly: what the gap is, whether a lower offer makes it work, what the analyst should do next. An MD reading this should be able to act on it immediately."
                  onChange={(v) => set('analystVerdictNotes', v)} />
              </div>

              {/* Verdict badge */}
              {analystVerdict && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                  borderRadius: 8,
                  background: analystVerdict === 'proceed' ? 'var(--pos-soft)'
                    : analystVerdict === 'pass' ? 'var(--neg-soft)'
                    : 'var(--warn-soft)',
                  border: '1px solid ' + (analystVerdict === 'proceed' ? 'var(--pos)' : analystVerdict === 'pass' ? 'var(--neg)' : 'rgba(184,114,20,.3)') }}>
                  <Icon name={analystVerdict === 'proceed' ? 'check' : analystVerdict === 'pass' ? 'close' : 'flag'} size={14}
                    style={{ color: analystVerdict === 'proceed' ? 'var(--pos)' : analystVerdict === 'pass' ? 'var(--neg)' : 'var(--warn)', flex: 'none' }} />
                  <span style={{ fontSize: 13, fontWeight: 600,
                    color: analystVerdict === 'proceed' ? 'var(--pos)' : analystVerdict === 'pass' ? 'var(--neg)' : 'var(--warn)' }}>
                    {{proceed: 'Proceed to Full Underwrite', price: 'Proceed — Needs Price Cut', watch: 'Watch — Re-screen Later', pass: 'Pass'}[analystVerdict]}
                  </span>
                </div>
              )}
            </div>
          </ASCard>
        </div>
      </div>
    </div>
  );
}

function BridgeRow({ label, value, sub, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
      padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <div>
        <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 8 }}>{sub}</span>}
      </div>
      <span className="num" style={{ fontSize: 14, fontWeight: 700, color: accent || 'var(--ink)', flex: 'none' }}>{value}</span>
    </div>
  );
}

// inputSty needs to be accessible inside the component; move it out
const inputSty = { border: '1px solid var(--line-2)', borderRadius: 7, padding: '0 10px',
  background: 'var(--panel)', fontSize: 13, height: 34, width: '100%',
  boxSizing: 'border-box', color: 'var(--ink)', fontFamily: 'var(--font)', outline: 'none',
  cursor: 'pointer' };

window.AnalystScreenTab = AnalystScreenTab;
