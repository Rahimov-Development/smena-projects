import {
  type Answer,
  type ClarifyResult,
  type Summary,
} from "./brief";
import { buildSummary } from "./interviewer";

const SYSTEM = `You interview a client before a paid discovery call for a product studio.
Ask 2 or 3 clarifying questions, one at a time, in the same language as the task.
Questions must be specific to this task. Do not ask for payment details, passwords, or personal data.
After 2 answers, ask a third only if a critical constraint (deadline, audience, or scope boundary) is still missing.
After enough answers, return a summary. Never ask a fourth question.
If the user has already given 3 answers, you must return a summary.
Respond with JSON only, no markdown:
{"kind":"question","question":"..."}
or
{"kind":"summary","title":"...","goal":"...","context":"...","focus":"..."}
title is a short name of the task (max 90 characters).
goal is what done looks like.
context is who it is for and what is already true.
focus is what the discovery call should decide.`;

export async function clarifyWithOpenRouter(
  brief: string,
  answers: Answer[],
): Promise<ClarifyResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3847",
      "X-Title": "Smena discovery brief",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            brief,
            answers,
            instruction:
              answers.length >= 3
                ? "Return a summary. Do not ask another question."
                : "Return the next question, or a summary if you already have enough.",
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 280);
    throw new Error(`OpenRouter returned ${response.status}. ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty reply.");
  }
  return parseModelReply(content, brief, answers);
}

function parseModelReply(
  content: string,
  brief: string,
  answers: Answer[],
): ClarifyResult {
  const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
  if (answers.length >= 3 || parsed.kind === "summary") {
    if (answers.length < 2 && parsed.kind === "summary") {
      throw new Error("The model summarized before two answers.");
    }
    return { kind: "summary", summary: summaryFromModel(parsed, brief, answers) };
  }
  if (parsed.kind === "question" && typeof parsed.question === "string") {
    const question = parsed.question.trim();
    if (!question) throw new Error("The model asked an empty question.");
    return { kind: "question", question, index: answers.length + 1 };
  }
  throw new Error("The model returned an unexpected reply.");
}

function summaryFromModel(
  parsed: Record<string, unknown>,
  brief: string,
  answers: Answer[],
): Summary {
  const fallback = buildSummary(brief, answers);
  const text = (key: keyof Summary, fallbackValue: string) => {
    const value = parsed[key];
    if (typeof value !== "string" || !value.trim()) return fallbackValue;
    return value.trim().slice(0, 500);
  };
  return {
    title: text("title", fallback.title),
    goal: text("goal", fallback.goal),
    context: text("context", fallback.context),
    focus: text("focus", fallback.focus),
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}
