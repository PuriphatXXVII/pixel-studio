// Pixel Studio — shared agents: build · render · critic
// -------------------------------------------------------------
// export: fallbackHtml(style) · build(brief, opts) · render(file,out) · critic(brief,png,opts)
// CLI:    node build.mjs ["brief"]   → build + render ช็อตเดียว (Slice 1)
// -------------------------------------------------------------
import { writeFileSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-4-8";
const CRITIC_MODEL = "claude-opus-4-8"; // critic ใช้ vision; opus เน้นรสนิยมดีไซน์
const PASS_SCORE = 8;

export function fallbackHtml(style = "rose") {
  if (style === "light") {
    return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gradient-to-br from-slate-50 to-slate-200 min-h-screen flex items-center justify-center p-12 font-sans">
  <div class="bg-white text-slate-900 rounded-2xl p-8 w-80 shadow-xl ring-1 ring-slate-200">
    <p class="text-sm font-semibold text-emerald-600">Starter</p>
    <p class="text-4xl font-black mt-1">$19<span class="text-base font-normal text-slate-400">/mo</span></p>
    <ul class="mt-6 space-y-2 text-sm text-slate-600"><li>✓ Unlimited projects</li><li>✓ Priority support</li><li>✓ Analytics dashboard</li><li>✓ API access</li></ul>
    <button class="mt-7 w-full bg-emerald-600 hover:bg-emerald-500 text-white transition rounded-xl py-2.5 font-bold">Get started</button>
    <p class="mt-3 text-[10px] text-slate-400 text-center">fallback (light) · set keys for AI design</p>
  </div>
</body></html>`;
  }
  const accent = style === "indigo" ? "indigo" : "rose";
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-neutral-100 min-h-screen flex items-center justify-center p-12 font-sans">
  <div class="bg-neutral-900 text-white rounded-2xl p-8 w-80 shadow-2xl ring-1 ring-white/10">
    <p class="text-sm text-neutral-400">Starter</p>
    <p class="text-4xl font-black mt-1">$19<span class="text-base font-normal text-neutral-400">/mo</span></p>
    <ul class="mt-6 space-y-2 text-sm text-neutral-300"><li>✓ Unlimited projects</li><li>✓ Priority support</li><li>✓ Analytics dashboard</li><li>✓ API access</li></ul>
    <button class="mt-7 w-full bg-${accent}-500 hover:bg-${accent}-400 transition rounded-xl py-2.5 font-bold">Get started</button>
    <p class="mt-3 text-[10px] text-neutral-500 text-center">fallback (${accent}) · set ANTHROPIC_API_KEY for AI design</p>
  </div>
</body></html>`;
}

// build ใหม่ หรือ "แก้ตาม feedback" — เลือก model ได้ (opts.model)
export async function build(brief, opts = {}) {
  const revising = !!opts.feedback;
  if (!process.env.ANTHROPIC_API_KEY) {
    return { html: fallbackHtml(opts.style || (revising ? "indigo" : "rose")), by: (opts.model || "fallback") + " (stub)" };
  }
  const model = opts.model || DEFAULT_MODEL;
  const client = new Anthropic();
  const system = revising
    ? "You are a senior frontend designer improving an existing UI component based on a design critic's feedback. " +
      "Return the FULL improved self-contained HTML document. Keep Tailwind via the CDN. Raw HTML only — no markdown."
    : "You are a senior frontend designer. Output ONE self-contained HTML document for the requested UI component. " +
      'Load Tailwind via <script src="https://cdn.tailwindcss.com"></script>. Center it on a neutral page with padding. ' +
      "Make it polished and modern. Return ONLY raw HTML starting with <!doctype html>.";
  const user = revising
    ? `Brief:\n${brief}\n\nCurrent HTML:\n${opts.html}\n\nCritic (scored ${opts.score}/10):\n${opts.feedback}\nFixes:\n- ${(opts.fixes || []).join("\n- ")}\n\nReturn the improved full HTML.`
    : `Build this UI component:\n${brief}`;
  const res = await client.messages.create({ model, max_tokens: 4000, system, messages: [{ role: "user", content: user }] });
  const html = res.content.find((b) => b.type === "text").text.trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
  return { html, by: model };
}

// render HTML → screenshot (รอ Tailwind CDN)
export async function render(file, out) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out });
  await browser.close();
}

// 🧐 critic — มองภาพจริง (vision) ให้คะแนน 0–10 + จุดแก้
// opts.round (เลข) → stub จำลองคะแนนไต่ขึ้น (สำหรับ loop Slice 2); ไม่มี → stub อิงขนาดไฟล์ (สำหรับ battle)
export async function critic(brief, pngPath, opts = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const s = opts.round != null ? ([6, 8, 9, 9][opts.round] ?? 9) : 6 + (statSync(pngPath).size % 4);
    return { score: s, pass: s >= PASS_SCORE, feedback: "[stub] เพิ่ม contrast + ระยะห่างปุ่ม", fixes: ["accent เด่นขึ้น", "เพิ่ม padding"] };
  }
  const client = new Anthropic();
  const b64 = readFileSync(pngPath).toString("base64");
  const res = await client.messages.create({
    model: CRITIC_MODEL,
    max_tokens: 1200,
    system: "You are a senior design critic. You are shown a screenshot of a RENDERED UI component plus the brief it must satisfy. " +
      "Judge visual quality AND brief-fit. Be specific and honest — don't be nice.",
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        { type: "text", text: `Brief: ${brief}\n\nScore 0–10. If below 9, list concrete fixes (spacing, hierarchy, color, contrast, polish). Reasons in Thai, short.` },
      ],
    }],
    output_config: {
      format: {
        type: "json_schema",
        schema: { type: "object", properties: { score: { type: "integer" }, feedback: { type: "string" }, fixes: { type: "array", items: { type: "string" } } }, required: ["score", "feedback", "fixes"], additionalProperties: false },
      },
    },
  });
  const data = JSON.parse(res.content.find((b) => b.type === "text").text);
  return { ...data, pass: data.score >= PASS_SCORE };
}

// ---- CLI (Slice 1) ----
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const brief = process.argv.slice(2).join(" ") || "A pricing card for a SaaS product — dark theme, modern, price, 4 feature bullets, CTA.";
  console.log(`🎨 Pixel Studio · build\n   brief: "${brief}"\n`);
  const { html, by } = await build(brief);
  writeFileSync("component.html", html, "utf8");
  console.log(`✍️  Builder (${by}) → component.html`);
  await render("component.html", "preview.png");
  console.log(`🖼️  rendered → preview.png ✅`);
}
