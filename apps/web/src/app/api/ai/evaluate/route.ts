import { NextRequest, NextResponse } from 'next/server';

interface EvaluateRequest {
  symbol: string;
  price: number;
  direction: 'BUY' | 'SELL';
  checklistMet: boolean;
  indicatorsSummary?: string;
  rules?: any[];
}

export async function POST(request: NextRequest) {
  try {
    const body: EvaluateRequest = await request.json();
    const { symbol, price, direction, checklistMet, indicatorsSummary, rules } = body;

    // Build structured prompt for LLM evaluation
    const prompt = `You are an AI trade setup evaluator for XAU/USD (Gold) trading with focus on Smart Money Concepts (SMC), Liquidity Sweeps, and disciplined execution.

Evaluate the following trade setup:

- Symbol: ${symbol}
- Current/Entry Price: ${price}
- Direction: ${direction}
- All Checklist Rules Met: ${checklistMet ? 'YES' : 'NO'}
- Technical Indicators Summary: ${indicatorsSummary || 'Not provided'}
- Rules Compliance: ${JSON.stringify(rules || [])}

Provide a structured analysis in JSON format with:
{
  "rating": "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL|INVALID",
  "confidence": 0-100,
  "thesis": "Bullish/Bearish thesis explanation (2-3 sentences)",
  "riskInvalidation": "Key levels that would invalidate this setup",
  "keyLevels": {"support": [], "resistance": []},
  "recommendation": "Actionable recommendation",
  "notes": "Additional observations"
}

Focus on risk management, confluence, and probability. Be objective and conservative.`;

    // Try multiple providers if keys exist (OpenAI, Groq, Anthropic, Ollama)
    let responseData: any = null;
    
    const apiKey = (request.headers.get("x-gemini-key") || process.env.GEMINI_API_KEY || "").trim();
    const userModel = (request.headers.get("x-ai-model") || "gemini-2.5-flash").trim();

    // 1. Try Google Gemini first if key provided
    if (apiKey || process.env.GEMINI_API_KEY) {
      const activeGeminiKey = apiKey || process.env.GEMINI_API_KEY;
      const targetModel = userModel.startsWith("gemini") ? userModel : "gemini-2.5-flash";
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${activeGeminiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${prompt}\n\nIMPORTANT: Return ONLY valid, raw JSON without markdown tags, backticks or commentary.` }]
              }
            ],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json"
            }
          }),
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            responseData = JSON.parse(text);
          }
        } else {
          console.error("Gemini API error:", await geminiRes.text());
        }
      } catch (e) {
        console.error('Gemini API call failed:', e);
      }
    }

    // 2. Try Groq (fast, fallback)
    if (!responseData && (process.env.GROQ_API_KEY || request.headers.get("x-groq-key"))) {
      const activeGroqKey = request.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeGroqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: userModel.startsWith("llama") ? userModel : 'llama3-8b-8192',
            messages: [
              { role: 'system', content: 'You are a professional trade evaluator. Return only valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 800,
          }),
        });
        if (groqRes.ok) {
          const data = await groqRes.json();
          const content = data.choices?.[0]?.message?.content;
          responseData = JSON.parse(content);
        }
      } catch (e) {
        console.error('Groq API error:', e);
      }
    }

    // 3. Try OpenAI
    if (!responseData && (process.env.OPENAI_API_KEY || request.headers.get("x-openai-key"))) {
      const activeOpenaiKey = request.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeOpenaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: userModel.startsWith("gpt") ? userModel : 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a professional trade evaluator. Return only valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 800,
          }),
        });
        if (openaiRes.ok) {
          const data = await openaiRes.json();
          const content = data.choices?.[0]?.message?.content;
          responseData = JSON.parse(content);
        }
      } catch (e) {
        console.error('OpenAI API error:', e);
      }
    }

    // Fallback to rule-based evaluation if no LLM available
    if (!responseData) {
      responseData = {
        rating: checklistMet ? (direction === 'BUY' ? 'BUY' : 'SELL') : 'INVALID',
        confidence: checklistMet ? 75 : 30,
        thesis: checklistMet 
          ? `Based on checklist compliance, ${direction} setup shows structured confluence. The rules have been satisfied according to the defined trading skill.`
          : 'Setup does not meet all required checklist rules. Discipline requires waiting for full confluence before execution.',
        riskInvalidation: 'Break of key structure or liquidity invalidation level. Monitor price action closely.',
        keyLevels: { support: [], resistance: [] },
        recommendation: checklistMet ? `Consider ${direction} entry with proper risk management (SL/TP as defined).` : 'Do not execute. Wait for setup to fully develop.',
        notes: 'LLM API key not configured. Using rule-based fallback evaluation.',
      };
    }

    return NextResponse.json({ evaluation: responseData });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate trade setup' },
      { status: 500 }
    );
  }
}
