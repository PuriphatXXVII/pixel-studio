// Pixel Studio (web) — build → render → vision critic loop, แบบ in-memory (ไม่เขียนไฟล์)
// ใช้โดย /api/design (SSE) — yield ทีละรอบเพื่อ stream ให้ดูสด
import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";

const MODEL = "claude-opus-4-8";
const PASS = 8;
const MAX_ROUNDS = 3;
const hasKey = () => !!process.env.ANTHROPIC_API_KEY;

export type Round = { n: number; html: string; by: string; score: number; pass: boolean; feedback: string; fixes: string[] };

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

async function build(brief: string, opts: { html?: string; feedback?: string; fixes?: string[]; score?: number } = {}) {
  const revising = !!opts.feedback;
  if (!hasKey()) return { html: fallbackHtml(revising ? "indigo" : "rose"), by: "stub" };
  const client = new Anthropic();
  const system = revising
    ? "You are a senior frontend designer improving an existing UI component from a critic's feedback. Return the FULL improved self-contained HTML (Tailwind via CDN). Raw HTML only."
    : "You are a senior frontend designer. Output ONE self-contained HTML document for the requested UI component. Load Tailwind via <script src=\"https://cdn.tailwindcss.com\"></script>. Center it on a neutral page with padding. Polished and modern. Raw HTML only, starting with <!doctype html>.";
  const user = revising
    ? `Brief:\n${brief}\n\nCurrent HTML:\n${opts.html}\n\nCritic (${opts.score}/10):\n${opts.feedback}\nFixes:\n- ${(opts.fixes || []).join("\n- ")}\n\nReturn the improved full HTML.`
    : `Build this UI component:\n${brief}`;
  const res = await client.messages.create({ model: MODEL, max_tokens: 4000, system, messages: [{ role: "user", content: user }] });
  const html = textOf(res).trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
  return { html, by: MODEL };
}

async function renderPng(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    return await page.screenshot();
  } finally {
    await browser.close();
  }
}

async function critic(brief: string, png: Buffer | null, round: number) {
  if (!hasKey()) {
    const s = [6, 8, 9, 9][round] ?? 9;
    return { score: s, pass: s >= PASS, feedback: "[stub] เพิ่ม contrast + ระยะห่างปุ่ม", fixes: ["accent เด่นขึ้น", "เพิ่ม padding"] };
  }
  const client = new Anthropic();
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

// loop: yield ทีละรอบ (build → render → critic → แก้)
export async function* runStudio(brief: string): AsyncGenerator<Round> {
  let { html, by } = await build(brief);
  let png = hasKey() ? await renderPng(html) : null;
  let crit = await critic(brief, png, 0);
  yield { n: 0, html, by, ...crit };

  let n = 0;
  while (!crit.pass && n < MAX_ROUNDS - 1) {
    n++;
    ({ html, by } = await build(brief, { html, feedback: crit.feedback, fixes: crit.fixes, score: crit.score }));
    png = hasKey() ? await renderPng(html) : null;
    crit = await critic(brief, png, n);
    yield { n, html, by, ...crit };
  }
}
