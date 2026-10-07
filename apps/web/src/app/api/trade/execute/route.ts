import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://localhost:8080/api/trade/execute';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("npfp_session")?.value;
    const user = token ? verifySessionToken(token) : null;
    if (user && user.role === "viewer") {
      return NextResponse.json(
        { success: false, error: "Akun viewer hanya memiliki izin pantau (read-only). Tidak dapat mengeksekusi order." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const response = await fetch(ENGINE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to execute trade' },
      { status: 500 }
    );
  }
}
