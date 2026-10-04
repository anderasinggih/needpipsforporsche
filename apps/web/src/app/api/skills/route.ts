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
  {
    title: "Smart Money Concepts & Order Block Retest",
    description: "Institutional market structure: identification of Break of Structure (BOS), Change of Character (CHoCH), and unmitigated Order Blocks (OB) with Fair Value Gaps (FVG).",
    timeframes: ["M1", "M5", "M15"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "smc_1", text: "Clear Break of Structure (BOS) or Change of Character (CHoCH) confirmed", required: true },
      { id: "smc_2", text: "Price is retesting an unmitigated Order Block (OB) with liquidity sweep", required: true },
      { id: "smc_3", text: "Fair Value Gap (FVG) or imbalance exists between trigger leg candles", required: true },
      { id: "smc_4", text: "Stop loss tucked safely behind the invalidation wick of the Order Block", required: true },
    ],
  },
  {
    title: "Fibonacci Golden Pocket & Impulse Confluence",
    description: "High-probability retracement trading: anchoring to genuine impulse swings (> 1.5x ATR), waiting for 0.500 - 0.618 Golden Pocket retracement with reversal rejection.",
    timeframes: ["M1", "M5", "M15"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "fib_1", text: "Impulse leg is significant (> 1.5x ATR) with clean Swing High and Swing Low anchors", required: true },
      { id: "fib_2", text: "Price has pulled back directly into the 0.500 - 0.618 Golden Pocket zone", required: true },
      { id: "fib_3", text: "Rejection wick or confirmation candle closes in favor of trend direction", required: true },
      { id: "fib_4", text: "No entry if price blows through the 0.786 deep retracement invalidation", required: true },
    ],
  },
  {
    title: "Harmonic Geometry & XABCD Pattern Reversal",
    description: "Geometric ratio precision: valid Gartley, Bat, Butterfly, or Crab formations with strictly measured B retrace, C projection, and Potential Reversal Zone (PRZ) at point D.",
    timeframes: ["M1", "M5", "M15"],
    risk_reward_min: 2.5,
    rules_checklist: [
      { id: "harm_1", text: "X-A-B-C-D point geometry meets harmonic ratio tolerance (quality score > 50)", required: true },
      { id: "harm_2", text: "Point D has formed inside the Potential Reversal Zone (PRZ)", required: true },
      { id: "harm_3", text: "RSI shows divergence or overbought/oversold exhaustion at Point D", required: true },
      { id: "harm_4", text: "Target TP1 mapped to 0.382 CD and TP2 mapped to 0.618 CD extension", required: false },
    ],
  },
  {
    title: "Liquidity Sweep & Judas Swing Reversal",
    description: "Stop-hunt exploitation: detects liquidity raids above session highs or below session lows, followed by immediate displacement back inside value area.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "liq_1", text: "Price spiked and swept resting buy-side/sell-side liquidity (Asian/London High/Low)", required: true },
      { id: "liq_2", text: "Sharp displacement candle closes back inside the pre-sweep range (fakeout trap)", required: true },
      { id: "liq_3", text: "Volume spike on sweep candle followed by low-volume rejection", required: true },
      { id: "liq_4", text: "Take profit targeted at opposing pool of untapped resting liquidity", required: false },
    ],
  },
  {
    title: "Fractional Kelly Criterion & Edge Compounding",
    description: "Mathematical trade allocation: position sizing scaled to statistical edge (Win Rate & Win/Loss Ratio) using conservative Half-Kelly (0.5f) to maximize long-term growth.",
    timeframes: ["M1", "M5", "M15", "H1"],
    risk_reward_min: 2.0,
    rules_checklist: [
      { id: "kelly_1", text: "Historical win rate and expectancy confirm positive mathematical edge (> 52%)", required: true },
      { id: "kelly_2", text: "Position size scaled to conservative Half-Kelly (max 1.5% account risk)", required: true },
      { id: "kelly_3", text: "Risk per trade strictly reduced during negative drawdown phases", required: true },
      { id: "kelly_4", text: "Zero emotional deviation from formulaic lot-sizing calculation", required: true },
    ],
  },
  {
    title: "Multi-Timeframe Trend Alignment (M1 to H1)",
    description: "Full multi-timeframe synchronization: requires confluence across M1 execution, M5 momentum, M15 structure, and H1 trend filter before pulling the trigger.",
    timeframes: ["M1", "M5", "M15", "H1"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "mtf_1", text: "Higher timeframe (H1 & M15) trend direction is aligned with setup", required: true },
      { id: "mtf_2", text: "Intermediate timeframe (M5) shows directional momentum (EMA slope / RSI > 50)", required: true },
      { id: "mtf_3", text: "Execution timeframe (M1) provides precision entry trigger without counter-trend drift", required: true },
      { id: "mtf_4", text: "No trading when Multi-Timeframe Matrix indicates CONFLICT status", required: true },
    ],
  },
  {
    title: "Take Risk & Aggressive Momentum Exploitation",
    description: "High-conviction aggressive scalping for brave traders: capitalizes on immediate impulsive momentum, high-impact volatility expansion, and front-running orderflow with tight SL and asymmetric 1:3+ reward targets.",
    timeframes: ["M1", "M5"],
    risk_reward_min: 3.0,
    rules_checklist: [
      { id: "risk_1", text: "High-velocity momentum spike detected (aggressive institutional market order surge)", required: true },
      { id: "risk_2", text: "Willingness to take bold calculated risk with tight invalidation beyond immediate impulse wick", required: true },
      { id: "risk_3", text: "Minimum 1:3.0 Risk-to-Reward asymmetric upside potential mapped out", required: true },
      { id: "risk_4", text: "Trailing stop or aggressive partial profit taking activated as soon as trade pushes +1.5R", required: false },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
      // Sync preset skills into database if missing
      for (const skill of PRESET_SKILLS) {
        await client.query(
          `INSERT INTO trading_skills (title, description, timeframes, rules_checklist, risk_reward_min)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [skill.title, skill.description, skill.timeframes, JSON.stringify(skill.rules_checklist), skill.risk_reward_min]
        );
      }

      const result = await client.query(
        `SELECT id, title, description, timeframes, rules_checklist, risk_reward_min, created_at, updated_at
         FROM trading_skills
         ORDER BY id ASC`
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
