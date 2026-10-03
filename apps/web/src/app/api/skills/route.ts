import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export interface DefaultSkill {
  title: string;
  description: string;
  timeframes: string[];
  rules_checklist: { id: string; text: string; required: boolean }[];
  risk_reward_min: number;
}

// Built-in quantitative strategies from trading skills library (in professional English)
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
  {
    title: "Microstructure & Orderflow Momentum",
    description: "Institutional setup confirmation: liquidity sweeps, multi-timeframe trend alignment, RSI divergence filtering, and volume expansion.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "ci_1", text: "1m/5m market structure aligned with primary higher-timeframe trend", required: true },
      { id: "ci_2", text: "Valid liquidity sweep or sharp rejection observed at key support/resistance", required: true },
      { id: "ci_3", text: "RSI 14 confirms momentum without extreme overbought/oversold exhaustion", required: true },
      { id: "ci_4", text: "Breakout candle confirmed by expanding volume footprint", required: false },
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
