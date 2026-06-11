// SSE endpoint: รัน critic loop แล้ว stream แต่ละรอบให้ client เห็นสด
import { runStudio } from "@/lib/studio";
import type { Keys } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeStream(brief: string, keys?: Keys): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const round of runStudio(brief, keys)) send({ type: "round", ...round });
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
}

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" };

export async function POST(req: Request) {
  const body = await req.json() as { brief?: string; keys?: Keys };
  const brief = body.brief?.trim() || "A pricing card for a SaaS product, dark theme, modern.";
  return new Response(makeStream(brief, body.keys), { headers: SSE_HEADERS });
}
