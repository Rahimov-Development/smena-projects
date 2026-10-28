import { type Answer, type ClarifyResult, type Summary } from "./brief";

const TIME =
  /срок|дедлайн|недел|месяц|завтра|сегодня|asap|deadline|week|month|friday|monday|tuesday|wednesday|thursday|saturday|sunday|quarter|q[1-4]\b|20\d{2}/i;

export function nextTurn(brief: string, answers: Answer[]): ClarifyResult {
  const questions = questionsFor(brief);
  if (answers.length >= 3 || (answers.length >= 2 && hasTimeSignal(brief, answers))) {
    return { kind: "summary", summary: buildSummary(brief, answers) };
  }
  const question = questions[answers.length] ?? questions[questions.length - 1];
  return { kind: "question", question, index: answers.length + 1 };
}

export function buildSummary(brief: string, answers: Answer[]): Summary {
  const title = firstClause(brief);
  const goal = answers[0]?.answer ?? "We'll pin the outcome on the call.";
  const context = answers[1]?.answer ?? "We'll name the user on the call.";
  const boundary = answers[2]?.answer;
  const focus = boundary
    ? `Out of scope: ${boundary}`
    : "On the call, lock the first release and what waits.";

  return { title, goal, context, focus };
}

function questionsFor(brief: string): [string, string, string] {
  const lower = brief.toLowerCase();
  const site = /сайт|лендинг|магазин|website|landing|storefront|shop/.test(lower);
  const product =
    /приложен|кабинет|сервис|платформ|бот|telegram|saas|app\b|dashboard/.test(
      lower,
    );
  const design = /дизайн|бренд|фирмен|логотип|ui\b|ux\b|brand/.test(lower);

  const second = site
    ? "Who lands on it, and what should they finish in one visit?"
    : product
      ? "Who is the main user, and what must they complete without you?"
      : design
        ? "Where will this design live, and what tone is off limits?"
        : "Who decides, and what have you already tried?";

  return [
    "What should be true when this is done, and by when?",
    second,
    "What is explicitly out of scope?",
  ];
}

function hasTimeSignal(brief: string, answers: Answer[]): boolean {
  const text = `${brief}\n${answers.map((item) => item.answer).join("\n")}`;
  return TIME.test(text);
}

function firstClause(brief: string): string {
  const clause = brief.split(/[.\n!?]/)[0]?.trim() || brief.trim();
  return clause.length > 90 ? `${clause.slice(0, 87).trimEnd()}…` : clause;
}
