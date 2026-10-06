import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  ensureAuthAndLogTables,
  verifySessionToken,
  logAction,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/logs?limit=100&action=...
 * Fetch system & AI audit logs
 */
export async function GET(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10), 10), 500);
    const actionFilter = searchParams.get("action");

    const client = await pool.connect();
    try {
      let query = "SELECT id, username, role, action_type, description, metadata, ip_address, created_at FROM app_audit_logs";
      const params: any[] = [];

      if (actionFilter) {
        query += " WHERE action_type = $1";
        params.push(actionFilter);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await client.query(query, params);
      return NextResponse.json({ logs: res.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/logs
 * Record an audit log entry (client-side or internal actions)
 */
export async function POST(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const body = await req.json();
    const { action_type, description, metadata = {} } = body;

    if (!action_type || !description) {
      return NextResponse.json({ error: "action_type and description required" }, { status: 400 });
    }

    const token = req.cookies.get("npfp_session")?.value;
    const actor = token ? verifySessionToken(token) : null;
    const username = actor?.username || body.username || "anonymous";
    const role = actor?.role || body.role || "member";
    const ip = req.headers.get("x-forwarded-for") || req.ip || undefined;

    await logAction({
      username,
      role,
      action_type,
      description,
      metadata,
      ip_address: ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/logs
 * CRITICAL RULE: AI and System logs CANNOT be deleted UNLESS the requester is OWNER!
 * Query params: ?id=123 (delete single) or ?clear_all=true (delete all)
 */
export async function DELETE(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const token = req.cookies.get("npfp_session")?.value;
    const actor = token ? verifySessionToken(token) : null;

    // Strict validation: Only OWNER role can delete logs!
    if (!actor || actor.role !== "owner") {
      return NextResponse.json(
        {
          error: "DILARANG: Log aktivitas dan AI dilindungi dan tidak dapat dihapus kecuali oleh akun dengan role OWNER!",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("id");
    const clearAll = searchParams.get("clear_all") === "true";

    const client = await pool.connect();
    try {
      if (logId) {
        await client.query("DELETE FROM app_audit_logs WHERE id = $1", [logId]);
        await logAction({
          username: actor.username,
          role: actor.role,
          action_type: "LOG_DELETE",
          description: `Owner ${actor.username} menghapus baris log ID ${logId}`,
          metadata: { deletedLogId: logId },
          ip_address: req.headers.get("x-forwarded-for") || req.ip || undefined,
        });
        return NextResponse.json({ ok: true, deletedId: logId });
      }

      if (clearAll) {
        await client.query("DELETE FROM app_audit_logs");
        await logAction({
          username: actor.username,
          role: actor.role,
          action_type: "LOG_CLEAR_ALL",
          description: `Owner ${actor.username} membersihkan seluruh riwayat audit logs`,
          ip_address: req.headers.get("x-forwarded-for") || req.ip || undefined,
        });
        return NextResponse.json({ ok: true, clearedAll: true });
      }

      return NextResponse.json({ error: "Specify ?id=... or ?clear_all=true" }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
