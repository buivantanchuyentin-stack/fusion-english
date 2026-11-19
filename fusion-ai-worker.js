// Fusion English - máy chủ AI nhỏ chạy trên Cloudflare Workers (dùng Workers AI, không cần khóa API)
// Dán toàn bộ tệp này vào Worker, thêm "Binding" Workers AI tên là AI rồi bấm Deploy.

// Thử lần lượt các mô hình; mô hình nào bị ngừng hoặc lỗi thì tự chuyển sang mô hình kế tiếp.
const MODELS = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.2-3b-instruct',
];

// Chỉ cho các trang này gọi vào (đổi nếu bạn dùng địa chỉ khác).
const ORIGINS = [
  'https://buivantanchuyentin-stack.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'null', // mở tệp .html trực tiếp trên máy
];

const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const ok = ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': ok ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method === 'GET') return new Response('Fusion English AI dang chay.', { headers: cors });
    if (req.method !== 'POST' || !ok) return json({ error: 'forbidden' }, 403, cors);

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400, cors); }

    const role = clean(body.role, 120) || 'a friendly native English speaker';
    const scenario = clean(body.scenario, 200) || 'a casual chat';
    const level = clean(body.level, 30) || 'basic';
    const msgs = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-16)
      .map(m => ({ role: m.role, content: clean(m.content, 500) }));

    const system =
      `You are ${role}. You are having a live spoken English conversation with a Vietnamese learner (level: ${level}). Scenario: ${scenario}.\n` +
      `Behave like a real, warm person, not a robot: react naturally to what they said (e.g. "Oh nice!", "Really?"), share a tiny detail about yourself sometimes, then ask ONE follow-up question. Reply in 1-2 short spoken sentences (max 25 words), simple vocabulary matching their level. No emojis, no markdown, never break character.\n` +
      `IMPORTANT: the learner's text comes from speech recognition, so there is no punctuation or capitalisation; ignore that. If a word looks odd or out of place but sounds similar to a word that fits the context, the learner probably mispronounced it. If the message is very short or unfinished, respond gently and invite them to continue.\n` +
      `Output EXACTLY four lines and nothing else:\n` +
      `EN: <your reply in English>\n` +
      `VI: <Vietnamese translation of your reply>\n` +
      `FIX: <if the learner's LAST message has a real grammar or word-choice mistake, write the corrected full sentence, then " - " and a short explanation in Vietnamese; otherwise write OK>\n` +
      `PRON: <in Vietnamese, name at most 3 words from the learner's last message that were likely mispronounced (because recognition produced a wrong or odd word), with the intended word and its IPA and one short tip; otherwise write OK>\n` +
      `If the learner has not spoken yet, greet them, start the scene, and write OK for FIX and PRON.`;

    const messages = [{ role: 'system', content: system }, ...(msgs.length ? msgs : [{ role: 'user', content: '(The learner is ready. Please start.)' }])];

    let last = '';
    for (const model of MODELS) {
      try {
        const r = await env.AI.run(model, { messages, max_tokens: 320, temperature: 0.7 });
        const text = (r && (r.response || (r.result && r.result.response) || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.output_text)) || '';
        if (String(text).trim()) return json({ reply: String(text).trim(), model }, 200, cors);
      } catch (e) { last = String(e && e.message ? e.message : e).slice(0, 200); }
    }
    return json({ error: 'ai_failed', detail: last }, 502, cors);
  },
};
