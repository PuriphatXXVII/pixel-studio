// Pixel Studio (web) — Model Battle: หลายโมเดล "ข้ามค่าย" แข่งออกแบบ brief เดียวกัน
// แต่ละตัว build → render → 🧐 vision-critic (Claude) ให้คะแนน → 👑 ตัดสิน + leaderboard สะสม
// contestants = pluggable + cross-vendor: Claude (Opus/Sonnet) + GPT-5.5 (OpenAI) + Gemini (Google)
// ไม่มี key → stub (variant ต่างกัน + คะแนน deterministic) เพื่อให้รัน pipeline ได้ keyless
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  clean, textOf,
  keyFor, hasKey, type Keys,
  SYSTEM, BUILDERS, buildWith, renderPng,
  type Builder,
} from "./models";

// clean and SYSTEM are re-exported from models; imported here for completeness.
void clean; void SYSTEM;

const CRITIC_MODEL = "claude-opus-4-8";

export type Contestant = Builder;
export type BattleResult = { name: string; vendor: string; accent: string; html: string; score: number; feedback: string; unavailable?: boolean; reason?: string };
type BuildResult = { html: string; unavailable?: boolean; reason?: string };
export type LeaderRow = { name: string; vendor: string; wins: number; runs: number; winRate: number; avg: number };
export type BattleEvent =
  | { type: "contestant"; result: BattleResult }
  | { type: "winner"; name: string; vendor: string; score: number; leaderboard: LeaderRow[] };

// 🥊 ผู้เข้าแข่ง — เพิ่ม/สลับโมเดลได้ตรงนี้ (cross-vendor). name = ชื่อโชว์, model = API id
const CONTESTANTS: Contestant[] = BUILDERS;

// stub component — ความ "รวย" ต่างกันตามโมเดล เพื่อให้ critic (อิงขนาด) ตัดสินได้
function stub(accent: string, label: string, features: string[], badge?: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-neutral-100 min-h-screen flex items-center justify-center p-10 font-sans">
  <div class="bg-neutral-900 text-white rounded-2xl p-8 w-80 shadow-2xl ring-1 ring-white/10 relative">
    ${badge ? `<span class="absolute -top-3 right-6 bg-${accent}-500 text-[11px] font-bold px-3 py-1 rounded-full">${badge}</span>` : ""}
    <p class="text-sm text-neutral-400">Starter</p>
    <p class="text-4xl font-black mt-1">$19<span class="text-base font-normal text-neutral-400">/mo</span></p>
    <ul class="mt-6 space-y-2 text-sm text-neutral-300">${features.map((f) => `<li>✓ ${f}</li>`).join("")}</ul>
    <button class="mt-7 w-full bg-${accent}-500 hover:bg-${accent}-400 transition rounded-xl py-2.5 font-bold">Get started</button>
    <p class="mt-3 text-[10px] text-neutral-500 text-center">${label} · stub</p>
  </div>
</body></html>`;
}

function stubFor(c: Contestant): string {
  if (c.name.includes("opus"))
    return stub(c.accent, c.name, ["Unlimited projects", "Priority 24/7 support", "Advanced analytics dashboard", "Full REST + webhook API access", "Custom domains & SSO"], "Popular");
  if (c.name.includes("gemini"))
    return stub(c.accent, c.name, ["Unlimited projects", "Priority support", "Analytics dashboard", "API access"]);
  if (c.name.includes("sonnet"))
    return stub(c.accent, c.name, ["Unlimited projects", "Priority support", "Analytics dashboard", "Team seats"]);
  if (c.name.includes("gpt"))
    return stub(c.accent, c.name, ["Unlimited projects", "Priority support", "Analytics dashboard", "API access", "Team seats"]);
  return stub(c.accent, c.name, ["Projects", "Email support", "Basic analytics"]);
}

async function buildFor(c: Contestant, brief: string, keys?: Keys): Promise<BuildResult> {
  const has = hasKey(c.vendor, keys);
  if (!has) return { html: stubFor(c) };
  try {
    return { html: await buildWith(c, brief, undefined, undefined, keys) };
  } catch (e) {
    const raw = (e instanceof Error ? e.message : String(e)).split("\n")[0]
      .replace(/sk-[A-Za-z0-9_-]+/g, "***")
      .replace(/AIza[A-Za-z0-9_-]+/g, "***")
      .slice(0, 120);
    console.error(`[battle] ${c.name} build failed:`, raw);
    return { html: "", unavailable: true, reason: raw };
  }
}

async function critic(brief: string, html: string, keys?: Keys): Promise<{ score: number; feedback: string }> {
  // stub: ให้คะแนนอิงความครบของ component (จำนวน feature) — deterministic, แยกอันดับชัด
  if (!hasKey("anthropic", keys)) {
    const feats = (html.match(/<li>/g) || []).length;
    const score = Math.max(5, Math.min(9, 4 + feats));
    return { score, feedback: "[stub] ตัดสินจากความครบของ component (ตั้ง ANTHROPIC_API_KEY เพื่อใช้ vision critic จริง)" };
  }
  const png = await renderPng(html);
  const client = new Anthropic({ apiKey: keyFor("anthropic", keys) });
  const res = await client.messages.create({
    model: CRITIC_MODEL,
    max_tokens: 800,
    system:
      "You are a ruthless, world-class UI design critic judging components head-to-head. " +
      "Be decisive and USE THE FULL 0–10 RANGE — do NOT cluster every score around 7–8. " +
      "Score anchors: 10 = exceptional/award-worthy · 9 = excellent · 7–8 = solid · 5–6 = generic or mediocre · 3–4 = weak/unbalanced · 0–2 = broken/incomplete. " +
      "Judge on: visual hierarchy, typography, spacing & balance, color & contrast, brief-fit, and overall polish. " +
      "Penalize generic, templated, or unfinished-looking designs. Reward genuinely better work and fail weak work — differentiate clearly.",
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
        { type: "text", text: `Brief: ${brief}\n\nScore this RENDERED component 0–10 (one decimal allowed, e.g. 8.5). Be critical and use the full range — don't default to 7–8. Then one short, specific reason in Thai (max 1 sentence).` },
      ],
    }],
    output_config: { format: { type: "json_schema", schema: { type: "object", properties: { score: { type: "number" }, feedback: { type: "string" } }, required: ["score", "feedback"], additionalProperties: false } } },
  } as Anthropic.MessageCreateParamsNonStreaming);
  return JSON.parse(textOf(res));
}

// 📊 leaderboard สะสม — เก็บลงไฟล์เพื่อให้ "อยู่ข้ามการ restart" (metric จริง)
// + cache บน globalThis เพื่อรอด HMR ตอน dev
type LbEntry = { vendor: string; wins: number; runs: number; total: number };
const LB_FILE = join(process.cwd(), "data", "leaderboard.json");

function loadLb(): Record<string, LbEntry> {
  try { return JSON.parse(readFileSync(LB_FILE, "utf8")); } catch { return {}; }
}
function saveLb() {
  try { mkdirSync(dirname(LB_FILE), { recursive: true }); writeFileSync(LB_FILE, JSON.stringify(LB, null, 2)); }
  catch (e) { console.error("[battle] save leaderboard failed:", e instanceof Error ? e.message : e); }
}

const g = globalThis as unknown as { __pixelLb?: Record<string, LbEntry> };
g.__pixelLb ??= loadLb();
const LB = g.__pixelLb;

function record(results: BattleResult[], winner: BattleResult) {
  for (const r of results) {
    LB[r.name] ??= { vendor: r.vendor, wins: 0, runs: 0, total: 0 };
    LB[r.name].runs++;
    LB[r.name].total += r.score;
  }
  LB[winner.name].wins++;
  saveLb();
}

function leaderboard(): LeaderRow[] {
  return Object.entries(LB)
    .map(([name, s]) => ({ name, vendor: s.vendor, wins: s.wins, runs: s.runs, winRate: Math.round((s.wins / s.runs) * 100), avg: +(s.total / s.runs).toFixed(1) }))
    .sort((a, b) => b.wins - a.wins || b.avg - a.avg);
}

// async generator: kick off all contestants concurrently, yield each result in completion order
export async function* runBattle(brief: string, keys?: Keys): AsyncGenerator<BattleEvent> {
  const results: BattleResult[] = [];

  const pending = new Map<number, Promise<{ i: number; result: BattleResult }>>(
    CONTESTANTS.map((c, i) => [
      i,
      (async () => {
        try {
          const built = await buildFor(c, brief, keys);
          if (built.unavailable) {
            const result: BattleResult = { name: c.name, vendor: c.vendor, accent: c.accent, html: "", score: 0, feedback: built.reason ?? "", unavailable: true, reason: built.reason };
            return { i, result };
          }
          const { score, feedback } = await critic(brief, built.html, keys);
          const result: BattleResult = { name: c.name, vendor: c.vendor, accent: c.accent, html: built.html, score, feedback };
          return { i, result };
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          return { i, result: { name: c.name, vendor: c.vendor, accent: c.accent, html: "", score: 0, feedback: reason, unavailable: true as const, reason } };
        }
      })(),
    ])
  );

  while (pending.size) {
    const { i, result } = await Promise.race(pending.values());
    pending.delete(i);
    results.push(result);
    yield { type: "contestant", result };
  }

  const ranked = results.filter((r) => !r.unavailable).sort((a, b) => b.score - a.score);
  if (ranked.length > 0) {
    const winner = ranked[0];
    record(ranked, winner);
    yield { type: "winner", name: winner.name, vendor: winner.vendor, score: winner.score, leaderboard: leaderboard() };
  } else {
    yield { type: "winner", name: "", vendor: "", score: 0, leaderboard: leaderboard() };
  }
}
