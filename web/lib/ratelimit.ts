// In-memory rate limiter — safe for a single Railway instance.
// Sliding-window per-IP + global daily cap for owner-funded (keyless) runs.

const ipHits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function ipAllowed(ip: string): boolean {
  const max = Number(process.env.RL_PER_IP_MAX ?? 6);
  const window = 60_000;
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < window);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length <= max;
}

// ── Daily demo quota (owner-funded / keyless runs) ────────────────────────────
let day = new Date().toISOString().slice(0, 10);
let dayCount = 0;
const DEMO_DAILY_CAP = Number(process.env.DEMO_DAILY_CAP ?? 80);

export function demoQuotaAllowed(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DEMO_DAILY_CAP) return false;
  dayCount++;
  return true;
}

export function usedOwnerKeys(keys?: { anthropic?: string; gemini?: string; openai?: string }): boolean {
  return !(keys?.anthropic || keys?.gemini || keys?.openai);
}
