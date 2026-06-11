// SSE endpoint: รัน model battle แล้ว stream ผู้เข้าแข่งทีละตัว + ผู้ชนะ/leaderboard
import { runBattle } from "@/lib/battle";
import type { Keys } from "@/lib/models";
import { clientIp, ipAllowed, demoQuotaAllowed, usedOwnerKeys } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeStream(brief: string, keys?: Keys): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const ev of runBattle(brief, keys)) send(ev);
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
}

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" };
const ERR = (body: object) => new Response(JSON.stringify(body), { status: 429, headers: { "content-type": "application/json" } });

export async function POST(req: Request) {
  const body = await req.json() as { brief?: string; keys?: Keys };

  const ip = clientIp(req);
  if (!ipAllowed(ip)) return ERR({ error: "rate_limited", message: "เร็วไป — รอสักครู่แล้วลองใหม่" });
  if (usedOwnerKeys(body.keys) && !demoQuotaAllowed()) return ERR({ error: "demo_quota", message: "โควต้าเดโมวันนี้เต็มแล้ว — ใส่ API key ของคุณเองในปุ่ม 🔑 เพื่อใช้งานต่อ" });

  const brief = body.brief?.trim() || "A pricing card for a SaaS product, modern, with a price, feature bullets, and a CTA button.";
  return new Response(makeStream(brief, body.keys), { headers: SSE_HEADERS });
}
