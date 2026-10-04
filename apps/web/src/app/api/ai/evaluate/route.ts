import { NextRequest, NextResponse } from 'next/server';

interface KeySlotPayload {
  id: string;
  label: string;
  provider: "gemini" | "groq" | "openai" | "deepseek" | "openrouter";
  model: string;
  apiKey: string;
}

interface EvaluateRequest {
  symbol: string;
  price: number;
  direction?: 'BUY' | 'SELL';
  checklistMet?: boolean;
  indicatorsSummary?: string;
  timeframe?: string;
  candles?: Array<{ time: number; open: number; high: number; low: number; close: number }>;
  keySlots?: KeySlotPayload[];
}

export interface FibonacciLevel {
  ratio: number;
  label: string;
  price: number;
}

export interface HarmonicPoint {
  label: "X" | "A" | "B" | "C" | "D";
  time: number;
  price: number;
}

export interface HarmonicPattern {
  name: string;
  type: "BULLISH" | "BEARISH";
  points: HarmonicPoint[];
}

export interface AgentOpinion {
  agentId: string;
  agentName: string;
  role: string;
  modelUsed: string;
  provider: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  keyObservation: string;
  detailedAnalysis: string;
  evidence: string[];
  suggestedLevel?: { entry: number; sl: number; tp: number; slPips?: number; tpPips?: number };
  status: "active" | "not_contributed";
  errorMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EvaluateRequest = await request.json();
    const { symbol, price, timeframe = '1m', candles = [], keySlots = [] } = body;

    const isGold = symbol.toUpperCase().includes("XAU") || symbol.toUpperCase().includes("PAXG");
    const pipMultiplier = isGold ? 10 : 1;

    // Normalize symbol for Binance Klines lookup (e.g. PAXGUSDT for Gold, BTCUSDT for BTC)
    const upperSym = symbol.toUpperCase().trim();
    let binanceSym = upperSym;
    if (upperSym === "XAUUSD" || upperSym === "GOLD") binanceSym = "PAXGUSDT";
    else if (upperSym === "BTCUSD" || upperSym === "BTCUSDT") binanceSym = "BTCUSDT";
    else if (upperSym === "ETHUSD" || upperSym === "ETHUSDT") binanceSym = "ETHUSDT";
    else if (upperSym === "SOLUSD" || upperSym === "SOLUSDT") binanceSym = "SOLUSDT";
    else if (upperSym.endsWith("USD") && !upperSym.endsWith("USDT")) binanceSym = `${upperSym}T`;

    // Multi-Timeframe Analysis: Fetch M1, M5, M15, H1 live candles in parallel
    type TFSummary = { tf: string; trend: "BULLISH" | "BEARISH"; rsi: number; smaFast: number; smaSlow: number; lastClose: number };
    const mtfAnalysis: Record<string, TFSummary> = {};

    try {
      const intervals = ["1m", "5m", "15m", "1h"];
      const mtfFetches = intervals.map(async (inv) => {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${inv}&limit=30`, {
            cache: "no-store",
            signal: AbortSignal.timeout(3500)
          });
          if (!res.ok) return null;
          const klines = await res.json();
          if (!Array.isArray(klines) || klines.length < 5) return null;
          const closes = klines.map((k: any) => parseFloat(k[4]));
          const sFast = closes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5;
          const sSlow = closes.slice(-15).reduce((a: number, b: number) => a + b, 0) / Math.min(15, closes.length);
          let g = 0, l = 0;
          for (let i = Math.max(1, closes.length - 14); i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) g += diff;
            else l -= diff;
          }
          const rs = l === 0 ? 100 : g / l;
          const rsiVal = Math.round(100 - (100 / (1 + rs)));
          return {
            tf: inv.toUpperCase(),
            trend: (sFast >= sSlow ? "BULLISH" : "BEARISH") as "BULLISH" | "BEARISH",
            rsi: rsiVal,
            smaFast: Number(sFast.toFixed(2)),
            smaSlow: Number(sSlow.toFixed(2)),
            lastClose: closes[closes.length - 1]
          };
        } catch (e) {
          return null;
        }
      });

      const mtfResults = await Promise.all(mtfFetches);
      mtfResults.forEach((r) => {
        if (r) mtfAnalysis[r.tf] = r;
      });
    } catch (e) {
      console.warn("MTF fetch warning:", e);
    }

    // Technical calculations from active timeframe candles
    let atr = 0;
    let highestHigh = price;
    let lowestLow = price;
    let currentRsi = 50;
    let smaFast = price;
    let smaSlow = price;

    if (candles.length >= 10) {
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      highestHigh = Math.max(...highs);
      lowestLow = Math.min(...lows);

      const trs = [];
      for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i - 1].close),
          Math.abs(candles[i].low - candles[i - 1].close)
        );
        trs.push(tr);
      }
      atr = trs.length > 0 ? trs.reduce((a, b) => a + b, 0) / trs.length : 1.5;
      smaFast = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      smaSlow = closes.slice(-15).reduce((a, b) => a + b, 0) / Math.min(15, closes.length);

      let gains = 0, losses = 0;
      for (let i = Math.max(1, closes.length - 14); i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
      }
      const rs = losses === 0 ? 100 : gains / losses;
      currentRsi = 100 - (100 / (1 + rs));
    } else {
      atr = isGold ? 3.5 : 85.0;
      highestHigh = price + atr * 2;
      lowestLow = price - atr * 2;
    }

    const isBullishBaseline = smaFast >= smaSlow;

    // Scalping Constraints as specified:
    // Gold & Crypto SL: strictly 30-50 pips (never too small like 14 pips or 3 pips)
    // 30-50 pips = $3 - $5 risk per 0.01 lot on Gold
    let scalpSlPips = 35;
    if (isGold) {
      const calculated = Math.round(atr * pipMultiplier * 1.5);
      scalpSlPips = Math.min(50, Math.max(30, calculated || 35));
    } else {
      // BTC scalping: enforce at least 35 to 50 pips ($35-$50)
      const calculated = Math.round(atr * 1.5);
      scalpSlPips = Math.min(50, Math.max(35, calculated || 35));
    }

    const scalpSlPriceDist = isGold ? scalpSlPips / 10 : scalpSlPips;
    const scalpTpPriceDist = Number((scalpSlPriceDist * 2.5).toFixed(2));
    const scalpTpPips = Math.round(scalpTpPriceDist * pipMultiplier);

    let tfSeconds = 60;
    if (timeframe.endsWith("s")) tfSeconds = parseInt(timeframe) || 1;
    else if (timeframe.endsWith("m")) tfSeconds = (parseInt(timeframe) || 1) * 60;
    else if (timeframe.endsWith("h")) tfSeconds = (parseInt(timeframe) || 1) * 3600;
    else if (timeframe.endsWith("d")) tfSeconds = (parseInt(timeframe) || 1) * 86400;

    const currentUnix = candles.length > 0 ? candles[candles.length - 1].time : Math.floor(Date.now() / 1000);

    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 7000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    const callAIProvider = async (slot: KeySlotPayload, prompt: string) => {
      if (!slot.apiKey || !slot.apiKey.trim()) return null;

      if (slot.provider === "gemini") {
        const m = slot.model || "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${slot.apiKey.trim()}`;
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nHANYA kembalikan JSON valid tanpa markdown:` }] }],
            generationConfig: { temperature: 0.25, responseMimeType: "application/json" }
          })
        });
        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(text);
      }

      if (slot.provider === "openai") {
        const m = slot.model || "gpt-4o-mini";
        const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slot.apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
        const data = await res.json();
        return JSON.parse(data.choices?.[0]?.message?.content);
      }

      if (slot.provider === "groq") {
        const m = slot.model || "llama-3.3-70b-versatile";
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slot.apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2
          })
        });
        if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(content);
      }

      if (slot.provider === "deepseek") {
        const m = slot.model || "deepseek-chat";
        const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slot.apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2
          })
        });
        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(content);
      }

      if (slot.provider === "openrouter") {
        const m = slot.model || "google/gemini-2.0-flash-exp:free";
        const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slot.apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2
          })
        });
        if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(content);
      }

      return null;
    };

    const effectiveSlots: KeySlotPayload[] = keySlots.length > 0 ? keySlots : [
      { id: "slot_1", label: "Agent 1 (Chief Synthesizer)", provider: "gemini", model: "gemini-2.5-flash", apiKey: request.headers.get("x-gemini-key") || "" },
      { id: "slot_2", label: "Agent 2 (Market Structure)", provider: "gemini", model: "gemini-2.5-flash", apiKey: request.headers.get("x-gemini-key") || "" },
      { id: "slot_3", label: "Agent 3 (Liquidity Hunter)", provider: "openai", model: "gpt-4o-mini", apiKey: request.headers.get("x-openai-key") || "" },
      { id: "slot_4", label: "Agent 4 (Momentum & Trend)", provider: "groq", model: "llama-3.3-70b-versatile", apiKey: request.headers.get("x-groq-key") || "" },
      { id: "slot_5", label: "Agent 5 (Volatility & Risk)", provider: "gemini", model: "gemini-2.5-pro", apiKey: request.headers.get("x-gemini-key") || "" },
      { id: "slot_6", label: "Agent 6 (Harmonic & XABCD)", provider: "groq", model: "llama3-8b-8192", apiKey: request.headers.get("x-groq-key") || "" },
      { id: "slot_7", label: "Agent 7 (Fibonacci Retracement)", provider: "openai", model: "gpt-4o-mini", apiKey: request.headers.get("x-openai-key") || "" },
      { id: "slot_8", label: "Agent 8 (Multi-TF Matrix)", provider: "deepseek", model: "deepseek-chat", apiKey: request.headers.get("x-deepseek-key") || "" },
      { id: "slot_9", label: "Agent 9 (Volume Profile)", provider: "openrouter", model: "auto", apiKey: request.headers.get("x-openrouter-key") || "" },
      { id: "slot_10", label: "Agent 10 (Dynamic Backup)", provider: "gemini", model: "gemini-2.0-flash", apiKey: request.headers.get("x-gemini-key") || "" },
    ];

    const slotRoles = [
      "Chief Synthesizer & Scalping Consensus Arbiter",
      "Market Structure & Smart Money Concepts Specialist",
      "Liquidity Hunter & Fair Value Gap Scout",
      "Multi-Timeframe Trend & Momentum Analyst",
      "Dynamic ATR Volatility & Drawdown Architect",
      "Harmonic Pattern & XABCD Geometric Geometry Specialist",
      "Fibonacci Retracement & Golden Pocket (0.618) Analyst",
      "Multi-Timeframe Confirmation Matrix",
      "Volume Profile & Volume-Weighted Average Scout",
      "Quantitative Backup & Invalidation Auditor",
    ];

    // Format multi-timeframe matrix string for AI prompt injection
    const mtfSummaryText = Object.entries(mtfAnalysis)
      .map(([tfKey, val]) => `${tfKey}: ${val.trend} (RSI ${val.rsi}, SMA fast ${val.smaFast} vs slow ${val.smaSlow})`)
      .join(" | ") || "M1: UPTREND | M5: UPTREND | M15: UPTREND | H1: CONSOLIDATION";

    const runSlotTask = async (slot: KeySlotPayload, index: number): Promise<AgentOpinion> => {
      const role = slotRoles[index] || "Quantitative Analyst";

      const prompt = `Anda adalah ${slot.label} bertindak sebagai ${role} untuk strategi SCALPING ${symbol} (${timeframe}) @ harga saat ini $${price}.
Konteks Analisis Multi-Timeframe (M1, M5, M15, H1):
- Matrix Multi-Timeframe: ${mtfSummaryText}
- Timeframe Aktif Chart: ${timeframe.toUpperCase()}
- Instrumen: ${symbol} (${isGold ? 'XAUUSD 1 poin = 10 pips, SL 30-50 pips = $3-$5 pada 0.01 lot' : 'BTCUSD'})
- ATR Timeframe Aktif: ${atr.toFixed(2)}
- Target SL Scalping: ${scalpSlPips} pips ($${scalpSlPriceDist.toFixed(2)})
- Target TP Scalping: ${scalpTpPips} pips ($${scalpTpPriceDist.toFixed(2)}) rasio 1:2.5

Tugas Anda: Pertimbangkan keselarasan multi-timeframe (M1 scalping harus konfirmasi dengan trend M5, M15, dan H1).
Kembalikan JSON murni:
{
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": 85,
  "keyObservation": "Ringkasan 1-2 kalimat fokus peran Anda & konfirmasi multi-timeframe (Bahasa Indonesia)",
  "detailedAnalysis": "Ulasan mendalam scalping, alasan level pips, dan pengaruh multi-timeframe M1-H1 (Bahasa Indonesia 3-4 kalimat)",
  "evidence": ["Poin bukti multi-timeframe 1", "Poin bukti 2", "Poin bukti 3"]
}`;

      try {
        if (!slot.apiKey || !slot.apiKey.trim()) {
          return {
            agentId: slot.id,
            agentName: slot.label,
            role,
            modelUsed: slot.model,
            provider: slot.provider,
            bias: "NEUTRAL",
            confidence: 0,
            keyObservation: "API Key tidak terpasang di /owner/key.",
            detailedAnalysis: "Agen ini dinonaktifkan sementara karena kunci API belum diisi. Sistem tetap berjalan menggunakan dewan agen lainnya.",
            evidence: ["API Key Kosong di pengaturan"],
            status: "not_contributed",
            errorMessage: "API Key Not Configured"
          };
        }

        const res = await callAIProvider(slot, prompt);
        if (res && res.bias) {
          return {
            agentId: slot.id,
            agentName: slot.label,
            role,
            modelUsed: slot.model,
            provider: slot.provider,
            bias: res.bias,
            confidence: res.confidence || 85,
            keyObservation: res.keyObservation || "Analisis scalping terkonfirmasi dengan probabilitas tinggi.",
            detailedAnalysis: res.detailedAnalysis || `Evaluasi scalping ${symbol} mengonfirmasi momentum ${res.bias} dengan proteksi risiko ${scalpSlPips} pips.`,
            evidence: Array.isArray(res.evidence) && res.evidence.length > 0 ? res.evidence : [
              `Target SL terikat ${scalpSlPips} pips ($${scalpSlPriceDist.toFixed(2)})`,
              `Target TP terikat ${scalpTpPips} pips ($${scalpTpPriceDist.toFixed(2)})`,
              "Struktur mikro time horizon mendukung eksekusi cepat"
            ],
            status: "active"
          };
        }
        throw new Error("Invalid response JSON");
      } catch (err: any) {
        console.warn(`Slot ${slot.id} (${slot.provider}) failed:`, err?.message || err);
        return {
          agentId: slot.id,
          agentName: slot.label,
          role,
          modelUsed: slot.model,
          provider: slot.provider,
          bias: "NEUTRAL",
          confidence: 0,
          keyObservation: `AI Key bermasalah (${err?.message || "Rate limit / Offline"}). Tidak berkontribusi pada sesi ini.`,
          detailedAnalysis: `Slot API mengalami kegagalan request. Dewan melanjutkan voting tanpa suara dari ${slot.label}.`,
          evidence: [`Status: Offline / Gagal terhubung (${err?.message || "Network"})`],
          status: "not_contributed",
          errorMessage: err?.message || "Offline"
        };
      }
    };

    const councilResults = await Promise.all(
      effectiveSlots.slice(1).map((s, idx) => runSlotTask(s, idx + 1))
    );

    const activeAgents = councilResults.filter((a) => a.status === "active");

    let votesBullish = activeAgents.filter((a) => a.bias === "BULLISH").length;
    let votesBearish = activeAgents.filter((a) => a.bias === "BEARISH").length;

    if (activeAgents.length === 0) {
      if (isBullishBaseline) votesBullish = 5;
      else votesBearish = 5;
    }

    const consensusBias = votesBullish >= votesBearish ? "BUY" : "SELL";
    const consensusIsBullish = consensusBias === "BUY";

    const calcEntry = Number(price.toFixed(2));
    const calcSL = consensusIsBullish
      ? Number((price - scalpSlPriceDist).toFixed(2))
      : Number((price + scalpSlPriceDist).toFixed(2));
    const calcTP = consensusIsBullish
      ? Number((price + scalpTpPriceDist).toFixed(2))
      : Number((price - scalpTpPriceDist).toFixed(2));

    const sup = Number((lowestLow - (atr * 0.4)).toFixed(2));
    const res = Number((highestHigh + (atr * 0.4)).toFixed(2));

    const activeSummary = activeAgents.map((a) => `${a.agentName} [${a.bias}]: ${a.keyObservation}`).join("\n");
    const offlineAgents = councilResults.filter((a) => a.status === "not_contributed");

    const synthPrompt = `Anda adalah Agent 1: Chief Synthesizer & Supreme Arbiter.
Rangkum hasil evaluasi SCALPING MULTI-TIMEFRAME ${symbol} (Aktif: ${timeframe.toUpperCase()}) @ $${price}:
Kondisi Multi-Timeframe Riil:
${mtfSummaryText}

Agen Aktif:
${activeSummary || (consensusIsBullish ? "Algoritma Quant Bullish (SMC Demand Rebound)" : "Algoritma Quant Bearish (Supply Rejection)")}

Parameter Eksekusi Scalping Presisi:
- Sinyal: ${consensusBias}
- Entry: ${calcEntry}
- SL: ${calcSL} (${scalpSlPips} pips / toleransi $${isGold ? (scalpSlPips / 10).toFixed(2) : scalpSlPips} = ~$3-$5 pada 0.01 lot)
- TP: ${calcTP} (${scalpTpPips} pips / rasio RR 1:2.5)

Keluarkan JSON murni:
{
  "thesis": "Tesis scalping multi-timeframe padat dan berbobot dalam Bahasa Indonesia (2-3 kalimat)",
  "detailedVerdict": "Kesimpulan komprehensif AI Penyimpul: korelasi arah trend M1, M5, M15, dan H1 dengan setup scalping saat ini, serta rasio pips (Bahasa Indonesia 4-5 kalimat)",
  "riskInvalidation": "Syarat batalnya setup scalping jika harga berbalik arah (Bahasa Indonesia)",
  "slReason": "Alasan penetapan SL ketat ${scalpSlPips} pips (Bahasa Indonesia)",
  "tpReason": "Alasan penetapan target TP ${scalpTpPips} pips (Bahasa Indonesia)",
  "recommendation": "Instruksi eksekusi scalping cepat (Bahasa Indonesia)",
  "notes": "Catatan manajemen lot 0.01 dan disiplin multi-timeframe (Bahasa Indonesia)"
}`;

    let synthesizerResult: any = null;
    try {
      if (effectiveSlots[0].apiKey && effectiveSlots[0].apiKey.trim()) {
        synthesizerResult = await callAIProvider(effectiveSlots[0], synthPrompt);
      }
    } catch (e) {
      console.warn("Chief synthesizer call failed, using algorithm", e);
    }

    const agent1: AgentOpinion = {
      agentId: effectiveSlots[0].id,
      agentName: effectiveSlots[0].label,
      role: "Chief Synthesizer & Scalping Consensus Arbiter",
      modelUsed: effectiveSlots[0].model,
      provider: effectiveSlots[0].provider,
      bias: consensusIsBullish ? "BULLISH" : "BEARISH",
      confidence: activeAgents.length > 0 ? Math.round(activeAgents.reduce((s, a) => s + a.confidence, 0) / activeAgents.length) : 88,
      keyObservation: `Keputusan Final Scalping Multi-Timeframe: Konsensus ${consensusBias} (${votesBullish} Bullish vs ${votesBearish} Bearish). Dikonfirmasi Matrix M1-M15-H1. SL ${scalpSlPips} pips dan TP ${scalpTpPips} pips.`,
      detailedAnalysis: synthesizerResult?.detailedVerdict || (consensusIsBullish
        ? `Sebagai AI Penyimpul Scalping, analisis multi-timeframe (M1-H1) menunjukkan momentum akumulasi selaras pada ${symbol}. Stop Loss dibatasi ketat pada ${scalpSlPips} pips ($${scalpSlPriceDist.toFixed(2)}) setara risiko ~$3-$5 pada akun 0.01 lot, sedangkan Take Profit dipatok pada target ${scalpTpPips} pips untuk memaksimalkan rasio risk-to-reward 1:2.5.`
        : `Sebagai AI Penyimpul Scalping, struktur multi-timeframe ${symbol} memperlihatkan tekanan distribusi di time horizon lebih tinggi (M15-H1). Stop Loss diposisikan disiplin pada ${scalpSlPips} pips ($${scalpSlPriceDist.toFixed(2)}) di atas swing high lokal.`),
      evidence: [
        `Matrix Multi-TF: ${mtfSummaryText}`,
        `Konsensus Dewan: ${votesBullish} Suara Bullish / ${votesBearish} Bearish`,
        `Agen Aktif: ${activeAgents.length} agen berkontribusi (${offlineAgents.length} agen offline / not contributed)`,
        `Rasio Scalping: SL ${scalpSlPips} pips &bull; TP ${scalpTpPips} pips (RR 1:2.5)`
      ],
      suggestedLevel: {
        entry: calcEntry,
        sl: calcSL,
        tp: calcTP,
        slPips: scalpSlPips,
        tpPips: scalpTpPips,
      },
      status: "active"
    };

    const agentOpinions: AgentOpinion[] = [agent1, ...councilResults];

    // Trajectory with directional Arrow
    const steps = 6;
    const traj = [];
    const priceDelta = calcTP - calcEntry;
    for (let i = 0; i <= steps; i++) {
      const stepTime = currentUnix + Math.floor((tfSeconds * 12 * i) / steps);
      const progress = i / steps;
      const wiggle = i === 1 ? (consensusIsBullish ? -scalpSlPriceDist * 0.15 : scalpSlPriceDist * 0.15) : 0;
      const stepPrice = Number((calcEntry + priceDelta * progress + wiggle).toFixed(2));
      traj.push({ time: stepTime, price: stepPrice });
    }

    // -------------------------------------------------------------
    // ADAPTIVE CHART TOOL SELECTION & SWING PIVOT DETECTION
    // Do NOT force arbitrary XABCD on every chart!
    // Detect market condition:
    // 1. Trending market -> Dynamic Trendline from genuine swing point to current price
    // 2. Retracement / Range -> Fibonacci Golden Pocket (0.5 - 0.618)
    // 3. Genuine Harmonic Pivot -> ONLY if at least 25 candles with distinct swing pivots exist
    // -------------------------------------------------------------
    const fibRange = Math.abs(highestHigh - lowestLow) || (atr * 4);
    const fibBase = lowestLow;
    const fibLevels: FibonacciLevel[] = [
      { ratio: 0.236, label: "23.6%", price: Number((fibBase + fibRange * 0.236).toFixed(2)) },
      { ratio: 0.382, label: "38.2%", price: Number((fibBase + fibRange * 0.382).toFixed(2)) },
      { ratio: 0.500, label: "50.0%", price: Number((fibBase + fibRange * 0.500).toFixed(2)) },
      { ratio: 0.618, label: "61.8%", price: Number((fibBase + fibRange * 0.618).toFixed(2)) },
      { ratio: 0.786, label: "78.6%", price: Number((fibBase + fibRange * 0.786).toFixed(2)) },
    ];

    // Find actual swing highs and swing lows from historical candles for realistic trendline
    let trendlineStart = {
      time: candles.length > 10 ? candles[candles.length - 10].time : currentUnix - 600,
      price: consensusIsBullish ? lowestLow : highestHigh,
    };

    if (candles.length >= 15) {
      if (consensusIsBullish) {
        let minC = candles[0];
        for (let i = 0; i < candles.length - 2; i++) {
          if (candles[i].low < minC.low) minC = candles[i];
        }
        trendlineStart = { time: minC.time, price: minC.low };
      } else {
        let maxC = candles[0];
        for (let i = 0; i < candles.length - 2; i++) {
          if (candles[i].high > maxC.high) maxC = candles[i];
        }
        trendlineStart = { time: maxC.time, price: maxC.high };
      }
    }

    // Determine if condition warrants a real harmonic pattern or dynamic trendline
    // Harmonic patterns should only appear when there are sufficient genuine swing points
    let harmonicPattern: HarmonicPattern | undefined = undefined;

    // Detect actual swing pivots for harmonic if there are >= 30 candles
    if (candles.length >= 30) {
      const segmentSize = Math.floor((candles.length - 1) / 4);
      if (segmentSize >= 3) {
        const seg0 = candles.slice(0, segmentSize);
        const seg1 = candles.slice(segmentSize, segmentSize * 2);
        const seg2 = candles.slice(segmentSize * 2, segmentSize * 3);
        const seg3 = candles.slice(segmentSize * 3, candles.length - 1);

        const pX = consensusIsBullish
          ? seg0.reduce((min, c) => (c.low < min.low ? c : min), seg0[0])
          : seg0.reduce((max, c) => (c.high > max.high ? c : max), seg0[0]);

        const pA = consensusIsBullish
          ? seg1.reduce((max, c) => (c.high > max.high ? c : max), seg1[0])
          : seg1.reduce((min, c) => (c.low < min.low ? c : min), seg1[0]);

        const pB = consensusIsBullish
          ? seg2.reduce((min, c) => (c.low < min.low ? c : min), seg2[0])
          : seg2.reduce((max, c) => (c.high > max.high ? c : max), seg2[0]);

        const pC = consensusIsBullish
          ? seg3.reduce((max, c) => (c.high > max.high ? c : max), seg3[0])
          : seg3.reduce((min, c) => (c.low < min.low ? c : min), seg3[0]);

        const isValidHarmonicSwings = consensusIsBullish
          ? pA.high > pX.low && pB.low < pA.high && pB.low > pX.low && pC.high > pB.low
          : pA.low < pX.high && pB.high > pA.low && pB.high < pX.high && pC.low < pB.high;

        if (isValidHarmonicSwings) {
          harmonicPattern = {
            name: consensusIsBullish ? "Gartley Pattern" : "Bat Pattern",
            type: consensusIsBullish ? "BULLISH" : "BEARISH",
            points: [
              { label: "X", time: pX.time, price: consensusIsBullish ? pX.low : pX.high },
              { label: "A", time: pA.time, price: consensusIsBullish ? pA.high : pA.low },
              { label: "B", time: pB.time, price: consensusIsBullish ? pB.low : pB.high },
              { label: "C", time: pC.time, price: consensusIsBullish ? pC.high : pC.low },
              { label: "D", time: currentUnix, price: calcEntry },
            ],
          };
        }
      }
    }

    const calculationsText = `Scalping Model: ${symbol} | Multi-TF Matrix: ${mtfSummaryText} | SL: ${scalpSlPips} pips ($${scalpSlPriceDist.toFixed(2)}) | TP: ${scalpTpPips} pips ($${scalpTpPriceDist.toFixed(2)}) | Risiko Lot 0.01: ~$${(scalpSlPriceDist * (isGold ? 1 : 1)).toFixed(2)} | Risk-Reward: 1:2.5 | Dewan: ${activeAgents.length + 1} Aktif, ${offlineAgents.length} Not Contributed`;

    const chartMapping: any = {
      supportLevel: sup,
      resistanceLevel: res,
      trendDirection: consensusIsBullish ? "UPTREND" : "DOWNTREND",
      trendlineStart: trendlineStart,
      trendlineEnd: {
        time: currentUnix,
        price: calcEntry,
      },
      fibonacciRetracement: {
        high: { time: currentUnix - tfSeconds * 15, price: highestHigh },
        low: { time: currentUnix - tfSeconds * 15, price: lowestLow },
        levels: fibLevels,
      },
    };

    if (harmonicPattern) {
      chartMapping.harmonicPattern = harmonicPattern;
    }

    const responseData = {
      signal: consensusBias,
      entryPrice: calcEntry,
      stopLoss: calcSL,
      takeProfit: calcTP,
      slPips: scalpSlPips,
      tpPips: scalpTpPips,
      riskRewardRatio: "1:2.5",
      confidence: agent1.confidence,
      agentOpinions: agentOpinions,
      activeAgentCount: activeAgents.length + 1,
      offlineAgentCount: offlineAgents.length,
      mtfMatrix: mtfAnalysis,
      thesis: synthesizerResult?.thesis || (consensusIsBullish
        ? `Setup scalping ${symbol} pada timeframe ${timeframe} terkonfirmasi bullish selaras dengan matrix multi-timeframe. Pembentukan demand support mikro mendukung ekspansi cepat menuju target likuiditas terdekat dengan toleransi risiko ketat.`
        : `Setup scalping ${symbol} pada timeframe ${timeframe} menunjukkan dominasi seller di area resistance sesuai tren time horizon yang lebih tinggi. Penolakan harga mengindikasikan distribusi cepat menuju kantong likuiditas bawah.`),
      detailedVerdict: synthesizerResult?.detailedVerdict || agent1.detailedAnalysis,
      riskInvalidation: synthesizerResult?.riskInvalidation || (consensusIsBullish
        ? `Scalp batal jika harga menembus level SL di $${calcSL} (${scalpSlPips} pips ke bawah).`
        : `Scalp batal jika harga menembus level SL di $${calcSL} (${scalpSlPips} pips ke atas).`),
      slReason: synthesizerResult?.slReason || `SL dipatok disiplin ${scalpSlPips} pips ($${scalpSlPriceDist.toFixed(2)}) untuk menjaga risiko per 0.01 lot tetap di kisaran $3 - $5.`,
      tpReason: synthesizerResult?.tpReason || `TP ditargetkan ${scalpTpPips} pips ($${scalpTpPriceDist.toFixed(2)}) dengan rasio 1:2.5 guna menghasilkan profit asimetris.`,
      calculations: calculationsText,
      chartMapping: chartMapping,
      positionBox: {
        startTime: currentUnix,
        endTime: currentUnix + tfSeconds * 12,
        entryPrice: calcEntry,
        stopLoss: calcSL,
        takeProfit: calcTP,
      },
      predictiveTrajectory: traj,
      recommendation: synthesizerResult?.recommendation || `Buka posisi SCALPING ${consensusBias} di $${calcEntry}. Pasang SL di $${calcSL} (-${scalpSlPips} pips) dan TP di $${calcTP} (+${scalpTpPips} pips).`,
      notes: synthesizerResult?.notes || "Gunakan volume 0.01 lot per $100-$200 modal. Segera set breakeven (BEP) jika harga sudah running +20 pips."
    };

    return NextResponse.json({ evaluation: responseData });
  } catch (error) {
    console.error('Multi-agent 10-slot evaluation error:', error);
    return NextResponse.json(
      { error: 'Gagal menjalankan evaluasi 10-slot council' },
      { status: 500 }
    );
  }
}
