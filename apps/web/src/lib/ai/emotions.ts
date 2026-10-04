import type {
  AgentOpinion,
  Bias,
  CouncilEmotionEntry,
  Emotion,
  EmotionMeta,
  EmotionalState,
} from "./types";

// ---------------------------------------------------------------------------
// Emotion + psychology engine.
// Every council mind reports an emotional state; the state is not decoration —
// impulsive / greedy / overconfident minds get their consensus vote discounted
// or vetoed, because those are exactly the states that bleed accounts.
// ---------------------------------------------------------------------------

export const EMOTION_META: Record<Emotion, EmotionMeta> = {
  NEUTRAL: { emotion: "NEUTRAL", icon: "😐", label: "Netral", tone: "neutral", valence: 0, arousal: 35, voteFactor: 1 },
  CONFIDENT: { emotion: "CONFIDENT", icon: "😎", label: "Yakin", tone: "constructive", valence: 0.55, arousal: 60, voteFactor: 1.05 },
  CAUTIOUS: { emotion: "CAUTIOUS", icon: "🤨", label: "Hati-hati", tone: "neutral", valence: 0.05, arousal: 40, voteFactor: 0.98 },
  GREEDY: { emotion: "GREEDY", icon: "🤑", label: "Serakah", tone: "destructive", valence: 0.9, arousal: 85, voteFactor: 0.62 },
  FEARFUL: { emotion: "FEARFUL", icon: "😟", label: "Takut", tone: "destructive", valence: -0.8, arousal: 65, voteFactor: 0.7 },
  AGGRESSIVE: { emotion: "AGGRESSIVE", icon: "😡", label: "Agresif", tone: "destructive", valence: 0.4, arousal: 95, voteFactor: 0.7 },
  PATIENT: { emotion: "PATIENT", icon: "🧘", label: "Sabar", tone: "constructive", valence: 0.2, arousal: 25, voteFactor: 1.08 },
  ANXIOUS: { emotion: "ANXIOUS", icon: "😰", label: "Cemas", tone: "destructive", valence: -0.55, arousal: 80, voteFactor: 0.78 },
  DISCIPLINED: { emotion: "DISCIPLINED", icon: "🧊", label: "Disiplin", tone: "constructive", valence: 0.3, arousal: 30, voteFactor: 1.12 },
  IMPULSIVE: { emotion: "IMPULSIVE", icon: "⚡", label: "Impulsif", tone: "destructive", valence: 0.45, arousal: 90, voteFactor: 0.5 },
  CALM: { emotion: "CALM", icon: "😌", label: "Tenang", tone: "constructive", valence: 0.25, arousal: 20, voteFactor: 1.08 },
  EXCITED: { emotion: "EXCITED", icon: "🤩", label: "Bersemangat", tone: "caution", valence: 0.65, arousal: 85, voteFactor: 0.82 },
  WARY: { emotion: "WARY", icon: "🧐", label: "Waspada", tone: "neutral", valence: -0.1, arousal: 45, voteFactor: 1.04 },
  FOCUSED: { emotion: "FOCUSED", icon: "🎯", label: "Fokus", tone: "constructive", valence: 0.3, arousal: 50, voteFactor: 1.1 },
  FRUSTRATED: { emotion: "FRUSTRATED", icon: "😤", label: "Frustrasi", tone: "caution", valence: -0.45, arousal: 80, voteFactor: 0.72 },
  OVERCONFIDENT: { emotion: "OVERCONFIDENT", icon: "😬", label: "Terlalu Yakin", tone: "destructive", valence: 0.6, arousal: 70, voteFactor: 0.45 },
  OPTIMISTIC: { emotion: "OPTIMISTIC", icon: "🌤️", label: "Optimis", tone: "constructive", valence: 0.5, arousal: 55, voteFactor: 1.02 },
};

export const ALL_EMOTIONS = Object.keys(EMOTION_META) as Emotion[];

export const DESTRUCTIVE_STATES: Emotion[] = [
  "IMPULSIVE",
  "GREEDY",
  "OVERCONFIDENT",
  "AGGRESSIVE",
  "ANXIOUS",
  "FRUSTRATED",
];

export const normalizeEmotion = (raw: unknown): Emotion => {
  if (typeof raw !== "string") return "NEUTRAL";
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_") as Emotion;
  return EMOTION_META[key] ? key : "NEUTRAL";
};

export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

/** Derive a believable emotional state when the model omits / mangles the field. */
export const deriveEmotion = (opts: {
  bias: Bias;
  confidence: number;
  mtfVerdict?: string;
  regime?: string;
  disciplineHint?: number;
}): { emotion: Emotion; intensity: number } => {
  const { bias, confidence, mtfVerdict, regime, disciplineHint = 60 } = opts;

  if (bias === "NEUTRAL") {
    if (confidence < 45) return { emotion: "WARY", intensity: 55 };
    return { emotion: "CALM", intensity: Math.round(30 + confidence / 5) };
  }

  const conflicted = mtfVerdict === "CONFLICT" || regime === "CRISIS";
  if (conflicted && confidence < 70) {
    return { emotion: confidence < 55 ? "ANXIOUS" : "WARY", intensity: Math.round(55 + (70 - confidence) / 3) };
  }
  if (disciplineHint >= 75) {
    if (confidence >= 78) return { emotion: "DISCIPLINED", intensity: Math.round(40 + confidence / 6) };
    if (confidence >= 58) return { emotion: "PATIENT", intensity: Math.round(45 + confidence / 5) };
  }
  if (confidence >= 82) return { emotion: "CONFIDENT", intensity: Math.round(45 + confidence / 4) };
  if (confidence >= 66) return { emotion: "CAUTIOUS", intensity: Math.round(50 + confidence / 4) };
  if (confidence >= 52) return { emotion: "WARY", intensity: Math.round(50 + confidence / 3) };
  return { emotion: confidence < 40 ? "FEARFUL" : "CAUTIOUS", intensity: 60 };
};

/** Derive the psychological profile of a mind when the model omits the block. */
export const derivePsychology = (opts: {
  bias: Bias;
  confidence: number;
  emotion: Emotion;
  mtfVerdict?: string;
  regime?: string;
}): AgentOpinion["psychology"] => {
  const { bias, confidence, emotion, mtfVerdict, regime } = opts;
  const meta = EMOTION_META[emotion] || EMOTION_META.NEUTRAL;
  const conflicted = mtfVerdict === "CONFLICT";
  const chaos = regime === "CRISIS" || regime === "EXPANSION";

  let discipline = clamp(72 + (confidence - 60) * 0.35 + (meta.tone === "constructive" ? 10 : 0));
  let patience = clamp(68 + (meta.arousal < 45 ? 16 : -14) + (conflicted ? 10 : 0));
  const fomoResistance = clamp(66 - (meta.arousal - 45) * 0.9 + (meta.valence > 0.7 ? -12 : 0));
  let executionReadiness = clamp(40 + confidence * 0.5 - (conflicted ? 22 : 0) - (chaos ? 14 : 0));

  if (bias === "NEUTRAL") executionReadiness = clamp(executionReadiness * 0.55);

  const riskFlags: string[] = [];
  if (emotion === "IMPULSIVE") riskFlags.push("Masuk sebelum konfirmasi lengkap");
  if (emotion === "GREEDY") riskFlags.push("TP rakus, risiko diabaikan");
  if (emotion === "OVERCONFIDENT") riskFlags.push("Kepercayaan diri melampaui bukti");
  if (emotion === "ANXIOUS" || emotion === "FEARFUL") riskFlags.push("Fear paralysis, hesitate entry");
  if (emotion === "AGGRESSIVE") riskFlags.push("Terlalu agresif mengejar harga");
  if (emotion === "FRUSTRATED") riskFlags.push("Risiko revenge trading");
  if (emotion === "EXCITED") riskFlags.push("Terbawa euforia momentum");
  if (conflicted) riskFlags.push("Sinyal timeframe tinggi bertentangan");
  if (chaos) riskFlags.push("Volatilitas ekstraf, risiko slippage tinggi");
  if (fomoResistance < 55) riskFlags.push("Rentan FOMO");

  const disciplineWord = discipline >= 70 ? "berpegang pada aturan" : "hanya sopan dengan aturan";
  const patienceWord = patience >= 70 ? "sabar menunggu konfirmasi" : "terburu-buru masuk";
  const read =
    bias === "NEUTRAL"
      ? `${meta.label} (${Math.round(meta.arousal)}%): tidak ada edge yang layak dikomit, jadi bertahan di luar pasar adalah keputusan paling benar.`
      : `${meta.label} (${Math.round(meta.arousal)}%): ${disciplineWord}, ${patienceWord}.`;

  return {
    discipline: Math.round(clamp(discipline)),
    patience: Math.round(clamp(patience)),
    fomoResistance: Math.round(clamp(fomoResistance)),
    executionReadiness: Math.round(clamp(executionReadiness)),
    riskFlags,
    read,
  };
};

/** Aggregate per-agent emotions into one council emotional state. */
export const buildEmotionalState = (agents: AgentOpinion[]): EmotionalState => {
  const active = agents.filter((a) => a.status === "active");

  if (active.length === 0) {
    return {
      dominantEmotion: "NEUTRAL",
      dominantEmotionIcon: "😐",
      dominantEmotionLabel: "Netral",
      dominantEmotionTone: "neutral",
      emotionMeter: 15,
      moodIndex: 0,
      councilMood: "Dewan sunyi, tidak ada pikiran yang berkontribusi. Mode protektif aktif.",
      coherence: 0,
      emotionSpread: 0,
      breakdown: [],
      psychology: {
        discipline: 50,
        patience: 70,
        fomoResistance: 70,
        executionReadiness: 0,
        averageIntensity: 15,
        summary: "Tidak ada input emosi dari dewan; sistem menahan eksekusi.",
        flags: ["Dewan tanpa sinyal"],
      },
      warning: "Tidak ada agen yang berkontribusi, keputusan diambil murni oleh algoritma kuantitatif.",
    };
  }

  const buckets = new Map<Emotion, { weighted: number; count: number; intensity: number }>();
  let weightedValence = 0;
  let weightedArousal = 0;
  let totalWeight = 0;
  let intensitySum = 0;

  for (const agent of active) {
    const meta = EMOTION_META[agent.emotion] || EMOTION_META.NEUTRAL;
    const intensity = clamp(agent.emotionIntensity, 0, 100);
    // Emotional weight is deliberately independent of the consensus vote: a vetoed
    // mind still contributes its (destructive) state to the room's mood, otherwise
    // a zeroed vote would erase the very emotion the veto was raised for.
    const weight = (0.4 + clamp(agent.confidence, 0, 100) / 250) * (0.6 + intensity / 160);

    const entry = buckets.get(agent.emotion) || { weighted: 0, count: 0, intensity: 0 };
    entry.weighted += weight;
    entry.count += 1;
    entry.intensity += intensity;
    buckets.set(agent.emotion, entry);

    weightedValence += meta.valence * weight;
    weightedArousal += meta.arousal * weight;
    totalWeight += weight;
    intensitySum += intensity;
  }

  const breakdown: CouncilEmotionEntry[] = Array.from(buckets.entries())
    .map(([emotion, data]) => ({
      emotion,
      icon: EMOTION_META[emotion].icon,
      label: EMOTION_META[emotion].label,
      tone: EMOTION_META[emotion].tone,
      count: data.count,
      avgIntensity: Math.round(data.intensity / data.count),
      weight: Number(((data.weighted / totalWeight) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.weight - a.weight);

  const dominant = breakdown[0];
  const dominantMeta = EMOTION_META[dominant.emotion];
  const moodIndex = Math.round((weightedValence / totalWeight) * 100);
  const emotionMeter = Math.round(
    Math.min(100, intensitySum / active.length) * 0.6 + (weightedArousal / totalWeight) * 0.4,
  );
  const coherence = Math.round(dominant.weight);
  const emotionSpread = 100 - coherence;

  const psychology = {
    discipline: Math.round(active.reduce((s, a) => s + a.psychology.discipline, 0) / active.length),
    patience: Math.round(active.reduce((s, a) => s + a.psychology.patience, 0) / active.length),
    fomoResistance: Math.round(active.reduce((s, a) => s + a.psychology.fomoResistance, 0) / active.length),
    executionReadiness: Math.round(active.reduce((s, a) => s + a.psychology.executionReadiness, 0) / active.length),
    averageIntensity: Math.round(intensitySum / active.length),
    summary: "",
    flags: Array.from(new Set(active.flatMap((a) => a.psychology.riskFlags))).slice(0, 6),
  };

  const destructiveShare = breakdown
    .filter((b) => DESTRUCTIVE_STATES.includes(b.emotion))
    .reduce((s, b) => s + b.weight, 0);

  psychology.summary = buildPsychologySummary(psychology, dominantMeta.label, destructiveShare);

  let warning: string | undefined;
  if (destructiveShare >= 45) {
    warning = `${Math.round(destructiveShare)}% bobot emosi dewan berada di state destruktif (${breakdown
      .filter((b) => DESTRUCTIVE_STATES.includes(b.emotion))
      .map((b) => `${b.icon} ${b.label}`)
      .join(", ")}) — bobot vote dibatasi, harga tidak dikejar.`;
  } else if (psychology.executionReadiness < 45) {
    warning = "Readiness eksekusi antar-agen rendah, setup cenderung berakhir sebagai WAIT.";
  } else if (psychology.fomoResistance < 50) {
    warning = "Ketahanan FOMO antar-agen lemah, hati-hati mengejar entry.";
  }

  return {
    dominantEmotion: dominant.emotion,
    dominantEmotionIcon: dominantMeta.icon,
    dominantEmotionLabel: dominantMeta.label,
    dominantEmotionTone: dominantMeta.tone,
    emotionMeter,
    moodIndex,
    councilMood: buildMoodNarrative(dominantMeta.label, dominant.count, active.length, moodIndex, coherence),
    coherence,
    emotionSpread,
    breakdown,
    psychology,
    warning,
  };
};

const buildPsychologySummary = (
  p: EmotionalState["psychology"],
  dominantLabel: string,
  destructiveShare: number,
) => {
  const disciplineWord = p.discipline >= 72 ? "disiplin tinggi" : p.discipline >= 55 ? "disiplin cukup" : "disiplin rendah";
  const patienceWord = p.patience >= 72 ? "sabar menunggu" : p.patience >= 55 ? "cenderung gelisah" : "tidak sabaran";
  const fomoWord = p.fomoResistance >= 65 ? "tahan FOMO" : p.fomoResistance >= 45 ? "rawan FOMO" : "sangat rentan FOMO";
  const readyWord =
    p.executionReadiness >= 70
      ? "siap eksekusi"
      : p.executionReadiness >= 45
      ? "eksekusi bersyarat"
      : "belum siap eksekusi";
  const destructive =
    destructiveShare >= 30
      ? ` Namun ${Math.round(destructiveShare)}% bobot emosi destruktif, veto psikologis diaktifkan.`
      : "";
  return `Dewan dominan ${dominantLabel}: ${disciplineWord}, ${patienceWord}, ${fomoWord}, ${readyWord}.${destructive}`;
};

const buildMoodNarrative = (
  dominantLabel: string,
  dominantCount: number,
  total: number,
  moodIndex: number,
  coherence: number,
) => {
  const share = Math.round((dominantCount / Math.max(1, total)) * 100);
  const mood =
    moodIndex >= 35 ? "cenderung serakah" : moodIndex <= -35 ? "cenderung takut" : "seimbang secara emosional";
  const unity =
    coherence >= 70 ? "Dewan serempak" : coherence >= 40 ? "Dewan cenderung satu arah" : "Dewan terpecah";
  return `${unity} ber-${dominantLabel.toLowerCase()} (${dominantCount}/${total} agen, ${share}% kursi) dan ${mood} (indeks mood ${moodIndex > 0 ? "+" : ""}${moodIndex}).`;
};

export const psychologyFlagsFor = (agents: AgentOpinion[]) =>
  Array.from(new Set(agents.filter((a) => a.status === "active").flatMap((a) => a.psychology.riskFlags)));
