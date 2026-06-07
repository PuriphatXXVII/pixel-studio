// Pixel Studio — Slice 2: vision Critic + revise loop + evolution strip
// -------------------------------------------------------------
// brief → build → render → 🧐 critic (vision) → ไม่ผ่าน? Builder แก้ → วน (≤MAX) → evolution.png + log
// ไม่มี key → critic เป็น stub (คะแนนไต่ขึ้น) เพื่อทดสอบ loop
// รัน:  node studio.mjs ["brief"]
// -------------------------------------------------------------
import { writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { build, render, critic } from "./build.mjs";

const BRIEF = process.argv.slice(2).join(" ") || "A pricing card for a SaaS product — dark theme, modern, price, 4 feature bullets, CTA.";
const MAX_ROUNDS = 3;
const hasKey = !!process.env.ANTHROPIC_API_KEY;

console.log(`🎨 Pixel Studio · Slice 2 (critic loop)\n   brief: "${BRIEF}"`);
console.log(`   critic: ${hasKey ? "claude (vision)" : "stub (no key)"}\n`);

const rounds = [];
let { html } = await build(BRIEF);
writeFileSync("component.html", html, "utf8");
let png = "round-0.png";
await render("component.html", png);
let crit = await critic(BRIEF, png, { round: 0 });
rounds.push({ n: 0, png, ...crit });
console.log(`รอบ 0 → ${crit.score}/10  ${crit.pass ? "✓ ผ่าน" : "↻ แก้"}  ${crit.feedback}`);

let n = 0;
while (!crit.pass && n < MAX_ROUNDS - 1) {
  n++;
  ({ html } = await build(BRIEF, { html, feedback: crit.feedback, fixes: crit.fixes, score: crit.score }));
  writeFileSync("component.html", html, "utf8");
  png = `round-${n}.png`;
  await render("component.html", png);
  crit = await critic(BRIEF, png, { round: n });
  rounds.push({ n, png, ...crit });
  console.log(`รอบ ${n} → ${crit.score}/10  ${crit.pass ? "✓ ผ่าน" : "↻ แก้"}  ${crit.feedback}`);
}

copyFileSync(png, "preview.png");

// 🎬 evolution strip
const frames = rounds.map((r) =>
  `<figure style="margin:0;text-align:center;font:600 13px system-ui;color:#e5e5e5;">
     <img src="${pathToFileURL(resolve(r.png)).href}" style="width:300px;border-radius:10px;border:1px solid #333;"/>
     <figcaption style="margin-top:8px;">Round ${r.n} · ${r.score}/10 ${r.pass ? "✓" : ""}</figcaption>
   </figure>`).join("");
writeFileSync("_strip.html", `<!doctype html><html><body style="margin:0;background:#0a0a0a;padding:28px;display:flex;gap:20px;align-items:flex-start;">${frames}</body></html>`, "utf8");
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve("_strip.html")).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "evolution.png", fullPage: true });
  await browser.close();
}
unlinkSync("_strip.html");

// 📝 studio log
writeFileSync("studio-log.md",
  `# 🎨 Pixel Studio — Studio Log

**Brief:** ${BRIEF}
**Critic:** ${hasKey ? "claude (vision)" : "stub"} · **Pass score:** 8/10

| Round | Score | Verdict | Critic feedback |
|------:|:-----:|:-------:|-----------------|
${rounds.map((r) => `| ${r.n} | ${r.score}/10 | ${r.pass ? "✓ pass" : "↻ revise"} | ${r.feedback.replace(/\|/g, "/")} |`).join("\n")}

**Result:** ${rounds.at(-1).pass ? "passed" : "stopped at max rounds"} in ${rounds.length} round(s) — score ${rounds[0].score} → ${rounds.at(-1).score}.
`, "utf8");

console.log(`\n✅ เสร็จใน ${rounds.length} รอบ — คะแนน ${rounds[0].score} → ${rounds.at(-1).score}`);
console.log(`   ไฟล์: component.html · preview.png · round-*.png · evolution.png · studio-log.md`);
