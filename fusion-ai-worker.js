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

    const mode = body.mode === 'feedback' ? 'feedback' : 'chat';
    const role = clean(body.role, 120) || 'a friendly native English speaker named Alex';
    const scenario = clean(body.scenario, 200) || 'a casual chat';
    const level = clean(body.level, 30) || 'basic';
    const msgs = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-24)
      .map(m => ({ role: m.role, content: clean(m.content, 600) }));

    const LEVEL = {
      beginner: 'The learner is a beginner: use very common words, short sentences, speak a little slower and clearer, and never use idioms.',
      basic: 'The learner is elementary: use simple everyday words and short sentences. An easy phrasal verb or common expression is fine.',
      intermediate: 'The learner is intermediate: speak at normal natural speed with everyday idioms, phrasal verbs and contractions, like you would with a friend.',
    };

    let messages, temperature, max_tokens;
    if (mode === 'chat') {
      const system =
        `You are ${role}. This is a live, spoken, face-to-face conversation with a Vietnamese person who is practising English. Scenario: ${scenario}.\n` +
        `You are NOT a teacher and NOT an assistant. You are a real person with your own life, moods and opinions. Never say you are an AI. Never explain grammar, never correct them, never translate, never give lists.\n` +
        `HOW REAL PEOPLE TALK (follow this closely):\n` +
        `- Speak the way people talk out loud: contractions (I'm, don't, gonna, wanna), casual connectors ("well", "so", "you know", "honestly", "oh", "hmm", "ah"), and natural reactions ("No way!", "That sounds fun", "Ugh, I hate that", "Haha, same").\n` +
        `- Vary your replies. Do NOT end every turn with a question. Roughly: sometimes just react and add your own thought or short story, sometimes ask a question, sometimes do both. Never interview them with one question after another.\n` +
        `- Match their energy and length. If they said one short phrase, answer in one short sentence. Usually 1 to 3 short sentences, never more than 40 words. No monologues.\n` +
        `- Share small personal details and opinions (invent them, keep them consistent). Remember and refer back to things they told you earlier.\n` +
        `- Don't start two replies in a row with the same word or phrase. Avoid stock phrases like "That's great!", "Interesting!", "I see", "Certainly", "Of course", "How can I help you".\n` +
        `- If you did not understand, react like a person would: "Sorry, what was that?" or "Wait, you mean ...?". If they are quiet or stuck, help gently with a simple, easy question.\n` +
        `- If the scenario is a role (barista, receptionist, doctor...), stay in that role and act realistically with natural small talk, not a script.\n` +
        `${LEVEL[level] || LEVEL.basic}\n` +
        `Their words come from speech recognition: no punctuation or capital letters, and sometimes a wrong word that sounds like the right one. Silently guess what they meant from context and answer that.\n` +
        `Output ONLY the words you would say out loud. No labels, no quotes, no stage directions, no emojis, no markdown, no translation.\n` +
        `If they have not spoken yet, start the conversation yourself in a natural way for this scenario (a casual greeting plus one easy opener).`;
      messages = [{ role: 'system', content: system }, ...(msgs.length ? msgs : [{ role: 'user', content: '(The other person has just walked up to you. Start the conversation.)' }])];
      temperature = 0.9; max_tokens = 110;
    } else {
      const learner = clean(body.userText, 600);
      const bot = clean(body.botText, 600);
      const ctx = msgs.slice(-6).map(m => (m.role === 'user' ? 'Learner: ' : 'Partner: ') + m.content).join('\n');
      const system =
        `You are a kind English tutor helping a Vietnamese learner (level: ${level}). Scenario: ${scenario}.\n` +
        `The learner's text comes from speech recognition (no punctuation or capitals; ignore that). Output EXACTLY three lines and nothing else:\n` +
        `VI: <natural Vietnamese translation of the partner's reply>\n` +
        `FIX: <if the learner's LAST message has a real grammar or word-choice mistake, give a more natural corrected full sentence, then " - " and a short explanation in Vietnamese; otherwise write OK. Do not nitpick style, punctuation or small things a native would never notice>\n` +
        `PRON: <in Vietnamese, at most 3 words from the learner's last message that recognition probably got wrong because of mispronunciation (the heard word looks odd or out of place), with the intended word, its IPA and one short tip; otherwise write OK>\n` +
        `If there is no learner message, write OK for FIX and PRON.`;
      messages = [{ role: 'system', content: system }, { role: 'user', content: `Recent conversation:\n${ctx}\n\nLearner's last message: ${learner || '(none)'}\nPartner's reply: ${bot}` }];
      temperature = 0.2; max_tokens = 260;
    }

    let last = '';
    for (const model of MODELS) {
      try {
        const r = await env.AI.run(model, { messages, max_tokens, temperature });
        let text = String((r && (r.response || (r.result && r.result.response) || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.output_text)) || '').trim();
        if (mode === 'chat') {
          text = text.replace(/^\s*(EN|VI|FIX|PRON)\s*:\s*/i, '').split(/\n\s*(?:VI|FIX|PRON)\s*:/i)[0]
            .replace(/^\s*[A-Z][a-z]{1,12}\s*:\s*/, '').replace(/^["“]|["”]$/g, '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
        }
        if (text) return json({ reply: text, model, v: 2 }, 200, cors);
      } catch (e) { last = String(e && e.message ? e.message : e).slice(0, 200); }
    }
    return json({ error: 'ai_failed', detail: last }, 502, cors);
  },
};
