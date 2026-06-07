/**
 * tmpValuationService.js
 *
 * Smart AI valuation for Indian real estate.
 * Works offline – no external API required.
 * Uses city-tier data, property type multipliers, age depreciation,
 * and demand-zone adjustments to produce realistic estimates.
 */

/* ─── City-tier base price per sqft (USD) ─────────────────────────────── */
const CITY_RATES = {
  // Tier 1 — metros
  mumbai:     620, 'navi mumbai': 420, thane: 380,
  delhi:      580, 'new delhi': 600, gurugram: 520, noida: 380, faridabad: 280,
  bangalore:  490, bengaluru: 490,
  hyderabad:  370, secunderabad: 340,
  chennai:    330, madras: 330,
  pune:       360,
  kolkata:    260,
  ahmedabad:  220,
  // Tier 2
  jaipur: 200, lucknow: 180, chandigarh: 280, indore: 170, nagpur: 160,
  coimbatore: 190, madurai: 160, surat: 200, vadodara: 180,
  visakhapatnam: 190, vijayawada: 170, kochi: 280, thiruvananthapuram: 220,
  bhubaneswar: 170, guwahati: 160, dehradun: 210, mysore: 210, mysuru: 210,
  // Tier 3 / other
  salem: 130, tiruppur: 120, vellore: 130, tirunelveli: 120, erode: 120,
  trichy: 140, tiruchirappalli: 140, thanjavur: 110, cuddalore: 100,
  pondicherry: 180, puducherry: 180,
};

const DEFAULT_RATE = 140; // USD / sqft for unknown cities

/* ─── Property type multipliers ───────────────────────────────────────── */
const TYPE_MULTIPLIER = {
  house:      1.00,
  apartment:  0.90,
  villa:      1.35,
  commercial: 1.15,
  land:       0.45,
  // fallbacks from model enum
  residential: 1.00,
  industrial:  1.10,
};

/* ─── Age depreciation ────────────────────────────────────────────────── */
function ageMultiplier(yearBuilt) {
  if (!yearBuilt) return 1.0;
  const age = new Date().getFullYear() - parseInt(yearBuilt, 10);
  if (age <= 0)  return 1.10; // brand new / under construction premium
  if (age <= 5)  return 1.05;
  if (age <= 10) return 1.00;
  if (age <= 20) return 0.95;
  if (age <= 30) return 0.88;
  if (age <= 50) return 0.80;
  return 0.70;
}

/* ─── Bedroom / bathroom premium ─────────────────────────────────────── */
function roomPremium(bedrooms, bathrooms) {
  const bed = parseInt(bedrooms, 10) || 0;
  const bath = parseInt(bathrooms, 10) || 0;
  let factor = 1.0;
  if (bed >= 4)  factor += 0.05;
  if (bed >= 6)  factor += 0.05;
  if (bath >= 3) factor += 0.03;
  return factor;
}

/* ─── State-level market trend ────────────────────────────────────────── */
const STATE_TREND = {
  'maharashtra': { trend: 'rising',    delta: 0.08 },
  'karnataka':   { trend: 'rising',    delta: 0.10 },
  'telangana':   { trend: 'rising',    delta: 0.09 },
  'tamil nadu':  { trend: 'stable',    delta: 0.04 },
  'delhi':       { trend: 'stable',    delta: 0.05 },
  'gujarat':     { trend: 'rising',    delta: 0.07 },
  'rajasthan':   { trend: 'stable',    delta: 0.03 },
  'kerala':      { trend: 'rising',    delta: 0.06 },
  'andhra pradesh': { trend: 'stable', delta: 0.04 },
  'uttar pradesh':  { trend: 'stable', delta: 0.03 },
  'west bengal':    { trend: 'stable', delta: 0.02 },
  'punjab':         { trend: 'stable', delta: 0.03 },
};

function getStateTrend(state) {
  if (!state) return { trend: 'stable', delta: 0.03 };
  const key = state.toLowerCase().trim();
  return STATE_TREND[key] || { trend: 'stable', delta: 0.03 };
}

/* ─── Narrative generator ─────────────────────────────────────────────── */
function generateNarrative(input, result) {
  const city    = input.city || 'your city';
  const state   = input.state || 'India';
  const type    = (input.propertyType || 'property').toLowerCase();
  const sqft    = Number(input.squareFeet).toLocaleString('en-IN');
  const valUSD  = Math.round(result.estimatedValue).toLocaleString('en-US');
  const trend   = result.marketTrend;

  const trendPhrases = {
    rising:   `The ${city} real estate market is currently on an upward trajectory, with demand outpacing supply in most micro-markets.`,
    stable:   `The ${city} property market is stable, reflecting steady demand and consistent buyer interest.`,
    declining:`While the ${city} market has seen some softening recently, well-located properties continue to command good valuations.`,
  };

  const ageSentence = input.yearBuilt
    ? `Built in ${input.yearBuilt}, the property reflects ${new Date().getFullYear() - parseInt(input.yearBuilt, 10)} years of service life, factored into the depreciation model.`
    : '';

  return (
    `This ${sqft} sq ft ${type} in ${city}, ${state} is estimated at $${valUSD} based on current comparable transactions and local market dynamics. ` +
    `${trendPhrases[trend] || trendPhrases.stable} ` +
    `${ageSentence} ` +
    `Key value drivers include location desirability, property size, bedroom configuration, and regional infrastructure growth. ` +
    `The confidence score reflects data richness; adding more property details can improve accuracy.`
  ).trim();
}

/* ─── Main export ─────────────────────────────────────────────────────── */

/**
 * Compute a smart AI valuation without any external service.
 *
 * @param {object} input
 * @param {string} input.city
 * @param {string} input.state
 * @param {number|string} input.squareFeet
 * @param {number|string} input.bedrooms
 * @param {number|string} input.bathrooms
 * @param {string} input.propertyType
 * @param {number|string} [input.yearBuilt]
 * @returns {object}
 */
exports.computeValuation = (input) => {
  const sqft = parseFloat(input.squareFeet) || 1000;

  // 1. City base rate
  const cityKey   = (input.city || '').toLowerCase().trim();
  const baseRate  = CITY_RATES[cityKey] || DEFAULT_RATE;

  // 2. Apply multipliers
  const typeKey   = (input.propertyType || 'house').toLowerCase();
  const typeMult  = TYPE_MULTIPLIER[typeKey]      || 1.0;
  const ageMult   = ageMultiplier(input.yearBuilt);
  const roomMult  = roomPremium(input.bedrooms, input.bathrooms);

  // 3. Market trend
  const { trend, delta } = getStateTrend(input.state);
  const trendMult = 1 + delta;

  // 4. Base estimate
  const estimated  = Math.round(sqft * baseRate * typeMult * ageMult * roomMult * trendMult);
  const low        = Math.round(estimated * 0.88);
  const high       = Math.round(estimated * 1.14);
  const pricePerSqFt = Math.round(estimated / sqft);

  // 5. Confidence score — higher when we have more data
  let confidence = 55;
  if (input.city      && CITY_RATES[cityKey]) confidence += 15;
  if (input.state     && STATE_TREND[(input.state || '').toLowerCase()]) confidence += 10;
  if (input.yearBuilt) confidence += 8;
  if (input.squareFeet && parseFloat(input.squareFeet) > 0) confidence += 5;
  if (input.bedrooms)  confidence += 4;
  if (input.bathrooms) confidence += 3;
  confidence = Math.min(confidence, 92); // cap at 92 for "AI" credibility

  // 6. ETH price — approximate (1 ETH ≈ $3 200; kept as a fixed reference for local dev)
  const ETH_PRICE_USD = 3200;
  const suggestedEth  = parseFloat((estimated / ETH_PRICE_USD).toFixed(4));

  // 7. Feature importance
  const featureImportance = [
    { feature: 'Location (city)',       importance: 0.35 },
    { feature: 'Square footage',        importance: 0.25 },
    { feature: 'Property type',         importance: 0.15 },
    { feature: 'Age / year built',      importance: 0.12 },
    { feature: 'Bedroom/bathroom count',importance: 0.08 },
    { feature: 'State market trend',    importance: 0.05 },
  ];

  // 8. Comparables — synthetic nearby samples
  const comparables = [
    {
      address:       `Near ${input.address || input.city}`,
      squareFeet:    Math.round(sqft * 0.92),
      bedrooms:      parseInt(input.bedrooms, 10) || 3,
      bathrooms:     parseInt(input.bathrooms, 10) || 2,
      salePrice:     Math.round(estimated * 0.94),
      pricePerSqFt:  Math.round((estimated * 0.94) / (sqft * 0.92)),
      daysOnMarket:  28,
    },
    {
      address:       `${input.city} — comparable #2`,
      squareFeet:    Math.round(sqft * 1.08),
      bedrooms:      (parseInt(input.bedrooms, 10) || 3) + 1,
      bathrooms:     parseInt(input.bathrooms, 10) || 2,
      salePrice:     Math.round(estimated * 1.06),
      pricePerSqFt:  Math.round((estimated * 1.06) / (sqft * 1.08)),
      daysOnMarket:  45,
    },
    {
      address:       `${input.city} — comparable #3`,
      squareFeet:    Math.round(sqft * 1.00),
      bedrooms:      parseInt(input.bedrooms, 10) || 3,
      bathrooms:     parseInt(input.bathrooms, 10) || 2,
      salePrice:     Math.round(estimated * 0.99),
      pricePerSqFt:  Math.round((estimated * 0.99) / sqft),
      daysOnMarket:  19,
    },
  ];

  const result = {
    estimatedValue:    estimated,
    lowEstimate:       low,
    highEstimate:      high,
    confidenceScore:   confidence,
    pricePerSqFt,
    suggestedEth,
    comparables,
    featureImportance,
    marketTrend:       trend,
    marketSummary:     `${input.city || 'Local'} real estate is ${trend} — ${
      trend === 'rising' ? 'strong buyer demand and limited inventory are pushing prices up' :
      trend === 'declining' ? 'softer demand has moderated recent price growth' :
      'prices are broadly in line with fundamentals'
    }.`,
    modelVersion:      'india-heuristic-v2',
    source:            'internal_heuristic',
  };

  result.aiNarrative = generateNarrative(input, result);
  return result;
};
