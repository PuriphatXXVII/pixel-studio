"use client";
import { useState, useEffect } from "react";
import { RefreshCcw, Swords, Bot, Eye, Languages, Wand2, Loader2, Crown, Trophy, Medal, TriangleAlert, Check, RotateCw, Maximize2, X } from "lucide-react";

type Round = { n: number; html: string; by: string; score: number; pass: boolean; feedback: string };
type CResult = { name: string; vendor: string; accent: string; html: string; score: number; feedback: string };
type LeaderRow = { name: string; vendor: string; wins: number; runs: number; winRate: number; avg: number };

const VENDOR: Record<string, { label: string; cls: string }> = {
  anthropic: { label: "Anthropic", cls: "bg-orange-500/20 text-orange-300" },
  google: { label: "Google", cls: "bg-sky-500/20 text-sky-300" },
};
const EXPECTED_CONTESTANTS = 4; // ใช้โชว์ skeleton ระหว่างรอผล (ดู lib/battle.ts)

// โชว์ชื่อรุ่นให้สวย: "claude-opus-4-8" → "claude-opus-4.8" (model id จริงยังเป็น -8 ตอนเรียก API)
const pretty = (id: string) => id.replace(/-(\d+)-(\d+)$/, "-$1.$2");

type PreviewItem = { html: string; title: string; score?: number };
type OnPreview = (p: PreviewItem) => void;

// ฉีด guard เข้า srcDoc: กันลิงก์/ฟอร์มในงาน AI พา iframe เด้งไปหน้าแอป (relative URL resolve กับ localhost:3000)
function frame(html: string): string {
  const guard =
    '<base target="_blank">' +
    // ซ่อน scrollbar ให้ thumbnail/preview สะอาดเท่ากันทุกการ์ด (ยัง scroll ด้วยล้อเมาส์ได้)
    "<style>::-webkit-scrollbar{width:0;height:0;display:none}html{scrollbar-width:none;-ms-overflow-style:none}</style>" +
    "<script>" +
    "document.addEventListener('click',function(e){var t=e.target;var a=t&&t.closest?t.closest('a'):null;if(a)e.preventDefault();},true);" +
    "document.addEventListener('submit',function(e){e.preventDefault();},true);" +
    "</script>";
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + guard) : guard + html;
}

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
            <Maximize2 className="w-4 h-4 text-rose-400" /> {preview.title}
            {preview.score != null && <span className="text-emerald-300 font-black">· {preview.score}/10</span>}
          </span>
          <button onClick={onClose} aria-label="ปิด" className="text-neutral-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <iframe srcDoc={frame(preview.html)} title={preview.title} className="w-full h-[78vh] bg-white border-0" sandbox="allow-scripts" />
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"studio" | "battle">("studio");
  const [preview, setPreview] = useState<PreviewItem | null>(null);
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

        {/* tabs */}
        <div className="mt-7 inline-flex bg-neutral-900 ring-1 ring-white/10 rounded-xl p-1">
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

        {tab === "studio" ? <Studio onPreview={setPreview} /> : <Battle onPreview={setPreview} />}

        <p className="text-neutral-600 text-xs mt-12">Pixel Studio · multi-model AI design studio</p>
      </div>
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
    </main>
  );
}

function Studio({ onPreview }: { onPreview: OnPreview }) {
  const [brief, setBrief] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [running, setRunning] = useState(false);

  function run() {
    if (running) return;
    setRounds([]);
    setRunning(true);
    const es = new EventSource(`/api/design?brief=${encodeURIComponent(brief)}`);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "round") setRounds((r) => [...r, msg as Round]);
      else if (msg.type === "done") { es.close(); setRunning(false); }
      else if (msg.type === "error") { es.close(); setRunning(false); console.error(msg.message); }
    };
    es.onerror = () => { es.close(); setRunning(false); };
  }

  return (
    <>
      <p className="text-neutral-500 text-sm mt-6">Builder ออกแบบ → render → <b className="text-neutral-300">vision critic</b> ให้คะแนน → แก้จนผ่าน (≥8/10)</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="พิมพ์ไทยก็ได้ — เช่น ฟอร์มล็อกอินกระจกฝ้า มีอีเมล + รหัสผ่าน" />
        <button onClick={run} disabled={running || !brief.trim()}
          className="bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl px-6 py-3 font-bold whitespace-nowrap inline-flex items-center justify-center gap-2">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังออกแบบ…</> : <><Wand2 className="w-4 h-4" /> Design it</>}
        </button>
      </div>

      {rounds.some((r) => r.by === "stub") && <StubBanner />}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {rounds.map((r) => (
          <div key={r.n} style={{ animationDelay: `${r.n * 80}ms` }}
            className="animate-in-up bg-neutral-900 rounded-2xl ring-1 ring-white/10 overflow-hidden transition hover:ring-white/25 hover:-translate-y-0.5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-bold text-sm">Round {r.n} <span className="text-neutral-500 font-normal">· {pretty(r.by)}</span></span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 ${r.pass ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                {r.score}/10 {r.pass ? <><Check className="w-3.5 h-3.5" /> ผ่าน</> : <><RotateCw className="w-3.5 h-3.5" /> แก้</>}
              </span>
            </div>
            <iframe srcDoc={frame(r.html)} title={`round-${r.n}`} className="w-full h-72 bg-white border-0" sandbox="allow-scripts" />
            <div className="px-4 py-3 flex items-start justify-between gap-3">
              <p className="text-xs text-neutral-400 leading-relaxed">↳ {r.feedback}</p>
              <button onClick={() => onPreview({ html: r.html, title: `Round ${r.n} · ${pretty(r.by)}`, score: r.score })}
                className="shrink-0 text-[11px] inline-flex items-center gap-1 text-neutral-400 hover:text-white transition" title="ดูเต็มจอ">
                <Maximize2 className="w-3.5 h-3.5" /> ดูเต็ม
              </button>
            </div>
          </div>
        ))}
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

  function run() {
    if (running) return;
    setResults([]); setWinner(null); setBoard([]);
    setRunning(true);
    const es = new EventSource(`/api/battle?brief=${encodeURIComponent(brief)}`);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "contestant") setResults((r) => [...r, msg.result as CResult]);
      else if (msg.type === "winner") { setWinner(msg.name); setBoard(msg.leaderboard as LeaderRow[]); }
      else if (msg.type === "done") { es.close(); setRunning(false); }
      else if (msg.type === "error") { es.close(); setRunning(false); console.error(msg.message); }
    };
    es.onerror = () => { es.close(); setRunning(false); };
  }

  const ranked = [...results].sort((a, b) => b.score - a.score);
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

      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {ranked.map((c, i) => {
          const v = VENDOR[c.vendor] ?? { label: c.vendor, cls: "bg-neutral-700 text-neutral-200" };
          const isWin = winner === c.name;
          return (
            <div key={c.name} style={{ animationDelay: `${i * 80}ms` }}
              className={`animate-in-up bg-neutral-900 rounded-2xl overflow-hidden ring-1 transition hover:-translate-y-0.5 ${isWin ? "ring-2 ring-amber-400 animate-glow" : "ring-white/10 hover:ring-white/25"}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="font-bold text-sm truncate inline-flex items-center gap-1">{isWin && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}{pretty(c.name)}</span>
                <span className="text-base font-black text-emerald-300">{c.score}<span className="text-xs text-neutral-500 font-normal">/10</span></span>
              </div>
              <iframe srcDoc={frame(c.html)} title={c.name} className="w-full h-80 bg-white border-0" sandbox="allow-scripts" />
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.cls}`}>{v.label}</span>
                  <button onClick={() => onPreview({ html: c.html, title: pretty(c.name), score: c.score })}
                    className="text-[11px] inline-flex items-center gap-1 text-neutral-400 hover:text-white transition" title="ดูเต็มจอ">
                    <Maximize2 className="w-3.5 h-3.5" /> ดูเต็ม
                  </button>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mt-2">↳ {c.feedback}</p>
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
