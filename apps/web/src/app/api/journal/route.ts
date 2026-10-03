import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, skill_id, symbol, direction, entry_price, exit_price, stop_loss, take_profit,
                lot_size, pnl, rules_compliance, notes, ai_validation_summary, status,
                created_at, closed_at
         FROM trade_journals
         ORDER BY created_at DESC
         LIMIT 100`
      );
      return NextResponse.json({ entries: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      symbol,
      direction,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      lotSize,
      pnl,
      rulesCompliance,
      notes,
      skillId,
      status,
      aiValidationSummary,
    } = body;

    if (!symbol || !direction || !entryPrice || !stopLoss || !takeProfit || !lotSize) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO trade_journals (skill_id, symbol, direction, entry_price, exit_price,
                                    stop_loss, take_profit, lot_size, pnl, rules_compliance,
                                    notes, ai_validation_summary, status, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, symbol, direction, entry_price, created_at, status`,
        [
          skillId || null,
          symbol,
          direction,
          entryPrice,
          exitPrice || null,
          stopLoss,
          takeProfit,
          lotSize,
          pnl || null,
          rulesCompliance ? JSON.stringify(rulesCompliance) : null,
          notes || null,
          aiValidationSummary || null,
          status || 'OPEN',
          status === 'CLOSED' ? new Date() : null,
        ]
      );
      return NextResponse.json({ entry: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
