// supabase-config.js
// ─────────────────────────────────────────────────────────────────────────────
// One place to configure hosting add-ons. Leave everything blank to run exactly
// like today (data stored locally in the browser, AI parsing via the built-in
// bridge). Fill these in when you're ready to go multi-user / hosted.

// 1) CLOUD DATA + LOGIN (Supabase). Paste your project's values from
//    Supabase dashboard → Project Settings → API. Until both are filled, the app
//    keeps using local browser storage.
window.ALTUS_CONFIG = {
  SUPABASE_URL: 'https://twnvabiabnxfpjgrxgkg.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_FRgHESmXMP9xbt6c1JUHIg_TO2nDUSN',
};

// 2) AI DOCUMENT PARSING. The OM / T-12 / Rent Roll upload buttons call this.
//    The Anthropic key lives ONLY in the Cloudflare Pages Function at
//    functions/api/claude.js (set the ANTHROPIC_API_KEY env var in the Pages
//    dashboard) — never in the browser. This just points the app at that endpoint.
window.ALTUS_AI = {
  complete: async (prompt, maxTokens) => {
    // Abort quickly in environments without the API endpoint (e.g. preview)
    // so the window.claude fallback gets its full 30-second budget.
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    let r;
    try {
      r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(tid);
    }
    if (!r.ok) {
      let msg = 'AI request failed (' + r.status + ')';
      try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    const data = await r.json();
    if (data && data.error) throw new Error(data.error);
    return (data && data.text) || '';
  },
};
