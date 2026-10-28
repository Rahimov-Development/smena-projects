export const DISCOVERY_NAME = "Discovery call";
export const DISCOVERY_CURRENCY = "eur";
export const DISCOVERY_AMOUNT = 15_000;
export const INTEGRATION_IDENTIFIER = "discovery_call_hvqwnrpl";

export type Answer = {
  question: string;
  answer: string;
};

export type Summary = {
  title: string;
  goal: string;
  context: string;
  focus: string;
};

export type ClarifyResult =
  | { kind: "question"; question: string; index: number }
  | { kind: "summary"; summary: Summary };

export type ClarifySource = "openrouter" | "local";

const MAX_BRIEF = 4_000;
const MAX_ANSWER = 2_000;

export function prefersRussian(text: string): boolean {
  const cyrillic = text.match(/[А-Яа-яЁё]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return cyrillic > 0 && cyrillic >= latin;
}

export function cleanBrief(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Describe the task before continuing.");
  }
  const brief = value.trim().replace(/\s+\n/g, "\n");
  if (brief.length < 12) {
    throw new Error("Describe the task in a sentence or two.");
  }
  if (brief.length > MAX_BRIEF) {
    throw new Error("Keep the task under 4,000 characters.");
  }
  return brief;
}

export function cleanAnswers(value: unknown): Answer[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error("Answers must be a list.");
  }
  if (value.length > 3) {
    throw new Error("Three clarifying questions is the maximum.");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Answer ${index + 1} is incomplete.`);
    }
    const question =
      "question" in item && typeof item.question === "string"
        ? item.question.trim()
        : "";
    const answer =
      "answer" in item && typeof item.answer === "string"
        ? item.answer.trim()
        : "";
    if (!question || question.length > 500) {
      throw new Error(`Question ${index + 1} is missing.`);
    }
    if (!answer || answer.length > MAX_ANSWER) {
      throw new Error(`Answer ${index + 1} needs a short reply.`);
    }
    return { question, answer };
  });
}

export function cleanSummary(value: unknown): Summary {
  if (!value || typeof value !== "object") {
    throw new Error("The summary is missing.");
  }
  const read = (key: keyof Summary, label: string) => {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error(`${label} is missing from the summary.`);
    }
    return raw.trim().slice(0, 500);
  };
  return {
    title: read("title", "Title"),
    goal: read("goal", "Goal"),
    context: read("context", "Context"),
    focus: read("focus", "Focus"),
  };
}
