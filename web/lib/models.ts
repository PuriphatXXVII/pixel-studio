// Shared model utilities: vendor detection, build prompts, per-vendor API dispatch,
// and renderPng. Imported by both battle.ts and studio.ts so logic lives in one place.
import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";

// ── vendor key guards ──────────────────────────────────────────────────────────
export const hasAnthropic = () => !!process.env.ANTHROPIC_API_KEY;
export const hasGemini    = () => !!process.env.GEMINI_API_KEY;
export const hasOpenAI    = () => !!process.env.OPENAI_API_KEY;

// ── per-request BYOK key support ──────────────────────────────────────────────
export type Keys = { anthropic?: string; gemini?: string; openai?: string };

export const keyFor = (vendor: Builder["vendor"], keys?: Keys): string | undefined =>
  (vendor === "anthropic" ? keys?.anthropic : vendor === "google" ? keys?.gemini : keys?.openai) ||
  (vendor === "anthropic" ? process.env.ANTHROPIC_API_KEY : vendor === "google" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY);

export const hasKey = (vendor: Builder["vendor"], keys?: Keys) => !!keyFor(vendor, keys);

// ── model IDs ─────────────────────────────────────────────────────────────────
export const OPUS         = "claude-opus-4-8";
export const SONNET       = "claude-sonnet-4-6";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// ── system prompts ────────────────────────────────────────────────────────────
const LANG_NOTE =
  "Write any visible copy in the SAME LANGUAGE as the brief (Thai brief → Thai text in the component).";

export const SYSTEM =
  "You are a senior frontend designer. Output ONE self-contained HTML document for the requested UI component. " +
  'Load Tailwind via <script src="https://cdn.tailwindcss.com"></script>. Center it on a neutral page with padding. ' +
  `Polished and modern. ${LANG_NOTE} ` +
  "Raw HTML only, starting with <!doctype html>.";

const SYSTEM_REVISE =
  "You are a senior frontend designer improving an existing UI component from a critic's feedback. " +
  "Return the FULL improved self-contained HTML (Tailwind via CDN). Raw HTML only. " +
  LANG_NOTE +
  " IMPORTANT: keep ALL existing sections, cards, and features from the current HTML — improve their quality and polish, but NEVER remove, reduce, or simplify content.";

// ── text helpers ──────────────────────────────────────────────────────────────
export function clean(s: string): string {
  // Strip leading/trailing code fences that some models emit
  let t = s.trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
  // Extract the HTML document proper, discarding any reasoning text or markdown the model
  // leaked before/after the HTML (e.g. thinking models emitting prose before <!doctype html>)
  const full = t.match(/<!doctype html[\s\S]*<\/html>/i) ?? t.match(/<html[\s\S]*<\/html>/i);
  return full ? full[0] : t;
}

export function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

// ── Builder type & roster ────────────────────────────────────────────────────
export type Builder = {
  name: string;
  model: string;
  vendor: "anthropic" | "google" | "openai";
  accent: string;
};

export const BUILDERS: Builder[] = [
  { name: "claude-opus-4-8",  model: OPUS,         vendor: "anthropic", accent: "rose" },
  { name: "claude-sonnet-4-6", model: SONNET,      vendor: "anthropic", accent: "amber" },
  { name: "gpt-5.5",          model: OPENAI_MODEL, vendor: "openai",    accent: "teal" },
  { name: "gemini-3.1-pro",   model: GEMINI_MODEL, vendor: "google",    accent: "emerald" },
];

// ── renderPng ─────────────────────────────────────────────────────────────────
export async function renderPng(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    return await page.screenshot({ fullPage: true });
  } finally {
    await browser.close();
  }
}

// ── buildWith ─────────────────────────────────────────────────────────────────
export async function buildWith(
  b: Builder,
  brief: string,
  revise?: { html: string; feedback: string; fixes?: string[]; score?: number },
  instruction?: string,
  keys?: Keys,
): Promise<string> {
  const system = revise ? SYSTEM_REVISE : SYSTEM;
  let user = revise
    ? `Brief:\n${brief}\n\nCurrent HTML:\n${revise.html}\n\nCritic (${revise.score}/10):\n${revise.feedback}\nFixes:\n- ${(revise.fixes ?? []).join("\n- ")}\n\nReturn the improved full HTML.`
    : `Build this UI component:\n${brief}`;
  if (instruction) {
    user += `\n\nYou are one model in a relay of AI designers collaborating on a single component. Your specific job this round: ${instruction} Focus on your job while keeping all existing sections and content intact.`;
  }

  if (b.vendor === "anthropic") {
    const client = new Anthropic({ apiKey: keyFor("anthropic", keys) });
    const res = await client.messages.create({
      model: b.model,
      max_tokens: revise ? 16000 : 8000,
      system,
      messages: [{ role: "user", content: user }],
    });
    return clean(textOf(res));
  }

  if (b.vendor === "google") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${b.model}:generateContent?key=${keyFor("google", keys)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        // Gemini 3.1 Pro is a thinking model → generous token budget for reasoning + full HTML
        // Revise regenerates the full page AND spends budget on reasoning → needs extra headroom
        generationConfig: { maxOutputTokens: revise ? 16000 : 8000 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    return clean(text);
  }

  // openai — GPT-5 series: use max_completion_tokens (not max_tokens), no temperature
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyFor("openai", keys)}` },
    body: JSON.stringify({
      model: b.model,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user },
      ],
      max_completion_tokens: revise ? 16000 : 8000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content ?? "") as string;
  return clean(text);
}
