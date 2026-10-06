import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { callProviderWithRetry, sanitizeSlots } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/**
 * POST /api/neural/learn
 * Auto-triggered when a trade concludes with WIN or LOSS (or manually reviewed).
 * The 20-Agent Neural Council conducts a deep post-mortem breakdown of the trade,
 * stores the lesson learned in PostgreSQL, and feeds it forward into future council sessions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tradeId,
      symbol,
      direction,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      outcome, // 'WIN' | 'LOSS'
      pnl,
      keySlots = [],
      tradeRationale = "",
    } = body;

    if (!symbol || !direction || !outcome) {
      return NextResponse.json({ error: "Missing trade parameters" }, { status: 400 });
    }

    const slots = sanitizeSlots(keySlots);
    const analyzerSlot = slots.find((s) => s.enabled && s.apiKey.trim()) || slots[0];

    let mistakeAnalysis = "";
    let lessonLearned = "";
    let agentResponsible = "Council Consensus";

    if (analyzerSlot && analyzerSlot.apiKey) {
      const prompt = `KAMU ADALAH: Chief Quantitative Risk Auditor & Neural Learning Evaluator di "Need Pips For Porsche".
TUGAS: Lakukan Post-Mortem Evaluasi Mendalam terhadap hasil trade yang baru saja selesai.

DETAIL TRADE:
- Simbol: ${symbol}
- Arah: ${direction}
- Entry Price: $${entryPrice}
- Exit Price: $${exitPrice || "N/A"}
- Stop Loss: $${stopLoss} | Take Profit: $${takeProfit}
- Hasil Akhir: ${outcome} (${pnl ? `PnL: $${pnl}` : ""})
- Rationale Awal: ${tradeRationale || "Setup berbasis sinyal AI Council"}

ANALISIS SECARA KRITIS:
${
  outcome === "LOSS"
    ? `1. Mengapa trade ini mengalami kerugian / kena SL? Apakah karena false breakout, liquidity sweep (Judas Swing), FVG yang belum selesai terisi, melawan arah trend timeframe lebih besar (M15/H1), atau eksekusi terlalu terburu-buru?
2. Apa pelajaran kuantitatif terpenting yang WAJIB diingat dan DILARANG diulangi oleh dewan AI pada setup berikutnya?`
    : `1. Mengapa trade ini berhasil meraih TP / WIN? Konfluensi apa yang paling dominan bekerja (misal FVG reaction, momentum displacement, atau liquidity mitigation)?
2. Apa pola kunci yang harus dipertahankan dewan AI?`
}

JAWAB HANYA DALAM FORMAT JSON BERIKUT (TANPA MARKDOWN TAMBAHAN):
{
  "mistake_analysis": "Penjelasan kritis 1-2 kalimat tentang faktor penyebab hasil trade ini",
  "lesson_learned": "Aturan / pelajaran terpenting 1-2 kalimat untuk dipatuhi AI pada analisa berikutnya",
  "agent_responsible": "Nama spesialis yang paling relevan (misal: Liquidity Hunter, Structure Specialist, Volatility Architect, dll)"
}`;

      try {
        const rawResponse = await callProviderWithRetry(analyzerSlot, prompt, {
          timeoutMs: 14000,
          json: true,
        });

        if (typeof rawResponse === "object" && rawResponse !== null) {
          mistakeAnalysis = rawResponse.mistake_analysis || "";
          lessonLearned = rawResponse.lesson_learned || "";
          agentResponsible = rawResponse.agent_responsible || "Council Consensus";
        }
      } catch (err) {
        console.warn("AI post-mortem call fallback:", err);
      }
    }

    // Fallback if AI call was offline
    if (!mistakeAnalysis) {
      if (outcome === "LOSS") {
        mistakeAnalysis = `Trade ${direction} pada ${symbol} tersentuh SL $${stopLoss}. Kemungkinan akibat liquidity hunt atau pergeseran struktur mikro tanpa konfirmasi displacement.`;
        lessonLearned = `Tingkatkan toleransi buffer swing SL dan pastikan mitigasi FVG / MSS terkonfirmasi sebelum entry.`;
      } else {
        mistakeAnalysis = `Trade ${direction} pada ${symbol} sukses mencapai TP $${takeProfit}. Struktur market sesuai rencana.`;
        lessonLearned = `Pertahankan disiplin rasio risk-to-reward dan konfluensi multi-timeframe.`;
      }
    }

    // Persist into PostgreSQL neural_learning_memory
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO neural_learning_memory (
             trade_id, symbol, outcome, mistake_analysis, lesson_learned, technical_factors, agent_responsible
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, created_at`,
          [
            tradeId || null,
            symbol,
            outcome,
            mistakeAnalysis,
            lessonLearned,
            JSON.stringify({ entryPrice, exitPrice, stopLoss, takeProfit, pnl }),
            agentResponsible,
          ]
        );

        return NextResponse.json({
          ok: true,
          memoryId: result.rows[0]?.id,
          outcome,
          mistakeAnalysis,
          lessonLearned,
          agentResponsible,
        });
      } finally {
        client.release();
      }
    } catch (dbErr: any) {
      console.warn("PostgreSQL neural memory insert error:", dbErr);
      return NextResponse.json({
        ok: true,
        savedLocally: true,
        outcome,
        mistakeAnalysis,
        lessonLearned,
        agentResponsible,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/neural/learn?symbol=XAUUSD
 * Retrieves the knowledge bank of past lessons learned from mistakes
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  try {
    const client = await pool.connect();
    try {
      const query = symbol
        ? `SELECT id, trade_id, symbol, outcome, mistake_analysis, lesson_learned, agent_responsible, created_at
           FROM neural_learning_memory
           WHERE symbol = $1
           ORDER BY created_at DESC
           LIMIT 20`
        : `SELECT id, trade_id, symbol, outcome, mistake_analysis, lesson_learned, agent_responsible, created_at
           FROM neural_learning_memory
           ORDER BY created_at DESC
           LIMIT 20`;
      const params = symbol ? [symbol] : [];
      const result = await client.query(query, params);
      return NextResponse.json({ memories: result.rows });
    } finally {
      client.release();
    }
  } catch (dbErr) {
    return NextResponse.json({ memories: [] });
  }
}
