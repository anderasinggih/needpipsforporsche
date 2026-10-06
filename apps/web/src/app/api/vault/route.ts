import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    const client = await pool.connect();
    try {
      if (type === 'offsets') {
        const result = await client.query('SELECT symbol, offset_value FROM broker_price_offsets');
        const offsets: Record<string, number> = {};
        for (const row of result.rows) {
          offsets[row.symbol] = parseFloat(row.offset_value || 0);
        }
        return NextResponse.json({ offsets });
      }

      if (type === 'slots' || type === 'council') {
        const result = await client.query(
          'SELECT id, label, role_title, provider, model, encrypted_secret, iv, tag, enabled FROM council_key_slots ORDER BY id ASC'
        );
        const slots = result.rows.map((row) => {
          let apiKey = '';
          if (row.encrypted_secret && row.iv && row.tag) {
            try {
              apiKey = decryptSecret({
                encryptedSecret: row.encrypted_secret,
                iv: row.iv,
                tag: row.tag,
              });
            } catch (decErr) {
              console.warn('Failed to decrypt slot key for', row.id, decErr);
            }
          }
          return {
            id: row.id,
            label: row.label,
            roleTitle: row.role_title,
            provider: row.provider,
            model: row.model,
            apiKey,
            enabled: row.enabled !== undefined ? Boolean(row.enabled) : true,
          };
        });
        return NextResponse.json({ slots });
      }

      const provider = request.nextUrl.searchParams.get('provider');
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
  } catch (error: any) {
    console.error('Vault GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Save broker price offsets (MT4 calibration)
    if (body.offsets && typeof body.offsets === 'object') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [sym, val] of Object.entries(body.offsets)) {
          const numVal = parseFloat(String(val)) || 0.0;
          await client.query(
            `INSERT INTO broker_price_offsets (symbol, offset_value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (symbol) DO UPDATE SET offset_value = EXCLUDED.offset_value, updated_at = NOW()`,
            [sym.toUpperCase().trim(), numVal]
          );
        }
        await client.query('COMMIT');
        return NextResponse.json({ success: true, offsets: body.offsets, storage: 'postgresql' });
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Failed to save broker offsets:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
      } finally {
        client.release();
      }
    }

    // Batch save of Council Key Slots from /owner/key
    if (Array.isArray(body.slots)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const slot of body.slots) {
          if (!slot.id || !slot.provider) continue;
          let encryptedSecret = null;
          let iv = null;
          let tag = null;

          if (slot.apiKey && slot.apiKey.trim()) {
            const enc = encryptSecret(slot.apiKey.trim());
            encryptedSecret = enc.encryptedSecret;
            iv = enc.iv;
            tag = enc.tag;
          }

          await client.query(
            `INSERT INTO council_key_slots (id, label, role_title, provider, model, encrypted_secret, iv, tag, enabled, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (id) DO UPDATE SET
               label = EXCLUDED.label,
               role_title = EXCLUDED.role_title,
               provider = EXCLUDED.provider,
               model = EXCLUDED.model,
               encrypted_secret = COALESCE(EXCLUDED.encrypted_secret, council_key_slots.encrypted_secret),
               iv = COALESCE(EXCLUDED.iv, council_key_slots.iv),
               tag = COALESCE(EXCLUDED.tag, council_key_slots.tag),
               enabled = EXCLUDED.enabled,
               updated_at = NOW()`,
            [
              slot.id,
              slot.label || slot.id,
              slot.roleTitle || '',
              slot.provider,
              slot.model || '',
              encryptedSecret,
              iv,
              tag,
              slot.enabled !== undefined ? Boolean(slot.enabled) : true,
            ]
          );
        }
        await client.query('COMMIT');
        return NextResponse.json({ success: true, count: body.slots.length, storage: 'postgresql' });
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Failed to save council slots to PostgreSQL:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
      } finally {
        client.release();
      }
    }

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
      return NextResponse.json({ credential: result.rows[0], storage: 'postgresql' }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Vault POST error:', error);
    return NextResponse.json({ error: error.message || 'Vault error' }, { status: 500 });
  }
}
