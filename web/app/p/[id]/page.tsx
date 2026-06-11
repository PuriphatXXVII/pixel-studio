import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frame } from "@/lib/frame";

type SharedData = { html: string; title: string; score?: number };

export default async function SharedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: SharedData | null = null;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "shared", `${id}.json`), "utf8");
    data = JSON.parse(raw) as SharedData;
  } catch {
    // file not found or invalid JSON
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-black">Not found</p>
          <p className="text-neutral-500 mt-2 text-sm">ไม่พบ component นี้ หรือลิงก์หมดอายุแล้ว</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-neutral-950 text-white font-sans">
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-neutral-950">
        <span className="font-bold text-sm truncate">{data.title}</span>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {data.score != null && (
            <span className="text-emerald-300 font-black text-sm">{data.score}/10</span>
          )}
          <span className="text-xs text-neutral-500">made with Pixel Studio</span>
        </div>
      </header>
      <iframe
        srcDoc={frame(data.html)}
        title={data.title}
        className="flex-1 bg-white border-0 w-full"
        sandbox="allow-scripts"
      />
    </main>
  );
}
