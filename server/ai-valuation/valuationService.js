const axios  = require('axios');
const OpenAI = require('openai');

const OPENAI_AVAILABLE = Boolean(process.env.OPENAI_API_KEY);
let openai;
if (OPENAI_AVAILABLE) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  // Minimal stub so calling code doesn't crash; methods throw informative errors.
  openai = {
    chat: {
      completions: {
        create: async () => {
          throw new Error('OpenAI API key not configured (OPENAI_API_KEY)');
        },
      },
    },
  };
}

/* ─── Internal ML microservice call ─────────────────────────────────── */

const callMLService = async (input) => {
  const { data } = await axios.post(
    `${process.env.AI_SERVICE_URL}/valuate`,
    input,
    { timeout: 15000 }
  );
  return data;
  // Expected shape:
  // {
  //   estimatedValue, lowEstimate, highEstimate,
  //   confidenceScore, pricePerSqFt,
  //   comparables: [...],
  //   featureImportance: [...],
  //   marketTrend, marketSummary,
  //   modelVersion
  // }
};

/* ─── OpenAI narrative generation ────────────────────────────────────── */

const generateNarrative = async (input, mlResult) => {
  const prompt = `
You are a professional real estate appraiser. Based on the following property data and ML valuation,
write a concise 3-4 sentence narrative explaining the estimated value to a property owner.
Be factual, professional, and mention the key factors driving the valuation.

Property:
- Location: ${input.city}, ${input.state}
- Type: ${input.propertyType}
- Size: ${input.squareFeet} sq ft
- Bedrooms: ${input.bedrooms}, Bathrooms: ${input.bathrooms}
- Year Built: ${input.yearBuilt || 'Unknown'}
- Lot Size: ${input.lotSize || 'Unknown'} sq ft

ML Valuation Result:
- Estimated Value: $${mlResult.estimatedValue.toLocaleString()}
- Range: $${mlResult.lowEstimate.toLocaleString()} – $${mlResult.highEstimate.toLocaleString()}
- Confidence: ${mlResult.confidenceScore}%
- Price per Sq Ft: $${mlResult.pricePerSqFt}
- Market Trend: ${mlResult.marketTrend}
- Top Features: ${mlResult.featureImportance?.slice(0, 3).map((f) => f.feature).join(', ')}
- Market Summary: ${mlResult.marketSummary}

Write only the narrative paragraph. No headings, no bullet points.
`.trim();

  const completion = await openai.chat.completions.create({
    model:       'gpt-4o',
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  250,
    temperature: 0.4,
  });

  return completion.choices[0]?.message?.content?.trim() || null;
};

/* ─── Hybrid valuation (ML + OpenAI narrative) ───────────────────────── */

exports.runValuation = async (input) => {
  // Step 1 — call ML microservice
  let mlResult;
  try {
    mlResult = await callMLService(input);
  } catch (err) {
    // Fallback: simple heuristic if ML service is down
    console.warn('[ValuationService] ML service unavailable, using heuristic fallback:', err.message);
    const baseRate   = { residential: 200, commercial: 250, land: 50, industrial: 150 };
    const rate       = baseRate[input.propertyType] || 200;
    const estimated  = Math.round(input.squareFeet * rate);
    mlResult = {
      estimatedValue:  estimated,
      lowEstimate:     Math.round(estimated * 0.9),
      highEstimate:    Math.round(estimated * 1.1),
      confidenceScore: 40,
      pricePerSqFt:    rate,
      comparables:     [],
      featureImportance: [],
      marketTrend:     'stable',
      marketSummary:   'Estimated using heuristic fallback — ML service unavailable.',
      modelVersion:    'fallback-v1',
    };
  }

  // Step 2 — generate LLM narrative
  let aiNarrative = null;
  try {
    aiNarrative = await generateNarrative(input, mlResult);
  } catch (err) {
    console.warn('[ValuationService] OpenAI narrative failed:', err.message);
  }

  return {
    ...mlResult,
    aiNarrative,
    source: aiNarrative ? 'hybrid' : 'internal_ml',
  };
};

/* ─── Fetch comparables only (no full valuation) ─────────────────────── */

exports.fetchComparables = async ({ city, state, squareFeet, propertyType, radius, limit }) => {
  const { data } = await axios.post(
    `${process.env.AI_SERVICE_URL}/comparables`,
    { city, state, squareFeet, propertyType, radius, limit },
    { timeout: 10000 }
  );
  return data.comparables || [];
};

/* ─── Market trend summary for a city ───────────────────────────────── */

exports.getMarketTrend = async (city, state) => {
  const prompt = `
You are a real estate market analyst. Provide a brief 2-3 sentence market trend summary
for the real estate market in ${city}, ${state} as of ${new Date().getFullYear()}.
Cover price trends, demand, and any notable factors. Be factual and concise.
Respond with JSON only in this exact shape:
{ "trend": "rising|stable|declining", "summary": "..." }
`.trim();

  if (!OPENAI_AVAILABLE) {
    return { trend: 'stable', summary: 'OpenAI API key not configured; returning default summary.' };
  }

  const completion = await openai.chat.completions.create({
    model:       'gpt-4o',
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  200,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { trend: 'stable', summary: raw };
  }
};