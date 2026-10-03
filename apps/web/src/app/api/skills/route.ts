import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, title, description, timeframes, rules_checklist, risk_reward_min, created_at, updated_at
         FROM trading_skills
         ORDER BY created_at DESC`
      );
      return NextResponse.json({ skills: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
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
        [title, description || '', timeframes || null, rulesChecklist, riskRewardMin || 2.0]
      );
      return NextResponse.json({ skill: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
}
