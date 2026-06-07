<div align="center">

# 🎨 Pixel Studio

### A multi-model AI studio that designs UI components — and judges its own work by looking at the pixels.

Multiple AI models collaborate: a **Builder** designs a component, a **vision Critic** looks at the *rendered screenshot* and scores it, the Builder revises until it passes — and rival models **battle head-to-head** on a leaderboard.

![Node](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-render-2EAD33?logo=playwright&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-vision_critic-D97757?logo=anthropic&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CDN-38BDF8?logo=tailwindcss&logoColor=white)

</div>

---

## 🎯 What it does — 3 patterns of multi-model collaboration

| Mode | What happens |
|------|--------------|
| 🎨 **Build** (`build.mjs`) | A brief → an AI designs a self-contained Tailwind component → Playwright renders it to a real screenshot. |
| 🎬 **Critic loop** (`studio.mjs`) | Builder → render → a **vision Critic (Claude) looks at the actual screenshot**, scores it 0–10, lists fixes → Builder revises → repeat until it passes. Saves an **evolution strip** showing the AI improving its own design. |
| ⚔️ **Model Battle** (`battle.mjs`) | Rival models design the *same* brief; the vision-critic scores each and crowns a 👑 winner; a **leaderboard** tracks win-rate and average score across runs. |

`gallery.mjs` rolls the latest results into one shareable `gallery.html`.

## 💡 The clever bit

The critic **doesn't read the code — it looks at the rendered pixels** (vision) and critiques what the component *actually looks like*, then the builder fixes it. That's a real **generator ↔ critic agentic loop**, closed by an AI's eyes. The builder panel and battle contestants are **pluggable arrays** — adding another model (e.g. a free Gemini tier) for true cross-vendor design is a one-line change.

## 🏗️ Architecture

```
brief ─▶ 🎨 Builder (AI) ─▶ 🖼️ render (Playwright) ─▶ 🧐 Critic (Claude vision: ดูภาพจริง)
                ▲                                              │
                └──────────── revise จาก feedback ◀── score < 8? ┘   → evolution.png

Model Battle:  brief ─▶ [model A] + [model B] แข่งกัน ─▶ critic ตัดสิน 👑 ─▶ leaderboard
```

## ⚙️ Run

```bash
npm install
npx playwright install chromium      # first run only

node build.mjs   "a pricing card for a SaaS, dark theme"   # single component → preview.png
node studio.mjs  "a glassy login form"                     # critic loop      → evolution.png
node battle.mjs  "a hero section for an AI startup"        # model battle     → battle.png + leaderboard
node gallery.mjs                                           # combine          → gallery.html
```

**AI is optional.** Set `ANTHROPIC_API_KEY` to use Claude (builder + vision critic); without it everything runs on a deterministic **stub** so the full pipeline works keyless (handy for dev). 

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # PowerShell
node battle.mjs "a testimonial card"
```

## 🛠️ Tech

**Node.js (ESM)** · **Playwright** (render to screenshot) · **Anthropic Claude** — builder + **vision** critic, structured JSON outputs · **Tailwind** (CDN). Pluggable model panel (Claude Opus / Haiku today; Gemini-ready).

---

<div align="center">

Built by [**Puriphat Srikamnoi**](https://github.com/PuriphatXXVII) · [Portfolio](https://puriphatxxvii.github.io/my-portfolio/)

</div>
