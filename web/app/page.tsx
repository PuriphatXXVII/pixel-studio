"use client";
import { useState, useEffect } from "react";
import { RefreshCcw, Swords, Bot, Eye, Languages, Wand2, Loader2, Crown, Trophy, Medal, TriangleAlert, Check, RotateCw, Maximize2, X, Copy, Download, Share2, KeyRound } from "lucide-react";
import { frame } from "@/lib/frame";

type Round = { n: number; html: string; by: string; vendor: string; role: string; score: number; pass: boolean; feedback: string };
type CResult = { name: string; vendor: string; accent: string; html: string; score: number; feedback: string; unavailable?: boolean; reason?: string };
type LeaderRow = { name: string; vendor: string; wins: number; runs: number; winRate: number; avg: number };

const VENDOR: Record<string, { label: string; cls: string }> = {
  anthropic: { label: "Anthropic", cls: "bg-orange-500/20 text-orange-300" },
  google: { label: "Google", cls: "bg-sky-500/20 text-sky-300" },
  openai: { label: "OpenAI", cls: "bg-teal-500/20 text-teal-300" },
};
const EXPECTED_CONTESTANTS = 4; // ใช้โชว์ skeleton ระหว่างรอผล (ดู lib/battle.ts)

// โชว์ชื่อรุ่นให้สวย: "claude-opus-4-8" → "claude-opus-4.8" (model id จริงยังเป็น -8 ตอนเรียก API)
const pretty = (id: string) => id.replace(/-(\d+)-(\d+)$/, "-$1.$2");

// ── BYOK: per-user API keys stored in localStorage ────────────────────────────
type Keys = { anthropic?: string; gemini?: string; openai?: string };
const BYOK_KEY = "pixel-byok";
function loadKeys(): Keys {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(BYOK_KEY) ?? "{}") as Keys; } catch { return {}; }
}
function saveKeys(k: Keys) { localStorage.setItem(BYOK_KEY, JSON.stringify(k)); }

// ── SSE over POST: keys travel in the body, never in the URL ─────────────────
async function streamSSE(path: string, body: unknown, onEvent: (msg: unknown) => void): Promise<void> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json().catch(() => ({} as { message?: string })); onEvent({ type: "error", message: e.message ?? `HTTP ${res.status}` }); return; }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line) continue;
      const data = line.startsWith("data: ") ? line.slice(6) : line;
      try { onEvent(JSON.parse(data)); } catch { /* skip malformed frames */ }
    }
  }
}

type PreviewItem = { html: string; title: string; score?: number };
type OnPreview = (p: PreviewItem) => void;


function StubBanner() {
  return (
    <div className="mt-6 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 px-4 py-3 text-sm text-amber-200 leading-relaxed flex items-start gap-2">
      <TriangleAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
      <span>
        <b>โหมด stub</b> — ยังไม่ได้ตั้ง <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-100">ANTHROPIC_API_KEY</code> การ์ดที่เห็นเป็น<b>ตัวอย่างคงที่</b> (ไม่ได้สร้างจาก brief ที่พิมพ์) — ใส่ key แล้วรัน dev ใหม่ AI จะออกแบบตามข้อความจริง รวมถึงภาษาไทย 🌏
      </span>
    </div>
  );
}

function SkeletonCard({ label, h = "h-64" }: { label: string; h?: string }) {
  return (
    <div className="bg-neutral-900 rounded-2xl ring-1 ring-white/10 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="h-3 w-24 bg-white/10 rounded" />
        <div className="h-5 w-14 bg-white/10 rounded-full" />
      </div>
      <div className={`${h} bg-white/[0.03] grid place-items-center`}>
        <span className="text-xs text-neutral-600">{label}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="h-2.5 w-full bg-white/10 rounded" />
        <div className="h-2.5 w-2/3 bg-white/10 rounded" />
      </div>
    </div>
  );
}

function ExportButtons({ html, filename = "component.html" }: { html: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  const btn = "text-[11px] inline-flex items-center gap-1 text-neutral-400 hover:text-white transition";
  return (
    <>
      <button onClick={copy} className={btn} title="คัดลอก HTML">
        {copied
          ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">คัดลอกแล้ว</span></>
          : <><Copy className="w-3.5 h-3.5" /> Copy</>}
      </button>
      <button onClick={download} className={btn} title="ดาวน์โหลด HTML">
        <Download className="w-3.5 h-3.5" /> Download
      </button>
    </>
  );
}

function ShareButton({ html, title, score }: { html: string; title: string; score?: number }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  async function share() {
    if (state !== "idle") return;
    setState("saving");
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, title, score }),
      });
      const { id } = (await res.json()) as { id: string };
      await navigator.clipboard.writeText(`${location.origin}/p/${id}`);
      setState("done");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("idle");
    }
  }
  const btn = "text-[11px] inline-flex items-center gap-1 text-neutral-400 hover:text-white transition disabled:opacity-50";
  return (
    <button onClick={share} disabled={state === "saving"} className={btn} title="แชร์ลิงก์">
      {state === "saving"
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : state === "done"
          ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">คัดลอกลิงก์แล้ว</span></>
          : <><Share2 className="w-3.5 h-3.5" /> Share</>}
    </button>
  );
}

const TABS = [
  { key: "studio", label: "Critic loop", Icon: RefreshCcw },
  { key: "battle", label: "Model battle", Icon: Swords },
] as const;

// ดูงานที่ AI สร้างแบบเต็มจอ (portfolio-style)
function PreviewModal({ preview, onClose }: { preview: PreviewItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [preview, onClose]);
  if (!preview) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex p-4 sm:p-8" onClick={onClose}>
      <div className="max-w-6xl w-full mx-auto flex flex-col bg-neutral-900 rounded-2xl ring-1 ring-white/15 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="font-bold text-sm inline-flex items-center gap-2">
            {preview.title}
            {preview.score != null && <span className="text-emerald-300 font-black">· {preview.score}/10</span>}
          </span>
          <div className="flex items-center gap-3">
            <ExportButtons html={preview.html} />
            <ShareButton html={preview.html} title={preview.title} score={preview.score} />
            <button onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-white transition"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <iframe srcDoc={frame(preview.html)} title={preview.title} className="w-full h-[78vh] bg-white border-0" sandbox="allow-scripts" />
      </div>
    </div>
  );
}

function KeysModal({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<Keys>(loadKeys);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const inp = (label: string, placeholder: string, k: keyof Keys) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      <input type="password" value={draft[k] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
        placeholder={placeholder} autoComplete="off"
        className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500" />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-2xl ring-1 ring-white/15 shadow-2xl w-full max-w-md p-6 flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2"><KeyRound className="w-4 h-4 text-rose-400" /> BYOK — คีย์ของคุณ</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col gap-4">
          {inp("Anthropic (Claude)", "sk-ant-…", "anthropic")}
          {inp("Google Gemini", "AIza…", "gemini")}
          {inp("OpenAI", "sk-…", "openai")}
        </div>
        <p className="text-[11px] text-neutral-500 leading-relaxed">คีย์เก็บในเบราว์เซอร์ของคุณเท่านั้น — ไม่ถูกส่งเข้าฐานข้อมูล/บันทึก</p>
        <button onClick={() => { saveKeys(draft); onClose(); }}
          className="bg-rose-500 hover:bg-rose-400 transition rounded-xl py-2.5 font-bold text-sm">
          บันทึกคีย์
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"studio" | "battle">("studio");
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [hasAnyKey, setHasAnyKey] = useState(() => Object.values(loadKeys()).some(Boolean));
  function handleKeysClose() { setKeysOpen(false); setHasAnyKey(Object.values(loadKeys()).some(Boolean)); }
  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          🎨 Pixel <span className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">Studio</span>
        </h1>
        <p className="text-neutral-400 mt-2">โมเดล AI หลายตัวช่วยกันออกแบบ UI — แล้ว <b className="text-white">ตัดสินงานจากภาพที่ render จริง</b></p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {[{ Icon: Bot, label: "multi-model" }, { Icon: Eye, label: "vision critic" }, { Icon: Languages, label: "พิมพ์ไทย/อังกฤษ" }].map(({ Icon, label }) => (
            <span key={label} className="px-2.5 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-300 inline-flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" /> {label}
            </span>
          ))}
        </div>

        {/* tabs + BYOK key button */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-neutral-900 ring-1 ring-white/10 rounded-xl p-1">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition inline-flex items-center gap-2 ${tab === key ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <button onClick={() => setKeysOpen(true)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-bold transition ring-1 ${hasAnyKey ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" : "bg-amber-500/10 ring-amber-500/30 text-amber-300 hover:bg-amber-500/20"}`}>
            <KeyRound className="w-3.5 h-3.5" /> {hasAnyKey ? "🔑 คีย์ของคุณ" : "⚠️ ใส่ API key"}
          </button>
        </div>

        {tab === "studio" ? <Studio onPreview={setPreview} /> : <Battle onPreview={setPreview} />}

        <p className="text-neutral-600 text-xs mt-12">Pixel Studio · multi-model AI design studio</p>
      </div>
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      {keysOpen && <KeysModal onClose={handleKeysClose} />}
    </main>
  );
}

function Studio({ onPreview }: { onPreview: OnPreview }) {
  const [brief, setBrief] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bestN = rounds.length ? rounds.reduce((a, b) => (b.score >= a.score ? b : a)).n : -1;

  async function run() {
    if (running) return;
    setRounds([]);
    setErr(null);
    setRunning(true);
    try {
      await streamSSE("/api/design", { brief, keys: loadKeys() }, (msg) => {
        const m = msg as { type: string } & Record<string, unknown>;
        if (m.type === "round") setRounds((r) => [...r, m as unknown as Round]);
        else if (m.type === "done") setRunning(false);
        else if (m.type === "error") { setRunning(false); setErr(String(m.message)); }
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <p className="text-neutral-500 text-sm mt-6">หลายโมเดลข้ามค่ายผลัดกันปรับปรุงงานเดียวกันทีละรอบ → <b className="text-neutral-300">vision critic (Opus)</b> ให้คะแนน → จนผ่าน ≥8/10</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="พิมพ์ไทยก็ได้ — เช่น ฟอร์มล็อกอินกระจกฝ้า มีอีเมล + รหัสผ่าน" />
        <button onClick={run} disabled={running || !brief.trim()}
          className="bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl px-6 py-3 font-bold whitespace-nowrap inline-flex items-center justify-center gap-2">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังออกแบบ…</> : <><Wand2 className="w-4 h-4" /> Design it</>}
        </button>
      </div>

      {rounds.some((r) => r.feedback?.includes("[stub]")) && <StubBanner />}
      {err && <div className="mt-4 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {rounds.map((r) => {
          const isBest = r.n === bestN;
          return (
          <div key={r.n} style={{ animationDelay: `${r.n * 80}ms` }}
            className={`animate-in-up bg-neutral-900 rounded-2xl overflow-hidden transition hover:-translate-y-0.5 ${isBest ? "ring-2 ring-amber-400 animate-glow" : "ring-1 ring-white/10 hover:ring-white/25"}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-bold text-sm inline-flex items-center gap-1.5">{isBest && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}Round {r.n} <span className="text-neutral-500 font-normal">· {pretty(r.by)}</span>{r.vendor && VENDOR[r.vendor] && <span className={`text-[10px] px-2 py-0.5 rounded-full ${VENDOR[r.vendor].cls}`}>{VENDOR[r.vendor].label}</span>}{r.role && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-300">{r.role}</span>}</span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 ${r.pass ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                {r.score}/10 {r.pass ? <><Check className="w-3.5 h-3.5" /> ผ่าน</> : <><RotateCw className="w-3.5 h-3.5" /> แก้</>}
              </span>
            </div>
            <iframe srcDoc={frame(r.html)} title={`round-${r.n}`} className="w-full h-72 bg-white border-0" sandbox="allow-scripts" />
            <div className="px-4 py-3 flex items-start justify-between gap-3">
              <p className="text-xs text-neutral-400 leading-relaxed">↳ {r.feedback}</p>
              <div className="shrink-0 flex items-center gap-2">
                <button onClick={() => onPreview({ html: r.html, title: `Round ${r.n} · ${pretty(r.by)}`, score: r.score })}
                  className="text-[11px] inline-flex items-center gap-1 text-neutral-400 hover:text-white transition" title="ดูเต็มจอ">
                  <Maximize2 className="w-3.5 h-3.5" /> ดูเต็ม
                </button>
                <ExportButtons html={r.html} filename={`round-${r.n}.html`} />
                <ShareButton html={r.html} title={`Round ${r.n} · ${pretty(r.by)}`} score={r.score} />
              </div>
            </div>
          </div>
          );
        })}
        {running && <SkeletonCard label="AI กำลังออกแบบ/แก้รอบถัดไป…" h="h-72" />}
      </div>
    </>
  );
}

function Battle({ onPreview }: { onPreview: OnPreview }) {
  const [brief, setBrief] = useState("");
  const [results, setResults] = useState<CResult[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (running) return;
    setResults([]); setWinner(null); setBoard([]); setErr(null);
    setRunning(true);
    try {
      await streamSSE("/api/battle", { brief, keys: loadKeys() }, (msg) => {
        const m = msg as { type: string } & Record<string, unknown>;
        if (m.type === "contestant") setResults((r) => [...r, m.result as CResult]);
        else if (m.type === "winner") { setWinner(m.name as string); setBoard(m.leaderboard as LeaderRow[]); }
        else if (m.type === "done") setRunning(false);
        else if (m.type === "error") { setRunning(false); setErr(String(m.message)); }
      });
    } finally {
      setRunning(false);
    }
  }

  const ranked = [...results].sort((a, b) => {
    if (a.unavailable && !b.unavailable) return 1;
    if (!a.unavailable && b.unavailable) return -1;
    return b.score - a.score;
  });
  const pending = running ? Math.max(0, EXPECTED_CONTESTANTS - results.length) : 0;

  return (
    <>
      <p className="text-neutral-500 text-sm mt-6">โมเดลข้ามค่ายแข่งกัน brief เดียว → <b className="text-neutral-300">vision critic</b> ให้คะแนนทุกตัว → ตัดสิน + leaderboard สะสม</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="พิมพ์ไทยก็ได้ — เช่น ฮีโร่เซกชันสำหรับสตาร์ทอัพ AI" />
        <button onClick={run} disabled={running || !brief.trim()}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl px-6 py-3 font-bold whitespace-nowrap inline-flex items-center justify-center gap-2">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังแข่ง…</> : <><Swords className="w-4 h-4" /> Start battle</>}
        </button>
      </div>

      {results.some((r) => r.feedback?.includes("[stub]")) && <StubBanner />}
      {err && <div className="mt-4 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {ranked.map((c, i) => {
          const v = VENDOR[c.vendor] ?? { label: c.vendor, cls: "bg-neutral-700 text-neutral-200" };
          const isUnavailable = !!c.unavailable;
          const isWin = !isUnavailable && winner === c.name;
          return (
            <div key={c.name} style={{ animationDelay: `${i * 80}ms` }}
              className={`animate-in-up rounded-2xl overflow-hidden ring-1 transition ${
                isUnavailable
                  ? "bg-neutral-900/60 ring-white/5 opacity-60"
                  : isWin
                    ? "bg-neutral-900 ring-2 ring-amber-400 animate-glow hover:-translate-y-0.5"
                    : "bg-neutral-900 ring-white/10 hover:ring-white/25 hover:-translate-y-0.5"
              }`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="font-bold text-sm truncate inline-flex items-center gap-1">
                  {isWin && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                  {pretty(c.name)}
                </span>
                {isUnavailable
                  ? <span className="text-base font-black text-neutral-600">—</span>
                  : <span className="text-base font-black text-emerald-300">{c.score}<span className="text-xs text-neutral-500 font-normal">/10</span></span>
                }
              </div>
              {isUnavailable
                ? (
                  <div className="w-full h-80 bg-neutral-800/40 grid place-items-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-600 px-6 text-center">
                      <TriangleAlert className="w-7 h-7" />
                      <span className="text-xs leading-relaxed">{c.reason ?? "Model unavailable"}</span>
                    </div>
                  </div>
                )
                : <iframe srcDoc={frame(c.html)} title={c.name} className="w-full h-80 bg-white border-0" sandbox="allow-scripts" />
              }
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.cls}`}>{v.label}</span>
                    {isUnavailable && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-400">unavailable</span>}
                  </div>
                  {!isUnavailable && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onPreview({ html: c.html, title: pretty(c.name), score: c.score })}
                        className="text-[11px] inline-flex items-center gap-1 text-neutral-400 hover:text-white transition" title="ดูเต็มจอ">
                        <Maximize2 className="w-3.5 h-3.5" /> ดูเต็ม
                      </button>
                      <ExportButtons html={c.html} filename={`${c.name}.html`} />
                      <ShareButton html={c.html} title={pretty(c.name)} score={c.score} />
                    </div>
                  )}
                </div>
                {!isUnavailable && <p className="text-xs text-neutral-400 leading-relaxed mt-2">↳ {c.feedback}</p>}
              </div>
            </div>
          );
        })}
        {Array.from({ length: pending }).map((_, i) => (
          <SkeletonCard key={`sk-${i}`} label="กำลังออกแบบแข่ง…" h="h-80" />
        ))}
      </div>

      {board.length > 0 && (
        <div className="mt-10 animate-in-up bg-neutral-900 rounded-2xl ring-1 ring-white/10 overflow-hidden">
          <p className="px-4 py-3 font-bold text-sm border-b border-white/10 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Leaderboard <span className="text-neutral-500 font-normal">· สะสมทุกการแข่ง (เก็บถาวร)</span>
          </p>
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-xs">
              <tr><th className="text-left px-4 py-2 font-medium">Model</th><th className="px-4 py-2 font-medium">Wins</th><th className="px-4 py-2 font-medium">Win-rate</th><th className="px-4 py-2 font-medium">Avg</th></tr>
            </thead>
            <tbody>
              {board.map((row, i) => (
                <tr key={row.name} className="border-t border-white/5">
                  <td className="px-4 py-2 font-medium">
                    {i === 0 && <Medal className="inline w-4 h-4 text-amber-400 mr-1 align-text-bottom" />}{pretty(row.name)} <span className="text-neutral-600 text-xs">· {VENDOR[row.vendor]?.label ?? row.vendor}</span>
                  </td>
                  <td className="px-4 py-2 text-center text-neutral-300">{row.wins}/{row.runs}</td>
                  <td className="px-4 py-2 text-center text-emerald-300 font-bold">{row.winRate}%</td>
                  <td className="px-4 py-2 text-center text-neutral-300">{row.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
