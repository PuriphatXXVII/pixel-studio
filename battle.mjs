// Pixel Studio — Slice 3: Model Battle + Leaderboard
// -------------------------------------------------------------
// brief เดียว → หลายโมเดลสร้าง component "แข่งกัน" → 🧐 vision-critic ให้คะแนนทุกตัว
//   → 👑 ตัดสินผู้ชนะ → battle.png (เทียบกัน) → leaderboard สะสมข้ามรัน (ใครชนะกี่ %)
//
// contestants = pluggable: เพิ่มโมเดลได้ (เช่น Gemini) — ดู README
// ไม่มี key → stub (สร้าง variant ต่างกัน + ให้คะแนนอิงขนาดไฟล์) เพื่อทดสอบ pipeline
//
// รัน:  node battle.mjs ["brief"]   (หรือ npm run battle)
// -------------------------------------------------------------
import { writeFileSync, readFileSync, existsSync, copyFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { build, render, critic } from "./build.mjs";

const BRIEF = process.argv.slice(2).join(" ") || "A pricing card for a SaaS product — modern, with price, 4 feature bullets, and a CTA button.";
const LB = "leaderboard.json";
const hasKey = !!process.env.ANTHROPIC_API_KEY;

// 🥊 ผู้เข้าแข่ง — เพิ่มได้ (เช่น { name: "gemini-2.5-flash", style: "..." } เมื่อต่อ Gemini)
const contestants = [
  { name: "claude-opus-4-8", style: "rose" },
  { name: "claude-haiku-4-5", style: "light" },
];

console.log(`⚔️  Pixel Studio · Slice 3 — Model Battle`);
console.log(`   brief: "${BRIEF}"`);
console.log(`   ผู้เข้าแข่ง: ${contestants.map((c) => c.name).join("  vs  ")}${hasKey ? "" : "  (stub)"}\n`);

// แต่ละโมเดล: สร้าง → render → ให้ critic ตัดสิน
const results = [];
for (const c of contestants) {
  const { html, by } = await build(BRIEF, { model: c.name, style: c.style });
  const slug = c.name.replace(/[^a-z0-9]/gi, "-");
  const file = `battle-${slug}.html`;
  const png = `battle-${slug}.png`;
  writeFileSync(file, html, "utf8");
  await render(file, png);
  const crit = await critic(BRIEF, png);
  results.push({ name: c.name, by, png, ...crit });
  console.log(`   ${c.name.padEnd(20)} → ${crit.score}/10`);
}

results.sort((a, b) => b.score - a.score);
const winner = results[0];
console.log(`\n🏆 ผู้ชนะ: ${winner.name} (${winner.score}/10)`);

// 🖼️ battle.png — เทียบกัน + 👑 ผู้ชนะ
const frames = results.map((r, i) =>
  `<figure style="margin:0;text-align:center;font:600 14px system-ui;color:#e5e5e5;">
     <img src="${pathToFileURL(resolve(r.png)).href}" style="width:340px;border-radius:12px;border:2px solid ${i === 0 ? "#f59e0b" : "#333"};"/>
     <figcaption style="margin-top:10px;">${i === 0 ? "👑 " : ""}${r.name} · ${r.score}/10</figcaption>
   </figure>`).join("");
writeFileSync("_b.html", `<!doctype html><html><body style="margin:0;background:#0a0a0a;padding:32px;display:flex;gap:28px;align-items:flex-start;">${frames}</body></html>`, "utf8");
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve("_b.html")).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "battle.png", fullPage: true });
  await browser.close();
}
unlinkSync("_b.html");
copyFileSync(winner.png, "winner.png");

// 📊 leaderboard — สะสมข้ามทุกรัน
const lb = existsSync(LB) ? JSON.parse(readFileSync(LB, "utf8")) : {};
for (const r of results) {
  lb[r.name] ??= { wins: 0, runs: 0, totalScore: 0 };
  lb[r.name].runs++;
  lb[r.name].totalScore += r.score;
}
lb[winner.name].wins++;
writeFileSync(LB, JSON.stringify(lb, null, 2), "utf8");

const battles = Math.max(...Object.values(lb).map((s) => s.runs));
const rows = Object.entries(lb)
  .sort((a, b) => b[1].wins - a[1].wins)
  .map(([m, s]) => `| ${m} | ${s.wins}/${s.runs} | ${Math.round((s.wins / s.runs) * 100)}% | ${(s.totalScore / s.runs).toFixed(1)} |`)
  .join("\n");
writeFileSync("leaderboard.md",
  `# ⚔️ Pixel Studio — Model Leaderboard

Which model designs the best UI? Updated after every battle.

| Model | Wins | Win-rate | Avg score |
|-------|:----:|:--------:|:---------:|
${rows}

_${battles} battle(s) run · updated ${new Date().toISOString().slice(0, 10)}_
`, "utf8");

console.log(`\n✅ battle.png · winner.png · leaderboard.md (${battles} battles total)`);
