"use client";
import { useState } from "react";

type Round = { n: number; html: string; by: string; score: number; pass: boolean; feedback: string };

export default function Home() {
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
    <main className="min-h-screen bg-neutral-950 text-white font-sans">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">🎨 Pixel <span className="text-rose-500">Studio</span></h1>
        <p className="text-neutral-400 mt-2">พิมพ์ brief → ดู AI ออกแบบ component แล้ว <b className="text-white">วิจารณ์งานตัวเองจากภาพจริง</b> วนแก้จนผ่าน</p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
            placeholder="เช่น a glassy login form with email + password"
          />
          <button
            onClick={run}
            disabled={running}
            className="bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl px-6 py-3 font-bold whitespace-nowrap"
          >
            {running ? "กำลังออกแบบ…" : "▶ Design it"}
          </button>
        </div>

        {running && rounds.length === 0 && (
          <p className="text-neutral-500 text-sm mt-6 animate-pulse">🤖 AI กำลังร่างแบบแรก…</p>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {rounds.map((r) => (
            <div key={r.n} className="bg-neutral-900 rounded-2xl ring-1 ring-white/10 overflow-hidden">
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
        </div>

        <p className="text-neutral-600 text-xs mt-12">Pixel Studio · multi-model AI design studio · ไม่มี API key = โหมด stub</p>
      </div>
    </main>
  );
}
