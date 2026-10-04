import { NextRequest, NextResponse } from 'next/server';

interface TestKeyRequest {
  provider: 'gemini' | 'groq' | 'openai' | 'deepseek' | 'openrouter';
  model: string;
  apiKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestKeyRequest = await request.json();
    const { provider, model, apiKey } = body;

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ ok: false, error: 'API Key is empty' }, { status: 400 });
    }

    const key = apiKey.trim();
    const timeoutMs = 8000;

    const fetchWithTimeout = async (url: string, options: RequestInit) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e: any) {
        clearTimeout(id);
        throw new Error(e.name === 'AbortError' ? 'Request timed out (8s)' : e.message);
      }
    };

    if (provider === 'gemini') {
      const m = model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Gemini HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Connected';
      return NextResponse.json({ ok: true, message: `Sukses terhubung (${reply})` });
    }

    if (provider === 'openai') {
      const m = model || 'gpt-4o-mini';
      const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `OpenAI HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }

      return NextResponse.json({ ok: true, message: 'Sukses terhubung ke OpenAI' });
    }

    if (provider === 'groq') {
      const m = model || 'llama-3.3-70b-versatile';
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Groq HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }

      return NextResponse.json({ ok: true, message: 'Sukses terhubung ke Groq' });
    }

    if (provider === 'deepseek') {
      const m = model || 'deepseek-chat';
      const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `DeepSeek HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }

      return NextResponse.json({ ok: true, message: 'Sukses terhubung ke DeepSeek' });
    }

    if (provider === 'openrouter') {
      const m = model || 'google/gemini-2.0-flash-exp:free';
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `OpenRouter HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }

      return NextResponse.json({ ok: true, message: 'Sukses terhubung ke OpenRouter' });
    }

    return NextResponse.json({ ok: false, error: 'Unknown provider' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Connection failed' }, { status: 500 });
  }
}
