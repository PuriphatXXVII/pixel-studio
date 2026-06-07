// SSE endpoint: รัน model battle แล้ว stream ผู้เข้าแข่งทีละตัว + ผู้ชนะ/leaderboard
import { runBattle } from "@/lib/battle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const brief = new URL(req.url).searchParams.get("brief")?.trim() || "A pricing card for a SaaS product, modern, with a price, feature bullets, and a CTA button.";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const ev of runBattle(brief)) send(ev);
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
