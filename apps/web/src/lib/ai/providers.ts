// ---------------------------------------------------------------------------
// LLM provider transport.
// Everything is defensive: keys are never echoed, models are sanitised before
// they touch a URL, JSON extraction survives markdown fences and chatty models,
// and transient failures get exactly one retry inside a wall-clock budget.
// ---------------------------------------------------------------------------

export type ProviderId = "gemini" | "groq" | "openai" | "deepseek" | "openrouter";

export const PROVIDER_IDS: ProviderId[] = ["gemini", "groq", "openai", "deepseek", "openrouter"];

export interface KeySlotPayload {
  id: string;
  label: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  enabled?: boolean;
}

const DEFAULT_MODEL: Record<ProviderId, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  deepseek: "deepseek-chat",
  openrouter: "google/gemini-2.0-flash-exp:free",
};

export const sanitizeModel = (provider: ProviderId, model: string): string => {
  const raw = (model || "").trim().replace(/^models\//i, "");
  const safe = raw.replace(/[^a-zA-Z0-9._:\-/]/g, "");
  return safe || DEFAULT_MODEL[provider];
};

/** Hardened slot validation — untrusted client input never reaches a provider. */
export const sanitizeSlots = (raw: unknown): KeySlotPayload[] => {
  if (!Array.isArray(raw)) return [];
  const slots: KeySlotPayload[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const provider = String(rec.provider || "").toLowerCase() as ProviderId;
    if (!PROVIDER_IDS.includes(provider)) continue;
    slots.push({
      id: String(rec.id || `slot_${slots.length + 1}`).slice(0, 40),
      label: String(rec.label || `Agent ${slots.length + 1}`).slice(0, 120),
      provider,
      model: sanitizeModel(provider, String(rec.model || "")),
      apiKey: String(rec.apiKey || "").trim().slice(0, 400),
      enabled: rec.enabled !== undefined ? Boolean(rec.enabled) : true,
    });
  }
  return slots;
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

export class ProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "ProviderError";
    this.retryable = retryable;
  }
}

/** Pull the first valid JSON object out of a model response. */
export const extractJson = (raw: string): any => {
  if (!raw) throw new ProviderError("Respons kosong dari model");
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  const candidates = [text];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const cleaned = candidate.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(cleaned);
    } catch {
      continue;
    }
  }
  throw new ProviderError("Model tidak mengembalikan JSON yang valid");
};

const readErrorMessage = async (res: Response, provider: string): Promise<string> => {
  let body = "";
  try {
    body = (await res.text()).slice(0, 240);
  } catch {
    body = "";
  }
  let detail = body;
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message || parsed?.message || body;
  } catch {
    /* keep raw body */
  }
  return `${provider} HTTP ${res.status}: ${detail || "tanpa detail"}`;
};

export const callProvider = async (
  slot: KeySlotPayload,
  prompt: string,
  opts: { timeoutMs?: number; maxOutputTokens?: number; json?: boolean } = {},
): Promise<any> => {
  const { timeoutMs = 16000, maxOutputTokens = 1400, json = true } = opts;
  const apiKey = slot.apiKey.trim();
  if (!apiKey) throw new ProviderError("API Key kosong");

  const model = sanitizeModel(slot.provider, slot.model);
  const jsonHint = json
    ? "KEMBALIKAN HANYA JSON VALID MURNI TANPA KATA PENGANTAR DAN TANPA CODE BLOCK:"
    : "";

  if (slot.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: json ? `${prompt}\n\n${jsonHint}` : prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens,
            ...(json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
      timeoutMs,
    );
    if (!res.ok) throw new ProviderError(await readErrorMessage(res, "Gemini"), res.status >= 500 || res.status === 429);
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return json ? extractJson(rawText) : rawText.trim();
  }

  const endpoints: Partial<Record<ProviderId, { url: string; jsonMode?: boolean; host: string }>> = {
    openai: { url: "https://api.openai.com/v1/chat/completions", jsonMode: true, host: "OpenAI" },
    groq: { url: "https://api.groq.com/openai/v1/chat/completions", host: "Groq" },
    deepseek: { url: "https://api.deepseek.com/chat/completions", host: "DeepSeek" },
    openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", host: "OpenRouter" },
  };

  const endpoint = endpoints[slot.provider];
  if (!endpoint) throw new ProviderError(`Provider tidak dikenal: ${slot.provider}`);

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: json ? `${prompt}\n\n${jsonHint}` : prompt }],
    temperature: 0.25,
    max_tokens: maxOutputTokens,
  };
  if (json && endpoint.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetchWithTimeout(
    endpoint.url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://needpipsforporsche.local",
        "X-Title": "needpipsforporsche-trading-council",
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!res.ok) throw new ProviderError(await readErrorMessage(res, endpoint.host), res.status >= 500 || res.status === 429);
  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content || "";
  return json ? extractJson(rawText) : rawText.trim();
};

/** One silent retry for transient failures, then give up cleanly. */
export const callProviderWithRetry = async (
  slot: KeySlotPayload,
  prompt: string,
  opts: { timeoutMs?: number; budgetMs?: number; json?: boolean } = {},
): Promise<any> => {
  try {
    return await callProvider(slot, prompt, opts);
  } catch (err) {
    const retryable = err instanceof ProviderError ? err.retryable : true;
    const budgetMs = opts.budgetMs ?? 0;
    if (!retryable || budgetMs <= 0) throw err;
    await new Promise((r) => setTimeout(r, 400));
    return callProvider(slot, prompt, opts);
  }
};
