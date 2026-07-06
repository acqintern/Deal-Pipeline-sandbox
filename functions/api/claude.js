// functions/api/claude.js — Cloudflare Pages Function.
// Proxies the browser's parse request to the Anthropic API so the API key stays
// server-side. Route: POST /api/claude  body: { prompt }  ->  { text }
//
// SET THE KEY: Cloudflare dashboard → your Pages project → Settings → Environment
// variables → add  ANTHROPIC_API_KEY = sk-ant-...  (Production + Preview).
// Optionally pin a model with ANTHROPIC_MODEL (e.g. "claude-sonnet-4-6").

// Tried in order until one is accepted by the account. Anthropic retires old model
// snapshots, so we keep a current-first list and degrade gracefully. A pinned
// ANTHROPIC_MODEL (if set) is always tried first.
const MODEL_CANDIDATES = [
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-opus-4-7',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
];

async function callAnthropic(key, model, prompt, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Server is missing ANTHROPIC_API_KEY. Add it in Cloudflare Pages → Settings → Environment variables, then redeploy.' }, 500);
  }

  let prompt = '', maxTokens = 4096;
  try { const body = await request.json(); prompt = body.prompt; maxTokens = Math.min(body.max_tokens || 4096, 16384); } catch (e) { return json({ error: 'Bad request body' }, 400); }
  if (!prompt || typeof prompt !== 'string') return json({ error: 'Missing prompt' }, 400);

  const candidates = [env.ANTHROPIC_MODEL, ...MODEL_CANDIDATES].filter(Boolean);
  let lastErr = 'No model could be reached.';
  try {
    for (const model of candidates) {
      const { resp, data } = await callAnthropic(env.ANTHROPIC_API_KEY, model, prompt, maxTokens);
      if (resp.ok) {
        const text = (data.content && data.content[0] && data.content[0].text) || '';
        return json({ text, model });
      }
      const msg = (data && data.error && data.error.message) || ('Anthropic API error ' + resp.status);
      lastErr = msg;
      // Only advance to the next candidate when the failure is about the MODEL
      // (unknown / not found / not permitted). Auth, rate, credit, and request
      // errors won't be fixed by another model, so surface them immediately.
      const modelProblem = resp.status === 404 || /model/i.test(msg);
      if (!modelProblem) return json({ error: msg }, resp.status);
    }
    return json({ error: 'No available model. Last error: ' + lastErr + ' — set ANTHROPIC_MODEL to a model your account can use.' }, 502);
  } catch (e) {
    return json({ error: 'Proxy error: ' + (e && e.message ? e.message : String(e)) }, 502);
  }
}

// GET /api/claude — health check. Reports whether the key is present so you can
// confirm the function deployed and the env var is wired without exposing the key.
export async function onRequestGet(context) {
  const { env } = context;
  return new Response(JSON.stringify({
    ok: true,
    keyConfigured: !!env.ANTHROPIC_API_KEY,
    pinnedModel: env.ANTHROPIC_MODEL || null,
    hint: 'POST { prompt } to use. keyConfigured must be true.',
  }), { headers: { 'content-type': 'application/json' } });
}
