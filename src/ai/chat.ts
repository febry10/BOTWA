/**
 * AI Chatbot — casual group companion backed by Google Gemini or OpenAI.
 */
import { config } from '../config/index.js';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

const HISTORY_TTL_MS = 30 * 60 * 1000;
const MAX_TURNS = 12;
const histories = new Map<string, { turns: ChatTurn[]; updatedAt: number }>();

export function systemPrompt(): string {
  return [
    `Kamu adalah ${config.bot.name}, teman ngobrol santai di sebuah grup WhatsApp.`,
    'Gunakan bahasa Indonesia santai dan akrab (boleh gaul), ramah, suka bercanda, dan pakai emoji secukupnya.',
    'Kalau ada yang curhat, dengarkan dengan empati dan beri saran yang membangun.',
    'Kalau ditanya, jawab dengan jelas dan ringkas (maksimal sekitar 8 kalimat kecuali diminta detail).',
    'Format untuk WhatsApp: *tebal*, _miring_, tanpa heading markdown.',
    'Jangan memakai kata kasar dan jangan membuat konten SARA, seksual, atau berbahaya.',
    'Kalau seseorang menyebut ingin menyakiti diri sendiri, tanggapi dengan empati dan sarankan menghubungi orang terdekat atau layanan profesional (Indonesia: 119 ext 8).',
  ].join(' ');
}

export function isAiConfigured(): boolean {
  return config.ai.provider === 'openai' ? !!config.ai.openaiApiKey : !!config.ai.geminiApiKey;
}

export function clearHistory(key: string): void {
  histories.delete(key);
}

function getHistory(key: string): ChatTurn[] {
  const entry = histories.get(key);
  if (!entry || Date.now() - entry.updatedAt > HISTORY_TTL_MS) return [];
  return entry.turns;
}

async function callGemini(turns: ChatTurn[]): Promise<string> {
  const model = config.ai.model || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.geminiApiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents: turns.map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
      generationConfig: { temperature: 0.9 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
}

async function callOpenAI(turns: ChatTurn[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiApiKey}` },
    body: JSON.stringify({
      model: config.ai.model || 'gpt-4o-mini',
      temperature: 0.9,
      messages: [{ role: 'system', content: systemPrompt() }, ...turns.map(t => ({ role: t.role, content: t.text }))],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Send a message to the AI, keeping a short per-conversation history.
 */
export async function askAi(conversationKey: string, userName: string, message: string): Promise<string> {
  const turns = [...getHistory(conversationKey), { role: 'user' as const, text: `${userName}: ${message}` }];
  const answer = config.ai.provider === 'openai' ? await callOpenAI(turns) : await callGemini(turns);
  const reply = answer || 'Hmm, aku lagi bingung mau jawab apa 😅';
  histories.set(conversationKey, {
    turns: [...turns, { role: 'assistant' as const, text: reply }].slice(-MAX_TURNS),
    updatedAt: Date.now(),
  });
  return reply;
}
