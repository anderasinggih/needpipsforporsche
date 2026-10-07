import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  ensureAuthAndLogTables,
  hashPassword,
  verifySessionToken,
  logAction,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/users
 * List all registered users (visible to owner/admin, or from /owner/key)
 */
export async function GET(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT id, username, role, created_at FROM app_users ORDER BY id ASC"
      );
      return NextResponse.json({ users: res.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/users
 * Create a new user account (from /owner/key without admin lock)
 * Body: { username, password, role }
 */
export async function POST(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const body = await req.json();
    const { username, password, role = "member" } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { error: "Username minimal 3 karakter" },
        { status: 400 }
      );
    }

    if (String(password).length < 4) {
      return NextResponse.json(
        { error: "Password minimal 4 karakter" },
        { status: 400 }
      );
    }

    const validRoles = ["owner", "admin", "member", "viewer"];
    const targetRole = validRoles.includes(role) ? role : "member";

    const client = await pool.connect();
    try {
      // Check existing user
      const existing = await client.query(
        "SELECT id FROM app_users WHERE LOWER(username) = $1",
        [cleanUsername]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: `Username "${cleanUsername}" sudah digunakan.` },
          { status: 409 }
        );
      }

      const passHash = hashPassword(password);
      const res = await client.query(
        `INSERT INTO app_users (username, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, username, role, created_at`,
        [cleanUsername, passHash, targetRole]
      );

      const newUser = res.rows[0];

      // Identify creator if session cookie present
      const token = req.cookies.get("npfp_session")?.value;
      const creator = token ? verifySessionToken(token) : null;
      const creatorName = creator?.username || "owner/key direct";

      await logAction({
        username: creatorName,
        role: creator?.role || "owner",
        action_type: "USER_CREATE",
        description: `Akun baru "${newUser.username}" dengan role [${newUser.role}] berhasil dibuat`,
        metadata: { newUserId: newUser.id, username: newUser.username, role: newUser.role },
        ip_address: req.headers.get("x-forwarded-for") || req.ip || undefined,
      });

      return NextResponse.json({ ok: true, user: newUser });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/users?id=123
 * Delete a user account (only allowed by owner role)
 */
export async function DELETE(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Role check: Only owner can delete users
    const token = req.cookies.get("npfp_session")?.value;
    const actor = token ? verifySessionToken(token) : null;

    if (actor && actor.role !== "owner") {
      return NextResponse.json(
        { error: "Hanya akun dengan role Owner yang diizinkan menghapus pengguna!" },
        { status: 403 }
      );
    }

    const client = await pool.connect();
    try {
      const targetRes = await client.query(
        "SELECT id, username, role FROM app_users WHERE id = $1",
        [userId]
      );
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
      }

      const target = targetRes.rows[0];
      if (target.role === "owner") {
        // Count owners to prevent locking out all owners
        const ownersCountRes = await client.query("SELECT COUNT(*) FROM app_users WHERE role = 'owner'");
        if (parseInt(ownersCountRes.rows[0]?.count || "1", 10) <= 1) {
          return NextResponse.json(
            { error: "Tidak dapat menghapus owner terakhir!" },
            { status: 400 }
          );
        }
      }

      await client.query("DELETE FROM app_users WHERE id = $1", [userId]);

      await logAction({
        username: actor?.username || "owner",
        role: actor?.role || "owner",
        action_type: "USER_DELETE",
        description: `Pengguna "${target.username}" [${target.role}] dihapus`,
        metadata: { deletedUserId: target.id, username: target.username },
        ip_address: req.headers.get("x-forwarded-for") || req.ip || undefined,
      });

      return NextResponse.json({ ok: true, deleted: target });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
