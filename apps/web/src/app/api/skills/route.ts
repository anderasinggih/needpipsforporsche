import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export interface DefaultSkill {
  title: string;
  description: string;
  timeframes: string[];
  rules_checklist: { id: string; text: string; required: boolean }[];
  risk_reward_min: number;
}

// Built-in skills derived from real quantitative / risk management skills
const PRESET_SKILLS: DefaultSkill[] = [
  {
    title: "Capital Preservation & Drawdown Circuit Breaker",
    description: "Sistem kontrol resiko portofolio berbasis skill risk-management: batas drawdown harian maksimal -3%, toleransi akun -15%, dan mandatory cooling period saat terkena limit.",
    timeframes: ["M1", "M5", "M15"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "rm_1", text: "Kerugian harian belum menyentuh circuit breaker max -3% akun", required: true },
      { id: "rm_2", text: "Total drawdown akun saat ini masih di bawah -15%", required: true },
      { id: "rm_3", text: "Tidak sedang dalam kondisi revenge trading atau cooling period", required: true },
      { id: "rm_4", text: "Maksimal posisi aktif bersamaan tidak melebihi 3 posisi", required: false },
    ],
  },
  {
    title: "Fixed Fractional & Volatility-Adjusted Sizing",
    description: "Sizing berbasis skill position-sizing: membatasi risiko maksimal 1-2% modal per trade menggunakan kalkulasi jarak Stop Loss dan penyesuaian ATR.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 2.0,
    rules_checklist: [
      { id: "ps_1", text: "Risk per trade telah dihitung presisi 1.0% - 2.0% dari saldo", required: true },
      { id: "ps_2", text: "Jarak stop loss disesuaikan dengan volatilitas pasar (ATR 14)", required: true },
      { id: "ps_3", text: "Lot size dihitung dari: (Modal x Risk%) / Jarak Stop Loss", required: true },
      { id: "ps_4", text: "Tidak menambah lot (averaging down) pada posisi floating minus", required: true },
    ],
  },
  {
    title: "Systematic Exit & Multi-Tranche Take Profit",
    description: "Aturan eksekusi keluar berbasis skill exit-strategies: ATR 2.0x trailing stop, pembagian target take-profit terukur, dan pemindahan SL ke Breakeven saat 1:1 tercapai.",
    timeframes: ["M1", "M5", "H1"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "es_1", text: "Stop Loss terpasang di level teknikal valid (bukan perkiraan emosional)", required: true },
      { id: "es_2", text: "Target Take Profit minimal 1:2.5 Risk-to-Reward ratio", required: true },
      { id: "es_3", text: "Rencana geser SL ke Breakeven (BE) saat profit mencapai 1R", required: true },
      { id: "es_4", text: "Trailing stop siap dijalankan mengikuti swing low/high baru", required: false },
    ],
  },
  {
    title: "Custom Quantitative Microstructure & Momentum",
    description: "Filter konfirmasi setup berbasis skill custom-indicators & web3-defi-trading: konfirmasi divergensi RSI, keselarasan volume, dan penolakan liquidity pool.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "ci_1", text: "Struktur pasar 1m/5m selaras dengan tren timeframe utama", required: true },
      { id: "ci_2", text: "Terjadi liquidity sweep atau pantulan dari zona support/resistance kunci", required: true },
      { id: "ci_3", text: "RSI 14 tidak berada di area overbought ekstrem saat Buy atau oversold saat Sell", required: true },
      { id: "ci_4", text: "Volume transaksi mengonfirmasi pergerakan candle penembusan", required: false },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
      // Auto seed if table is empty
      const countRes = await client.query('SELECT COUNT(*) as count FROM trading_skills');
      const count = parseInt(countRes.rows[0]?.count || '0', 10);

      if (count === 0) {
        for (const skill of PRESET_SKILLS) {
          await client.query(
            `INSERT INTO trading_skills (title, description, timeframes, rules_checklist, risk_reward_min)
             VALUES ($1, $2, $3, $4, $5)`,
            [skill.title, skill.description, skill.timeframes, JSON.stringify(skill.rules_checklist), skill.risk_reward_min]
          );
        }
      }

      const result = await client.query(
        `SELECT id, title, description, timeframes, rules_checklist, risk_reward_min, created_at, updated_at
         FROM trading_skills
         ORDER BY created_at ASC`
      );

      // Parse JSON rules_checklist if needed
      const skills = result.rows.map((row) => ({
        ...row,
        rules_checklist: typeof row.rules_checklist === 'string' ? JSON.parse(row.rules_checklist) : row.rules_checklist,
      }));

      return NextResponse.json({ skills });
    } finally {
      client.release();
    }
  } catch (error) {
    // If DB is offline or error, return the presets directly so UI never breaks!
    const mockSkills = PRESET_SKILLS.map((skill, idx) => ({
      id: `preset_${idx + 1}`,
      ...skill,
      created_at: new Date().toISOString(),
    }));
    return NextResponse.json({ skills: mockSkills });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, timeframes, rulesChecklist, riskRewardMin } = body;

    if (!title || !rulesChecklist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO trading_skills (title, description, timeframes, rules_checklist, risk_reward_min)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, timeframes, rules_checklist, risk_reward_min, created_at`,
        [title, description || '', timeframes || null, JSON.stringify(rulesChecklist), riskRewardMin || 2.0]
      );
      return NextResponse.json({ skill: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
}
