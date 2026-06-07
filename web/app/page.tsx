"use client";
import { useState } from "react";

type Round = { n: number; html: string; by: string; score: number; pass: boolean; feedback: string };
type CResult = { name: string; vendor: string; accent: string; html: string; score: number; feedback: string };
type LeaderRow = { name: string; vendor: string; wins: number; runs: number; winRate: number; avg: number };

const VENDOR: Record<string, { label: string; cls: string }> = {
  anthropic: { label: "Anthropic", cls: "bg-orange-500/20 text-orange-300" },
  google: { label: "Google", cls: "bg-sky-500/20 text-sky-300" },
};
const EXPECTED_CONTESTANTS = 4; // ใช้โชว์ skeleton ระหว่างรอผล (ดู lib/battle.ts)

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

export default function Home() {
  const [tab, setTab] = useState<"studio" | "battle">("studio");
  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          🎨 Pixel <span className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">Studio</span>
        </h1>
        <p className="text-neutral-400 mt-2">โมเดล AI หลายตัวช่วยกันออกแบบ UI — แล้ว <b className="text-white">ตัดสินงานจากภาพที่ render จริง</b></p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {["🤖 multi-model", "👁️ vision critic", "🌏 พิมพ์ไทย/อังกฤษ"].map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-300">{t}</span>
          ))}
        </div>

        {/* tabs */}
        <div className="mt-7 inline-flex bg-neutral-900 ring-1 ring-white/10 rounded-xl p-1">
          {([["studio", "🎬 Critic loop"], ["battle", "⚔️ Model battle"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition ${tab === k ? "bg-rose-500 text-white" : "text-neutral-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "studio" ? <Studio /> : <Battle />}

        <p className="text-neutral-600 text-xs mt-12">Pixel Studio · multi-model AI design studio · ไม่มี API key = โหมด stub</p>
      </div>
    </main>
  );
}

function Studio() {
  const [brief, setBrief] = useState("A pricing card for a SaaS product — dark theme, modern, with a price, 4 feature bullets, and a CTA button.");
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
        <button onClick={run} disabled={running}
          className="bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl px-6 py-3 font-bold whitespace-nowrap">
          {running ? "กำลังออกแบบ…" : "▶ Design it"}
        </button>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {rounds.map((r) => (
          <div key={r.n} style={{ animationDelay: `${r.n * 80}ms` }}
            className="animate-in-up bg-neutral-900 rounded-2xl ring-1 ring-white/10 overflow-hidden transition hover:ring-white/25 hover:-translate-y-0.5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-bold text-sm">Round {r.n} <span className="text-neutral-500 font-normal">· {r.by}</span></span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${r.pass ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                {r.score}/10 {r.pass ? "✓ ผ่าน" : "↻ แก้"}
              </span>
            </div>
            <iframe srcDoc={r.html} title={`round-${r.n}`} className="w-full h-72 bg-white border-0" sandbox="allow-scripts" />
            <p className="px-4 py-3 text-xs text-neutral-400 leading-relaxed">↳ {r.feedback}</p>
          </div>
        ))}
        {running && <SkeletonCard label="🤖 AI กำลังออกแบบ/แก้รอบถัดไป…" h="h-72" />}
      </div>
    </>
  );
}

function Battle() {
  const [brief, setBrief] = useState("A pricing card for a SaaS product — modern, with a price, feature bullets, and a CTA button.");
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
      <p className="text-neutral-500 text-sm mt-6">โมเดลข้ามค่ายแข่งกัน brief เดียว → <b className="text-neutral-300">vision critic</b> ให้คะแนนทุกตัว → 👑 ตัดสิน + leaderboard สะสม</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="พิมพ์ไทยก็ได้ — เช่น เฮีโร่เซกชันสำหรับสตาร์ทอัพ AI" />
        <button onClick={run} disabled={running}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl px-6 py-3 font-bold whitespace-nowrap">
          {running ? "กำลังแข่ง…" : "⚔️ Start battle"}
        </button>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {ranked.map((c, i) => {
          const v = VENDOR[c.vendor] ?? { label: c.vendor, cls: "bg-neutral-700 text-neutral-200" };
          const isWin = winner === c.name;
          return (
            <div key={c.name} style={{ animationDelay: `${i * 80}ms` }}
              className={`animate-in-up bg-neutral-900 rounded-2xl overflow-hidden ring-1 transition hover:-translate-y-0.5 ${isWin ? "ring-2 ring-amber-400 animate-glow" : "ring-white/10 hover:ring-white/25"}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="font-bold text-sm truncate">{isWin && "👑 "}{c.name}</span>
                <span className="text-base font-black text-emerald-300">{c.score}<span className="text-xs text-neutral-500 font-normal">/10</span></span>
              </div>
              <iframe srcDoc={c.html} title={c.name} className="w-full h-64 bg-white border-0" sandbox="allow-scripts" />
              <div className="px-4 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.cls}`}>{v.label}</span>
                <p className="text-xs text-neutral-400 leading-relaxed mt-2">↳ {c.feedback}</p>
              </div>
            </div>
          );
        })}
        {Array.from({ length: pending }).map((_, i) => (
          <SkeletonCard key={`sk-${i}`} label="🥊 กำลังออกแบบแข่ง…" />
        ))}
      </div>

      {board.length > 0 && (
        <div className="mt-10 animate-in-up bg-neutral-900 rounded-2xl ring-1 ring-white/10 overflow-hidden">
          <p className="px-4 py-3 font-bold text-sm border-b border-white/10">📊 Leaderboard <span className="text-neutral-500 font-normal">· สะสมทุกการแข่ง (เก็บถาวร)</span></p>
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-xs">
              <tr><th className="text-left px-4 py-2 font-medium">Model</th><th className="px-4 py-2 font-medium">Wins</th><th className="px-4 py-2 font-medium">Win-rate</th><th className="px-4 py-2 font-medium">Avg</th></tr>
            </thead>
            <tbody>
              {board.map((row, i) => (
                <tr key={row.name} className="border-t border-white/5">
                  <td className="px-4 py-2 font-medium">{i === 0 ? "🥇 " : ""}{row.name} <span className="text-neutral-600 text-xs">· {VENDOR[row.vendor]?.label ?? row.vendor}</span></td>
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
