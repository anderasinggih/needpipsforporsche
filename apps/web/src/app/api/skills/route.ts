import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export interface DefaultSkill {
  title: string;
  description: string;
  timeframes: string[];
  rules_checklist: { id: string; text: string; required: boolean }[];
  risk_reward_min: number;
}

const PRESET_SKILLS: DefaultSkill[] = [
  {
    title: "Capital Preservation & Drawdown Circuit Breaker",
    description: "Systematic portfolio risk control: enforced daily loss ceiling (-3% equity), maximum account drawdown threshold (-15%), and mandatory trading halt upon violation.",
    timeframes: ["M1", "M5", "M15"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "rm_1", text: "Daily realized loss is strictly within the -3% equity circuit breaker", required: true },
      { id: "rm_2", text: "Total account drawdown from peak remains safely below -15%", required: true },
      { id: "rm_3", text: "No emotional revenge trading or active cooling period in effect", required: true },
      { id: "rm_4", text: "Maximum concurrent active exposure is limited to 3 positions", required: false },
    ],
  },
  {
    title: "Fixed Fractional & Volatility-Adjusted Sizing",
    description: "Quantitative sizing protocol: risk capped at 1.0%–2.0% per trade derived from exact Stop Loss distance and 14-period ATR volatility calibration.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 2.0,
    rules_checklist: [
      { id: "ps_1", text: "Risk per trade is calculated precisely at 1.0%–2.0% of account equity", required: true },
      { id: "ps_2", text: "Stop loss distance is calibrated against market volatility (ATR 14)", required: true },
      { id: "ps_3", text: "Position sizing strictly adheres to: (Equity x Risk%) / Price Risk", required: true },
      { id: "ps_4", text: "Zero averaging down into floating drawdown positions", required: true },
    ],
  },
  {
    title: "Mean-Reversion & Ornstein-Uhlenbeck Z-Score",
    description: "Statistical mean reversion: Hurst exponent < 0.5 confirm stationarity, z-score stretch > 2.0σ against 20-period moving average, with strict time-decay exits.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "mr_1", text: "Price is stretched beyond 2.0 standard deviations (Bollinger/Z-Score) from mean", required: true },
      { id: "mr_2", text: "Current market regime confirms range-bound oscillation (ADX < 25 or Hurst < 0.5)", required: true },
      { id: "mr_3", text: "Take profit mapped to 20-SMA baseline mean reversion target", required: true },
      { id: "mr_4", text: "Hard stop-loss placed 0.5σ beyond swing extreme to prevent trending breakout traps", required: true },
    ],
  },
  {
    title: "Market Microstructure & Order Book Imbalance",
    description: "Institutional orderflow execution: Glosten-Milgrom adverse selection modeling, bid-ask queue imbalance, and volume delta absorption at key price nodes.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "micro_1", text: "Order book imbalance / aggressive trade flow confirms absorption at key level", required: true },
      { id: "micro_2", text: "Effective spread is tight with high liquidity depth, minimizing slippage", required: true },
      { id: "micro_3", text: "Clean break and retest of institutional high-volume node (HVN / POC)", required: true },
      { id: "micro_4", text: "Trade entered in direction of informed institutional volume surge", required: false },
    ],
  },
  {
    title: "Market Regime Detection & Trend Following",
    description: "Adaptive regime filtering: separates high-volatility trends from chop using ATR volatility expansion, 50/200 EMA structure, and directional momentum.",
    timeframes: ["M5", "M15", "H1"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "reg_1", text: "Macro higher-timeframe trend aligns with setup direction (Price > EMA 50)", required: true },
      { id: "reg_2", text: "Volatility regime is expanding (ATR expanding above 20-period average)", required: true },
      { id: "reg_3", text: "Entry executed on pullback to structural dynamic support/resistance", required: true },
      { id: "reg_4", text: "Trailing stop activated once position gains 1.5R to capture regime trend", required: false },
    ],
  },
  {
    title: "Systematic Exit & Multi-Tranche Take Profit",
    description: "Disciplined exit management: minimum 1:2.5 Risk-to-Reward ratio, automated Breakeven trigger at 1R profit, and dynamic 2.0x ATR trailing stop.",
    timeframes: ["M1", "M5", "H1"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "es_1", text: "Stop loss placed at a structural invalidation level prior to entry", required: true },
      { id: "es_2", text: "Target Take Profit satisfies minimum 1:2.5 Risk-to-Reward ratio", required: true },
      { id: "es_3", text: "Stop loss moved to Breakeven once 1R target is reached", required: true },
      { id: "es_4", text: "Trailing stop active along trailing swing highs/lows", required: false },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
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

      const skills = result.rows.map((row) => ({
        ...row,
        rules_checklist: typeof row.rules_checklist === 'string' ? JSON.parse(row.rules_checklist) : row.rules_checklist,
      }));

      return NextResponse.json({ skills });
    } finally {
      client.release();
    }
  } catch (error) {
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
