import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  ensureAuthAndLogTables,
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  logAction,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const token = req.cookies.get("npfp_session")?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        username: payload.username,
        role: payload.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
export async function POST(req: NextRequest) {
  try {
    await ensureAuthAndLogTables();
    const body = await req.json();
    const { action } = body;

    // Logout action
    if (action === "logout") {
      const token = req.cookies.get("npfp_session")?.value;
      const current = token ? verifySessionToken(token) : null;
      if (current) {
        await logAction({
          username: current.username,
          role: current.role,
          action_type: "LOGOUT",
          description: `User ${current.username} logged out`,
          ip_address: req.headers.get("x-forwarded-for") || req.ip || undefined,
        });
      }
      const response = NextResponse.json({ ok: true });
      response.cookies.delete("npfp_session");
      return response;
    }

    // Login action
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT id, username, password_hash, role FROM app_users WHERE LOWER(username) = $1",
        [cleanUsername]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: "Username atau password salah" },
          { status: 401 }
        );
      }

      const user = res.rows[0];
      const valid = verifyPassword(password, user.password_hash);
      if (!valid) {
        return NextResponse.json(
          { error: "Username atau password salah" },
          { status: 401 }
        );
      }

      const token = createSessionToken(user.username, user.role);

      await logAction({
        username: user.username,
        role: user.role,
        action_type: "LOGIN",
        description: `User ${user.username} (${user.role}) logged in successfully`,
        ip_address: req.headers.get("x-forwarded-for") || req.ip || undefined,
      });

      const response = NextResponse.json({
        ok: true,
        user: {
          username: user.username,
          role: user.role,
        },
      });

      response.cookies.set("npfp_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
