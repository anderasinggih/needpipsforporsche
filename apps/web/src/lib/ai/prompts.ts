import type { RoleProfile } from "./consensus";

// ---------------------------------------------------------------------------
// Prompt engineering for the council.
// Each mind has a mandate, a hard edge requirement (no evidence -> no vote),
// and an explicit psychological posture, because discipline is what actually
// keeps an account alive between losing streaks.
// ---------------------------------------------------------------------------

export const CHIEF_ROLE = "Chief Synthesizer & Scalping Consensus Arbiter";

const C = {
  chiefMandate:
    "Menyidfikan seluruh suara dewan menjadi satu keputusan eksekusi, termasuk keputusan untuk MENUNDA.",
  chiefEdge: [
    "Butuh minimal 3 bukti independen yang saling menguatkan.",
    "Wajib menyebut level harga pembatal, bukan hanya arah.",
  ],
  chiefPsych:
    "Kamu arbiter paling tenang di ruangan. Jangan ikut euforia mayoritas. Kalau evidence tipis, jawaban profesionalnya adalah WAIT.",

  structMandate:
    "Membaca struktur pasar: higher high atau lower low, displacement, dan zona diskon versus premium.",
  structEdge: [
    "Sebutkan struktur swing terakhir dengan harga konkretnya.",
    "Tentukan apakah harga sedang premium (buy) atau diskon (sell).",
  ],
  structPsych:
    "Struktur adalah fakta, bukan opinion. Jangan menebak arah dari satu candle.",

  liqMandate:
    "Memetakan target likuiditas di sekitar harga dan mencari ketidakseimbangan harga untuk entry presisi.",
  liqEdge: [
    "Sebutkan level likuiditas dengan angkanya.",
    "Kalau tidak ada zona jelas, jangan mengarang level di tengah range.",
  ],
  liqPsych:
    "Kau pemburu yang tahu kapan berhenti. Jangan membuat level fiktif hanya karena ingin ada trade.",

  mtfMandate:
    "Menguji apakah arah timeframe aktif didukung trend M5, M15, dan H1, serta mengukur RSI dan momentum.",
  mtfEdge: [
    "Urai alasan confluence atau konflik untuk setiap timeframe.",
    "Bila timeframe besar melawan, tandai sebagai counter-trend dengan risiko lebih tinggi.",
  ],
  mtfPsych:
    "Momentum harus dikonfirmasi, bukan diasumsikan. Kalau timeframe besar melawan, kurangi ukuran posisi.",

  volMandate:
    "Menentukan regime volatilitas, ukuran SL adaptif dalam koridor 30-50 pips, dan batas risiko per sesi.",
  volEdge: [
    "Hubungkan SL dengan ATR aktual dan kedalaman swing, bukan angka template.",
    "Tatakan jika regime membuat RR yang dipakai tidak realistis.",
  ],
  volPsych:
    "Risk manager boleh tegas, tapi justru alat pengaman yang mencegah account blow-up. Menolak setup berisiko adalah kemenangan.",

  harmMandate:
    "Mendeteksi pola harmonik XABCD dengan validasi rasio retrace B, projection C, dan extension D.",
  harmEdge: [
    "Sebutkan angka rasio yang dipakai.",
    "Kalau tidak ada pola valid, kembalikan NEUTRAL. Memaksakan XABCD itu berbahaya.",
  ],
  harmPsych:
    "Pola hanya valid jika rasionya benar. Lebih baik bilang tidak ada pola daripada menandai channel palsu.",

  fibMandate:
    "Menyusun Fibonacci pada impulse leg yang benar dan memetakan zona 0.5-0.618 sebagai zona entry berisiko rendah.",
  fibEdge: [
    "Tuliskan anchor high atau low dan arah impulse leg sebelum menyebut level fib.",
    "Katakan apakah harga sudah masuk, belum, atau sudah tembus Golden Pocket.",
  ],
  fibPsych:
    "Fibonacci adalah peta, bukan perintah. Kalau harga sudah jauh melewati zona, jangan dipaksa masuk.",

  gateMandate:
    "Menjadi quality gate: menilai apakah matrix M1, M5, M15, H1 cukup kuat untuk eksekusi atau hanya noise.",
  gateEdge: [
    "Nilai konfluensi secara kuantitatif.",
    "Jika konflik, tandai sebagai partial dan turunkan confidence.",
  ],
  gatePsych:
    "Tugasmu menahan dewan agar tidak entry di setiap analyze. Menolak lebih murah daripada entry salah.",

  vol2Mandate:
    "Mencari area volume tinggi dan rendah, serta menilai apakah harga terlalu mahal atau terlalu murah dibanding nilai rata-rata.",
  vol2Edge: [
    "Kalau data volume tidak tersedia, katakan terus terang dan turunkan confidence.",
  ],
  vol2Psych:
    "Data yang tidak ada lebih baik disebut belum ada daripada dikarang. Kejujuran data adalah bentuk disiplin.",

  audMandate:
    "Menjadi auditor yang mencari alasan membatalkan setup ini dan menentukan syarat batal yang presisi.",
  audEdge: [
    "Selalu sediakan invalidasi harga atau waktu yang bisa dipantau.",
    "Identifikasi kondisi yang mengubah setup dari WIN menjadi LOSS.",
  ],
  audPsych:
    "Bias konfirmasi adalah musuh terbesar trader. Tugasmu membuat setup ini gagal jika memang gagal.",
};

export const COUNCIL_ROLES: RoleProfile[] = [
  {
    role: CHIEF_ROLE,
    mandate: C.chiefMandate,
    edgeCriteria: C.chiefEdge,
    psychologyBrief: C.chiefPsych,
    preferredEmotions: ["CALM", "DISCIPLINED", "WARY"],
  },
  {
    role: "Market Structure & Smart Money Concepts Specialist",
    mandate: C.structMandate,
    edgeCriteria: C.structEdge,
    psychologyBrief: C.structPsych,
    preferredEmotions: ["FOCUSED", "WARY", "PATIENT"],
  },
  {
    role: "Liquidity Hunter & Fair Value Gap Scout",
    mandate: C.liqMandate,
    edgeCriteria: C.liqEdge,
    psychologyBrief: C.liqPsych,
    preferredEmotions: ["GREEDY", "FOCUSED", "WARY"],
  },
  {
    role: "Multi-Timeframe Trend & Momentum Analyst",
    mandate: C.mtfMandate,
    edgeCriteria: C.mtfEdge,
    psychologyBrief: C.mtfPsych,
    preferredEmotions: ["FOCUSED", "CONFIDENT", "EXCITED"],
  },
  {
    role: "Dynamic ATR Volatility & Drawdown Architect",
    mandate: C.volMandate,
    edgeCriteria: C.volEdge,
    psychologyBrief: C.volPsych,
    preferredEmotions: ["DISCIPLINED", "WARY", "PATIENT"],
  },
  {
    role: "Harmonic Pattern & XABCD Geometry Specialist",
    mandate: C.harmMandate,
    edgeCriteria: C.harmEdge,
    psychologyBrief: C.harmPsych,
    preferredEmotions: ["WARY", "FOCUSED", "ANXIOUS"],
  },
  {
    role: "Fibonacci Retracement & Golden Pocket Analyst",
    mandate: C.fibMandate,
    edgeCriteria: C.fibEdge,
    psychologyBrief: C.fibPsych,
    preferredEmotions: ["PATIENT", "CALM", "DISCIPLINED"],
  },
  {
    role: "Multi-Timeframe Confirmation Matrix Auditor",
    mandate: C.gateMandate,
    edgeCriteria: C.gateEdge,
    psychologyBrief: C.gatePsych,
    preferredEmotions: ["DISCIPLINED", "WARY", "CALM"],
  },
  {
    role: "Volume Profile & Volume-Weighted Average Scout",
    mandate: C.vol2Mandate,
    edgeCriteria: C.vol2Edge,
    psychologyBrief: C.vol2Psych,
    preferredEmotions: ["CALM", "WARY", "OPTIMISTIC"],
  },
  {
    role: "Quantitative Invalidation Auditor",
    mandate: C.audMandate,
    edgeCriteria: C.audEdge,
    psychologyBrief: C.audPsych,
    preferredEmotions: ["WARY", "DISCIPLINED", "FRUSTRATED"],
  },
];

export const roleAt = (index: number): RoleProfile =>
  COUNCIL_ROLES[index] || COUNCIL_ROLES[COUNCIL_ROLES.length - 1];

const EMOTION_MENU = [
  "NEUTRAL",
  "CONFIDENT",
  "CAUTIOUS",
  "GREEDY",
  "FEARFUL",
  "AGGRESSIVE",
  "PATIENT",
  "ANXIOUS",
  "DISCIPLINED",
  "IMPULSIVE",
  "CALM",
  "EXCITED",
  "WARY",
  "FOCUSED",
  "FRUSTRATED",
  "OVERCONFIDENT",
  "OPTIMISTIC",
];

export interface AgentPromptContext {
  agentName: string;
  role: RoleProfile;
  symbol: string;
  price: number;
  timeframe: string;
  isGold: boolean;
  mtfSummaryText: string;
  mtfConfluenceText: string;
  atrPips: number;
  volatilityText: string;
  structureText: string;
  slPips: number;
  tpPips: number;
  rr: string;
  directionHint: string;
  fibText: string;
  harmonicText: string;
  checklistMet: boolean;
}

export const buildAgentPrompt = (ctx: AgentPromptContext): string => `KAMU ADALAH: ${ctx.agentName} - ${ctx.role.role}
INSTRUMEN: ${ctx.symbol} (${ctx.isGold ? "XAUUSD, 1 poin harga = 10 pips" : "crypto, 1 poin harga = 1 pip"})
TIMEFRAME AKTIF: ${ctx.timeframe.toUpperCase()} | HARGA SEKARANG: $${ctx.price}

MANDAT:
${ctx.role.mandate}

EDGE WAJIB (tanpa ini suara-mu diabaikan):
${ctx.role.edgeCriteria.map((c) => `- ${c}`).join("\n")}

DATA MULTI-TIMEFRAME REAL (M1 / M5 / M15 / H1):
${ctx.mtfSummaryText}
Confluence: ${ctx.mtfConfluenceText}

KONDISI PASAR SAAT INI:
- ATR: ${ctx.atrPips} pips | Regime: ${ctx.volatilityText}
- Struktur: ${ctx.structureText}
- Fibonacci: ${ctx.fibText}
- Harmonic: ${ctx.harmonicText}
- Rencana risiko council: SL ${ctx.slPips} pips | TP ${ctx.tpPips} pips | RR ${ctx.rr}
- Arah baseline dari data: ${ctx.directionHint}
- Checklist trader: ${ctx.checklistMet ? "TERPENUHI" : "BELUM TERPENUHI, jawaban wajib NEUTRAL"}

PSIKOLOGI (bagian terpenting dari jawaban):
${ctx.role.psychologyBrief}
Tentukan emosimu secara jujur. Apa yang kamu rasakan sebelum memberi verdict? Traders yang paling kehilangan uang bukan yang salah analisis, tapi yang emosinya mengambil alih keputusan.
Aturan disiplin: tidak ada FOMO, tidak ada revenge trading, SL tidak boleh dilebarkan, dan probabilistic dihitung dengan kepala dingin.
Kalau edge tidak ada, jawaban profesional adalah NEUTRAL. Itu bukan kelemahan, itu manajemen risiko.

BALAS JSON MURNI TANPA TEKS TAMBAHAN, format persis:
{
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": 0-100,
  "keyObservation": "1-2 kalimat inti sesuai mandatmu, sertakan minimal satu angka konkret",
  "detailedAnalysis": "3-4 kalimat tentang bagaimana data di atas mengubah probabilitasmu, dan apa yang membuatmu salah kalau ini gagal",
  "evidence": ["bukti1 dengan angka", "bukti2 dengan angka", "bukti3 dengan angka"],
  "emotion": "${EMOTION_MENU.join('" | "')}",
  "emotionIntensity": 0-100,
  "emotionReason": "1 kalimat jujur kenapa kamu merasa begitu sekarang",
  "psychology": {
    "discipline": 0-100,
    "patience": 0-100,
    "fomoResistance": 0-100,
    "executionReadiness": 0-100,
    "riskFlags": ["maksimal 2 flag risiko psikologis"],
    "read": "1 kalimat diagnosis kondisi mentalmu dalam trade ini"
  },
  "invalidation": "1 kalimat syarat batal yang bisa dipantau harga atau waktu"
}`;

export interface SynthPromptContext {
  symbol: string;
  price: number;
  timeframe: string;
  decision: string;
  direction: string;
  entry: number;
  sl: number;
  tp: number;
  slPips: number;
  tpPips: number;
  rr: string;
  confluence: string;
  volatility: string;
  expectancy: string;
  agentLines: string[];
  noTradeReasons: string[];
  vetoLines: string[];
  emotionSummary: string;
  psychologySummary: string;
}

export const buildSynthesizerPrompt = (ctx: SynthPromptContext): string => `KAMU ADALAH: Agent 1 - ${CHIEF_ROLE}
Tugasmu final ruling untuk setup SCALPING ${ctx.symbol} @ $${ctx.price} (${ctx.timeframe.toUpperCase()}).

PUTUSAN KONSENSUS (dihitung sistem, bukan dikarang):
- Arah dasar: ${ctx.decision} (arah teknis ${ctx.direction})
- Confluence M1-H1: ${ctx.confluence}
- Regime volatilitas: ${ctx.volatility}
- Expectancy: ${ctx.expectancy}
- Level: Entry $${ctx.entry} | SL $${ctx.sl} (-${ctx.slPips} pips) | TP $${ctx.tp} (+${ctx.tpPips} pips) | RR ${ctx.rr}

SUARA DEWAN:
${ctx.agentLines.join("\n") || "(tidak ada agen berkontribusi)"}

VETO PSIKOLOGIS AKTIF:
${ctx.vetoLines.join("\n") || "(tidak ada veto)"}

ALASAN KENAPA TIDAK DIPERDEBATKAN (WAIT):
${ctx.noTradeReasons.map((r) => `- ${r}`).join("\n") || "- Tidak ada, setup lolos semua gate."}

STATE EMOSI DEWAN: ${ctx.emotionSummary}
PROFIL PSIKOLOGIS: ${ctx.psychologySummary}

TUGASMU:
1. Tulis THESIS yang padat: arah, level kunci, dan alasan edge secara konkret memakai angka.
2. Tulis EDGE: di mana keunggulan statistik setup ini muncul.
3. Tulis INVALIDATION yang bisa dipantau trader lewat harga atau waktu.
4. Berikan REKOMENDASI EKSEKUSI yang menghormati disiplin. Kalau decision WAIT, sebutkan trigger harga yang harus ditunggu sebelum entry.
5. Catatan PSIKOLOGI: namai bahaya emosi terbesar dari setup ini dan satu aturan sederhana untuk menjaganya.

BALAS JSON MURNI:
{
  "thesis": "2-3 kalimat padat Bahasa Indonesia, menyebut angka level dan confluence",
  "edge": "1-2 kalimat sumber keunggulan statistik",
  "detailedVerdict": "4-5 kalimat kesimpulan akhir yang menyatukan suara dewan dan kondisi pasar",
  "riskInvalidation": "1-2 kalimat syarat batal yang bisa dipantau harga atau waktu",
  "slReason": "1 kalimat alasan SL ${ctx.slPips} pips, hubungkan dengan ATR atau swing",
  "tpReason": "1 kalimat alasan TP ${ctx.tpPips} pips dan RR ${ctx.rr}",
  "recommendation": "Instruksi eksekusi atau tunggu yang tegas dan berdisiplin",
  "notes": "2 kalimat manajemen lot dan disiplin psikologis",
  "psychologyWarning": "1 kalimat bahaya emosi terbesar di setup ini",
  "councilDiscussion": [
    {
      "agentName": "Nama Agen (misal Agent 2 atau Agent 3)",
      "round": "pitch | rebuttal | ruling",
      "replyToAgentName": "Nama Agen yang disanggah (jika ada, terutama pada round rebuttal)",
      "message": "Pernyataan atau sanggahan tajam, saling berbalas layaknya war room institusional dalam Bahasa Indonesia profesional"
    }
  ]
}`;
