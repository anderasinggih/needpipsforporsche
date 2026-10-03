import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get('provider');
    const client = await pool.connect();
    try {
      if (provider) {
        const result = await client.query(
          'SELECT id, provider, key_identifier, encrypted_secret, iv, tag, is_active, created_at FROM api_credentials WHERE provider = $1 AND is_active = true',
          [provider]
        );
        const credentials = result.rows.map(row => ({
          id: row.id,
          provider: row.provider,
          keyIdentifier: row.key_identifier,
          encryptedSecret: row.encrypted_secret,
          iv: row.iv,
          tag: row.tag,
          isActive: row.is_active,
          createdAt: row.created_at,
        }));
        return NextResponse.json({ credentials });
      } else {
        const result = await client.query(
          'SELECT id, provider, key_identifier, is_active, created_at FROM api_credentials WHERE is_active = true'
        );
        return NextResponse.json({ credentials: result.rows });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, keyIdentifier, apiKey } = body;

    if (!provider || !keyIdentifier || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const encrypted = encryptSecret(apiKey);
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO api_credentials (provider, key_identifier, encrypted_secret, iv, tag, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, provider, key_identifier, is_active, created_at`,
        [provider, keyIdentifier, encrypted.encryptedSecret, encrypted.iv, encrypted.tag]
      );
      return NextResponse.json({ credential: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to store credential' }, { status: 500 });
  }
}
