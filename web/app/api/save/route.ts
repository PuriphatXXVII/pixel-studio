// TODO: production deploy needs a real KV/DB instead of file storage
export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { html, title, score } = (await req.json()) as { html: string; title: string; score?: number };
  const id = randomUUID();
  const dir = join(process.cwd(), "data", "shared");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ html, title, score }));
  return NextResponse.json({ id });
}
