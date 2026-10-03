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
    
    // Try Groq first (fast, common)
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
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

    // Try OpenAI if no Groq success
    if (!responseData && process.env.OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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
