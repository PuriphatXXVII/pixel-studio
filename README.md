<div align="center">

# 🎨 Pixel Studio

### A multi-model AI studio that designs UI components — and judges its own work by looking at the pixels.

Models from **three vendors** (Anthropic · OpenAI · Google) collaborate: in the **Critic-loop relay**, a team of models — 🎨 Designer → 🏗️ Architect → ✨ Refiner → 💎 Finisher — each improve one component, judged by a **vision Critic** that scores the *rendered screenshot*; in **Model Battle**, they go head-to-head on a leaderboard. **Bring your own key** — it runs entirely on the keys you paste in your own browser.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-render-2EAD33?logo=playwright&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Opus_+_Sonnet-D97757?logo=anthropic&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5.5-412991?logo=openai&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-3.1_Pro-4285F4?logo=googlegemini&logoColor=white)
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

## 🖥️ Web UI (`web/`)

A **Next.js 16** app that turns the studio into a live demo. Two tabs, both stream live over SSE:

- **🔄 Critic loop — a multi-model relay.** A **team of models from different vendors** improves one component round by round, each with a real job:
  **🎨 Gemini 3.1 Pro** (Designer) → **🏗️ Claude Opus 4.8** (Architect) → **✨ Claude Sonnet 4.6** (Refiner) → **💎 OpenAI GPT-5.5** (Finisher). Each round revises the **best result so far** (so scores climb, not regress); a **consistent Claude-Opus vision critic** scores every round; 👑 marks the top one.
- **⚔️ Model battle — 4-way cross-vendor.** **Opus 4.8 · Sonnet 4.6 · GPT-5.5 · Gemini 3.1 Pro** design the *same* brief side-by-side; the vision-critic scores each (seeing the **full-page** screenshot), crowns a 👑 winner, and a persisted **leaderboard** tracks win-rate + average score.

Every generated component can be **previewed full-screen**, **copied / downloaded** as standalone HTML, or **shared** via a public `/p/<id>` link.

🔑 **BYOK (bring your own key)** — paste your Anthropic / OpenAI / Google keys in the app; they're stored **only in your browser** (localStorage) and sent **per-request in the POST body — never to a database, never logged**. So a public deploy costs the owner nothing: every visitor runs on their own keys.

🌏 **Bilingual** — write the brief in **Thai or English**; the AI writes the component's copy in that same language.

```bash
cd web
npm install
npm run dev        # http://localhost:3000  → paste your keys in the 🔑 panel
```

**Local dev can also use env keys** (stub fallback runs the whole pipeline keyless):

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # Claude builder(s) + vision critic
$env:OPENAI_API_KEY     = "sk-proj-..."  # GPT-5.5
$env:GEMINI_API_KEY     = "AIza..."      # Gemini 3.1 Pro
```

> Resolution order per request: **your pasted key → server env → keyless stub**. Gemini & OpenAI are called via REST directly (no extra SDKs). The critic is Claude vision — an honest caveat in a cross-vendor battle, noted for transparency.

## 🛠️ Tech

**Next.js 16** (web UI, SSE over `fetch` + `ReadableStream`) · **Playwright** (render to full-page screenshot) · **Anthropic Claude** — builder(s) + **vision** critic, structured JSON outputs · **OpenAI GPT-5.5** (REST) · **Google Gemini 3.1 Pro** (REST) · **Tailwind** (CDN) · **BYOK** per-request key threading. Pluggable cross-vendor model roster.

---

<div align="center">

Built by [**Puriphat Srikamnoi**](https://github.com/PuriphatXXVII) · [Portfolio](https://puriphatxxvii.github.io/my-portfolio/)

</div>
