import { NextRequest, NextResponse } from "next/server";
import { callProviderWithRetry, sanitizeSlots, type KeySlotPayload } from "@/lib/ai/providers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userQuery, symbol, price, timeframe, keySlots, agentOpinions, signal, chatHistory } = body;

    if (!userQuery || typeof userQuery !== "string") {
      return NextResponse.json({ error: "Pertanyaan wajib diisi" }, { status: 400 });
    }

    const slots = sanitizeSlots(keySlots);
    if (!slots.length) {
      return NextResponse.json(
        { error: "Belum ada API Key yang terpasang di /owner/key." },
        { status: 400 }
      );
    }

    // Determine target agent from user query mention (e.g. "@Agent 3" or "@Liquidity") or default to Chief
    let targetSlot = slots[0];
    let roleLabel = "Agent 1 (Chief Synthesizer)";

    const qLower = userQuery.toLowerCase();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (
        qLower.includes(`agent ${i + 1}`) ||
        qLower.includes(`slot_${i + 1}`) ||
        (s.label && qLower.includes(s.label.toLowerCase()))
      ) {
        targetSlot = s;
        roleLabel = s.label || `Agent ${i + 1}`;
        break;
      }
    }

    // If query targets risk/SL without specific agent, route to slot 5 (Risk) if available
    if (targetSlot === slots[0] && (qLower.includes("sl") || qLower.includes("stop loss") || qLower.includes("risiko") || qLower.includes("cut loss"))) {
      const riskSlot = slots.find((s) => s.id === "slot_5") || slots[4];
      if (riskSlot && riskSlot.apiKey) {
        targetSlot = riskSlot;
        roleLabel = riskSlot.label || "Agent 5 (Volatility & Risk)";
      }
    }

    if (!targetSlot.apiKey) {
      return NextResponse.json(
        { error: `Slot ${roleLabel} tidak memiliki API key aktif.` },
        { status: 400 }
      );
    }

    // Context from current council evaluation
    const councilSummary = Array.isArray(agentOpinions)
      ? agentOpinions.map((a: any) => `- ${a.agentName} [${a.bias}]: ${a.keyObservation}`).join("\n")
      : "(Belum ada data evaluasi dewan)";

    // Format previous conversation turns if provided
    let historyContext = "";
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const recentTurns = chatHistory.slice(-8); // keep last 8 messages for context efficiency
      historyContext = "\nRIWAYAT PERCAKAPAN SEBELUMNYA DENGAN TRADER:\n" +
        recentTurns.map((h: any) => `${h.sender || "User"}: ${h.text || ""}`).join("\n") +
        "\n";
    }

    const prompt = `KAMU ADALAH: ${roleLabel} di Dewan Scalping AI Institusional "Need Pips For Porsche".
INSTRUMEN: ${symbol} (${timeframe}) | HARGA SEKARANG: $${price}
KEPUTUSAN DEWAN SEBELUMNYA: ${signal || "EVALUATING"}

RINGKASAN OPINI ANGGOTA DEWAN LAINNYA:
${councilSummary}
${historyContext}
PERTANYAAN / SANGGAHAN DARI TRADER (USER) SAAT INI:
"${userQuery}"

TUGASMU:
Jawab pertanyaan trader secara langsung, tajam, objektif, dan profesional sebagai pakar kuantitatif/spesialis trading dengan mengingat konteks riwayat percakapan sebelumnya jika ada.
- Berikan argumentasi berbasis angka pasar konkret (bukan motivasi klise).
- Jika trader berniat melanggar disiplin (seperti memperlebar SL, revenge trade, fomo entry), TEGUR DENGAN KERAS berbasis probabilitas matematika.
- Panjang jawaban: 2-4 kalimat padat dalam Bahasa Indonesia profesional.
- Jawab langsung tanpa salam bertele-tele.`;

    const answer = await callProviderWithRetry(targetSlot, prompt, {
      timeoutMs: 14000,
      json: false,
    });

    return NextResponse.json({
      sender: roleLabel,
      agentId: targetSlot.id,
      text: String(answer || "").trim(),
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error("Council Live Chat Error:", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memproses tanya jawab ke model AI." },
      { status: 500 }
    );
  }
}
