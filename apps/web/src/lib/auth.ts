import pool from "@/lib/db";
import crypto from "crypto";

export interface AppUser {
  id: number;
  username: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export interface AppAuditLog {
  id: number;
  username: string;
  role: string;
  action_type: string;
  description: string;
  metadata?: any;
  ip_address?: string;
  created_at: string;
}

let tablesInitialized = false;

export async function ensureAuthAndLogTables(): Promise<void> {
  if (tablesInitialized) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(64) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'member',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS app_audit_logs (
          id SERIAL PRIMARY KEY,
          username VARCHAR(64) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'member',
          action_type VARCHAR(64) NOT NULL,
          description TEXT NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          ip_address VARCHAR(64),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON app_audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON app_audit_logs(action_type);
      `);

      // Seed default owner account if table is empty
      const countRes = await client.query("SELECT COUNT(*) FROM app_users");
      const count = parseInt(countRes.rows[0]?.count || "0", 10);
      if (count === 0) {
        const defaultOwnerPass = hashPassword("owner123");
        await client.query(
          `INSERT INTO app_users (username, password_hash, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (username) DO NOTHING`,
          ["owner", defaultOwnerPass, "owner"]
        );
      }
      tablesInitialized = true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("Failed to ensure app_users/app_audit_logs tables:", err);
  }
}

export function hashPassword(password: string): string {
  const salt = "npfp_salt_2026_super_secure";
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export interface SessionTokenPayload {
  username: string;
  role: "owner" | "admin" | "member";
  exp: number;
}

const JWT_SECRET = process.env.ENCRYPTION_MASTER_KEY || "npfp_auth_token_key_secret_2026";

export function createSessionToken(username: string, role: "owner" | "admin" | "member"): string {
  const payload: SessionTokenPayload = {
    username,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
    if (sig !== expectedSig) return null;
    const payload: SessionTokenPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function logAction(params: {
  username: string;
  role: string;
  action_type: string;
  description: string;
  metadata?: any;
  ip_address?: string;
}): Promise<void> {
  try {
    await ensureAuthAndLogTables();
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO app_audit_logs (username, role, action_type, description, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          params.username || "anonymous",
          params.role || "member",
          params.action_type,
          params.description,
          JSON.stringify(params.metadata || {}),
          params.ip_address || null,
        ]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("Audit log insert error:", err);
  }
}
