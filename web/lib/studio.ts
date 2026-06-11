// Pixel Studio (web) — multi-model relay critic loop, แบบ in-memory
// หลายโมเดลข้ามค่ายผลัดกันปรับปรุง best-so-far จนผ่าน ≥8/10
// ใช้โดย /api/design (SSE) — yield ทีละรอบเพื่อ stream ให้ดูสด
import Anthropic from "@anthropic-ai/sdk";
import { Builder, BUILDERS, buildWith, renderPng, keyFor, hasKey, type Keys } from "./models";

const MODEL = "claude-opus-4-8";
const PASS = 8;

export type Round = {
  n: number; html: string; by: string; vendor: string; role: string;
  score: number; pass: boolean; feedback: string; fixes: string[];
};

function fallbackHtml(accent = "rose"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-neutral-100 min-h-screen flex items-center justify-center p-10 font-sans">
  <div class="bg-neutral-900 text-white rounded-2xl p-8 w-80 shadow-2xl ring-1 ring-white/10">
    <p class="text-sm text-neutral-400">Starter</p>
    <p class="text-4xl font-black mt-1">$19<span class="text-base font-normal text-neutral-400">/mo</span></p>
    <ul class="mt-6 space-y-2 text-sm text-neutral-300"><li>✓ Unlimited projects</li><li>✓ Priority support</li><li>✓ Analytics dashboard</li><li>✓ API access</li></ul>
    <button class="mt-7 w-full bg-${accent}-500 hover:bg-${accent}-400 transition rounded-xl py-2.5 font-bold">Get started</button>
    <p class="mt-3 text-[10px] text-neutral-500 text-center">stub (${accent}) · set ANTHROPIC_API_KEY for AI design</p>
  </div>
</body></html>`;
}

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

const pick = (n: string) => BUILDERS.find((b) => b.name.includes(n))!;
const hasKeyFor = (b: Builder, keys?: Keys) => hasKey(b.vendor, keys);

// role-based relay: each model has a specific job so the component improves with each pass
type RelayStep = { b: Builder; job: string; instruction: string };
const RELAY: RelayStep[] = [
  { b: pick("gemini"), job: "Designer",  instruction: "Lay out the full initial structure — every section the brief asks for — with strong, creative visual design." },
  { b: pick("opus"),   job: "Architect", instruction: "Fix the structure, layout, and visual hierarchy; ensure EVERY element the brief requires is present and correctly arranged." },
  { b: pick("sonnet"), job: "Refiner",   instruction: "Refine spacing, alignment, typography, and color/contrast consistency." },
  { b: pick("gpt"),    job: "Finisher",  instruction: "Apply final polish: shadows, glassmorphism, micro-details — make it look premium and award-worthy." },
];

async function critic(brief: string, png: Buffer | null, round: number, keys?: Keys) {
  if (!hasKey("anthropic", keys)) {
    const s = [6, 8, 9, 9][round] ?? 9;
    return { score: s, pass: s >= PASS, feedback: "[stub] เพิ่ม contrast + ระยะห่างปุ่ม", fixes: ["accent เด่นขึ้น", "เพิ่ม padding"] };
  }
  const client = new Anthropic({ apiKey: keyFor("anthropic", keys) });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: "You are a senior design critic. You are shown a screenshot of a RENDERED UI component plus the brief it must satisfy. Judge visual quality AND brief-fit. Be specific and honest.",
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: png!.toString("base64") } },
        { type: "text", text: `Brief: ${brief}\n\nScore 0–10. If below 9, list concrete fixes (spacing, hierarchy, color, contrast, polish). Reasons in Thai, short.` },
      ],
    }],
    output_config: { format: { type: "json_schema", schema: { type: "object", properties: { score: { type: "integer" }, feedback: { type: "string" }, fixes: { type: "array", items: { type: "string" } } }, required: ["score", "feedback", "fixes"], additionalProperties: false } } },
  } as Anthropic.MessageCreateParamsNonStreaming);
  const data = JSON.parse(textOf(res));
  return { ...data, pass: data.score >= PASS };
}

// relay: yield each round; always revise the best-so-far so scores climb, not regress
export async function* runStudio(brief: string, keys?: Keys): AsyncGenerator<Round> {
  const step0 = RELAY[0];
  const html0 = hasKeyFor(step0.b, keys) ? await buildWith(step0.b, brief, undefined, step0.instruction, keys) : fallbackHtml();
  const png0 = hasKey("anthropic", keys) ? await renderPng(html0) : null;
  const crit0 = await critic(brief, png0, 0, keys);
  yield { n: 0, by: step0.b.name, vendor: step0.b.vendor, role: step0.job, html: html0, ...crit0 };
  let best = { html: html0, crit: crit0 };

  for (let n = 1; !best.crit.pass && n < RELAY.length; n++) {
    const step = RELAY[n];
    const html = hasKeyFor(step.b, keys)
      ? await buildWith(step.b, brief, { html: best.html, feedback: best.crit.feedback, fixes: best.crit.fixes, score: best.crit.score }, step.instruction, keys)
      : fallbackHtml();
    const png = hasKey("anthropic", keys) ? await renderPng(html) : null;
    const crit = await critic(brief, png, n, keys);
    yield { n, by: step.b.name, vendor: step.b.vendor, role: step.job, html, ...crit };
    if (crit.score > best.crit.score) best = { html, crit };
  }
}
