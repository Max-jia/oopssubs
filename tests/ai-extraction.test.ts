/**
 * AI Extraction pipeline tests — edge cases found in code review
 * Run: npx tsx tests/ai-extraction.test.ts
 */

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e: any) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}

const KNOWN_SERVICES: [RegExp, string, "monthly"|"yearly"][] = [
  [/netflix/i, "Netflix", "monthly"], [/spotify/i, "Spotify", "monthly"],
  [/hulu/i, "Hulu", "monthly"], [/amazon\s*prime/i, "Amazon Prime", "yearly"],
  [/adobe/i, "Adobe CC", "monthly"], [/doordash/i, "DoorDash", "monthly"],
  [/tinder/i, "Tinder", "monthly"], [/peloton/i, "Peloton", "monthly"],
];

const cancelGuides = [
  { slug: 'netflix', name: 'Netflix', difficulty: 'easy', steps: [] },
  { slug: 'spotify', name: 'Spotify Premium', difficulty: 'easy', steps: [] },
  { slug: 'hulu', name: 'Hulu', difficulty: 'easy', steps: [] },
  { slug: 'amazon-prime', name: 'Amazon Prime', difficulty: 'medium', steps: [] },
  { slug: 'adobe-cc', name: 'Adobe CC', difficulty: 'hard', steps: [] },
  { slug: 'doordash-dashpass', name: 'DoorDash DashPass', difficulty: 'easy', steps: [] },
  { slug: 'tinder-plus', name: 'Tinder Plus/Gold', difficulty: 'medium', steps: [] },
  { slug: 'peloton', name: 'Peloton', difficulty: 'easy', steps: [] },
] as any;

// ── Replicated functions ──
function matchSenderDomain(fromHeader: string): string | null {
  let domain = fromHeader.match(/@([a-z0-9-]+)\.(?:com|co|io|net|org|app|dev)/i)?.[1]?.toLowerCase();
  if (!domain) {
    domain = fromHeader.match(/([a-z0-9-]+)\.(?:com|co|io|net|org|app|dev)/i)?.[1]?.toLowerCase();
  }
  if (!domain) return null;
  for (const g of cancelGuides) {
    const slugKey = g.slug.replace(/-plus|-premium|-cc|-pass|-tv|-app|-online|-sub/g, '');
    if (domain.includes(slugKey) || slugKey.includes(domain)) return g.name;
  }
  const knownSenders: Record<string, string> = {
    'netflix': 'Netflix', 'spotify': 'Spotify', 'hulu': 'Hulu',
    'amazon': 'Amazon', 'adobe': 'Adobe', 'doordash': 'DoorDash',
    'tinder': 'Tinder', 'peloton': 'Peloton',
  };
  for (const [key, name] of Object.entries(knownSenders)) {
    if (domain.includes(key) || key.includes(domain)) return name;
  }
  return null;
}

function quickRegexExtract(text: string): { name: string; amount: number; cycle: "monthly"|"yearly"; confidence: string; } | null {
  for (const [pattern, name, cycle] of KNOWN_SERVICES) {
    if (pattern.test(text)) {
      const amtMatch = text.match(/\$?\s*(\d+\.?\d{0,2})\s*(?:\/|per\s+)?\s*(?:month|mo|year|yr|\$)/i);
      if (amtMatch) {
        const amt = parseFloat(amtMatch[1]);
        if (amt >= 0.99 && amt <= 999) return { name, amount: amt, cycle, confidence: "high" };
      }
      const anyAmt = text.match(/\$?\s?(\d{1,4}\.?\d{0,2})/);
      if (anyAmt) {
        const amt = parseFloat(anyAmt[1]);
        if (amt >= 0.99 && amt <= 999) return { name, amount: amt, cycle, confidence: "medium" };
      }
      return { name, amount: 0, cycle, confidence: "low" };
    }
  }
  const billing = text.match(/(?:total|amount|charged|paid|fee|price|cost).*?\$?\s*(\d+\.?\d{0,2})/i);
  if (billing) {
    const amt = parseFloat(billing[1]);
    if (amt >= 0.99 && amt <= 999) return { name: "Subscription", amount: amt, cycle: "monthly", confidence: "low" };
  }
  return null;
}

console.log("\n=== Bug 1: Sender domain regex captures '>' ===\n");

test("From: Netflix <info@netflix.com> → domain = netflix.com (no '>')", () => {
  const from = "Netflix <info@netflix.com>";
  const captured = from.match(/From:\s*.*?@([^\s\n<>"]+)/i)?.[1];
  // Simulating the From line in the body
  const line = `From: ${from}`;
  const matched = line.match(/From:\s*.*?@([^\s\n<>"]+)/i)?.[1] || line.match(/From:\s*(.+)/m)?.[1];
  const senderMatch = matchSenderDomain(matched);
  if (!senderMatch) throw new Error(`No match for "${matched}"`);
  if (senderMatch !== "Netflix") throw new Error(`Expected Netflix, got ${senderMatch}`);
});

test("From: billing@spotify.com → domain = spotify", () => {
  const matched = matchSenderDomain("billing@spotify.com");
  if (matched !== "Spotify Premium") throw new Error(`Expected Spotify, got ${matched}`);
});

test("From: 'spotify.com' (just domain, no @) → still matches", () => {
  const matched = matchSenderDomain("spotify.com");
  if (matched !== "Spotify Premium") throw new Error(`Expected Spotify from domain-only, got ${matched}`);
});

test("From: 'netflix.com' → matches Netflix", () => {
  const matched = matchSenderDomain("netflix.com");
  if (!matched) throw new Error("Should match Netflix from domain-only input");
});

test("From: unknown@random-service.io → no match → returns null", () => {
  const matched = matchSenderDomain("unknown@random-service.io");
  if (matched !== null) throw new Error(`Should return null for unknown, got ${matched}`);
});

console.log("\n=== Bug 3: Single-digit amounts ===\n");

test("quickRegexExtract: '$7.99/month' → amount=7.99", () => {
  const text = "From: Hulu\nBody: Your monthly charge is $7.99/month";
  const result = quickRegexExtract(text);
  if (!result) throw new Error("No match");
  if (result.amount !== 7.99) throw new Error(`Expected 7.99, got ${result.amount}`);
});

test("quickRegexExtract: '$15.99' (was already working) → still works", () => {
  const text = "From: Netflix\nBody: $15.99 charged";
  const result = quickRegexExtract(text);
  if (!result) throw new Error("No match");
  if (result.amount !== 15.99) throw new Error(`Expected 15.99, got ${result.amount}`);
});

test("quickRegexExtract: 'Amazon Prime membership $139.00/year' → amount=139", () => {
  const text = "From: Amazon\nSubject: Your Prime membership\nBody: Amazon Prime membership $139.00/year";
  const result = quickRegexExtract(text);
  if (!result) throw new Error("No match");
  if (result.amount !== 139) throw new Error(`Expected 139, got ${result.amount}`);
});

test("Generic billing: 'Total charged: $4.00' → amount=4.00", () => {
  const text = "Subject: Payment receipt\nBody: Total charged: $4.00 for this month";
  const result = quickRegexExtract(text);
  if (!result) throw new Error("No match");
  if (result.amount !== 4) throw new Error(`Expected 4, got ${result.amount}`);
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
