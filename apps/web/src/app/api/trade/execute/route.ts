import { NextRequest, NextResponse } from 'next/server';

const ENGINE_URL = process.env.ENGINE_API_URL || 'http://localhost:8080/api/trade/execute';

export async function POST(request: NextRequest) {
  try {
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
