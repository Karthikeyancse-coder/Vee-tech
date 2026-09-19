/**
 * mediaMetrics.js
 * High-speed publisher valuation and reach analytics engine.
 * Computes estimated readership, AVE (Advertising Value Equivalent),
 * publisher tiers, and entity disambiguation filters ported from vee1.
 */

export const PUBLISHER_VALUATIONS = {
  'economic times': { reach: 2500000, tier: 1, baseAve: 85000, domain: 'economictimes.indiatimes.com' },
  'the economic times': { reach: 2500000, tier: 1, baseAve: 85000, domain: 'economictimes.indiatimes.com' },
  'livemint': { reach: 1800000, tier: 1, baseAve: 62000, domain: 'livemint.com' },
  'mint': { reach: 1800000, tier: 1, baseAve: 62000, domain: 'livemint.com' },
  'business standard': { reach: 1500000, tier: 1, baseAve: 51000, domain: 'business-standard.com' },
  'the hindu business line': { reach: 1200000, tier: 2, baseAve: 42000, domain: 'thehindubusinessline.com' },
  'the hindu': { reach: 2000000, tier: 1, baseAve: 70000, domain: 'thehindu.com' },
  'techcrunch': { reach: 3500000, tier: 1, baseAve: 95000, domain: 'techcrunch.com' },
  'yourstory': { reach: 800000, tier: 2, baseAve: 28000, domain: 'yourstory.com' },
  'inc42': { reach: 700000, tier: 2, baseAve: 24000, domain: 'inc42.com' },
  'financial express': { reach: 1100000, tier: 2, baseAve: 38000, domain: 'financialexpress.com' },
  'moneycontrol': { reach: 2000000, tier: 1, baseAve: 70000, domain: 'moneycontrol.com' },
  'ndtv profit': { reach: 1900000, tier: 1, baseAve: 65000, domain: 'ndtvprofit.com' },
  'times of india': { reach: 3000000, tier: 1, baseAve: 102000, domain: 'timesofindia.indiatimes.com' },
  'hindustan times': { reach: 2200000, tier: 1, baseAve: 75000, domain: 'hindustantimes.com' },
  'reuters': { reach: 4000000, tier: 1, baseAve: 110000, domain: 'reuters.com' },
  'bloomberg': { reach: 3500000, tier: 1, baseAve: 100000, domain: 'bloomberg.com' },
  'the guardian': { reach: 3200000, tier: 1, baseAve: 90000, domain: 'theguardian.com' },
  'guardian': { reach: 3200000, tier: 1, baseAve: 90000, domain: 'theguardian.com' },
  'dinamalar': { reach: 1800000, tier: 1, baseAve: 58000, domain: 'dinamalar.com' },
  'daily thanthi': { reach: 2200000, tier: 1, baseAve: 72000, domain: 'dailythanthi.com' },
  'dinamani': { reach: 1500000, tier: 1, baseAve: 48000, domain: 'dinamani.com' },
  'vikatan': { reach: 1200000, tier: 2, baseAve: 40000, domain: 'vikatan.com' },
  'tamil murasu': { reach: 700000, tier: 2, baseAve: 24000, domain: 'tamilmurasu.com.sg' },
  'puthiya thalaimurai': { reach: 850000, tier: 2, baseAve: 28000, domain: 'puthiyathalaimurai.com' }
};

const DEFAULT_METRICS = {
  reach: 350000,
  tier: 3,
  baseAve: 25000
};

/**
 * Disambiguation dictionary from vee1.
 * Prevents false positives where generic terms collide with monitored entities.
 */
export const ENTITY_DISAMBIGUATION = {
  'payu': {
    confusableTerms: [/\bpay commission\b/i, /\bpayroll\b/i, /\bpay scale\b/i, /\bpay hike\b/i, /\bsalary pay\b/i],
    strictTerms: [/\bpayu\b/i, /\bprosus\b/i, /\blazypay\b/i]
  },
  'apple': {
    confusableTerms: [/\bapple fruit\b/i, /\bapple cider\b/i, /\beat an apple\b/i, /\bapple pie\b/i],
    strictTerms: [/\bapple inc\b/i, /\btim cook\b/i, /\biphone\b/i, /\bmacbook\b/i, /\bios\b/i]
  },
  'tesla': {
    confusableTerms: [/\bnikola tesla\b/i, /\btesla unit\b/i, /\bflux density\b/i],
    strictTerms: [/\belon musk\b/i, /\bcybertruck\b/i, /\bmodel 3\b/i, /\bgigafactory\b/i, /\bautopilot\b/i]
  }
};

/**
 * Resolve publisher valuation
 * @param {string} publisherName
 * @param {string} sentiment - 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
 * @returns {{ reach: number, ave: number, tier: number }}
 */
export function getPublisherMetrics(publisherName = '', sentiment = 'NEUTRAL') {
  const normName = (publisherName || '').trim().toLowerCase();
  
  let match = DEFAULT_METRICS;
  for (const [nameKey, val] of Object.entries(PUBLISHER_VALUATIONS)) {
    if (normName.includes(nameKey) || nameKey.includes(normName)) {
      match = val;
      break;
    }
  }

  // Adjust reach and AVE based on sentiment impact
  const isPositive = sentiment.toUpperCase() === 'POSITIVE';
  const isNegative = sentiment.toUpperCase() === 'CRITICAL' || sentiment.toUpperCase() === 'NEGATIVE';

  const reachMultiplier = isPositive ? 1.15 : (isNegative ? 1.25 : 1.0); // Negative crises spread faster
  const aveMultiplier = isPositive ? 1.2 : (isNegative ? 0.8 : 1.0);

  return {
    reach: Math.round(match.reach * reachMultiplier),
    ave: Math.round(match.baseAve * aveMultiplier),
    tier: match.tier
  };
}

/**
 * Filter out confusable false positives (e.g. "Pay Commission" when searching for "PayU")
 * @param {string} text - Title + description/content
 * @param {string} targetEntity - e.g. 'PayU', 'Apple'
 * @returns {boolean} true if valid article, false if noise to be discarded
 */
export function validateEntityContext(text = '', targetEntity = '') {
  if (!targetEntity) return true;
  const config = ENTITY_DISAMBIGUATION[targetEntity.toLowerCase()];
  if (!config) return true;

  const hasConfusable = config.confusableTerms.some(regex => regex.test(text));
  const hasStrict = config.strictTerms.some(regex => regex.test(text));

  if (hasConfusable && !hasStrict) {
    return false; // False positive noise dropped
  }

  return true;
}
