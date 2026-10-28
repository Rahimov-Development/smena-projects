"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Answer, ClarifySource, Summary } from "@/lib/brief";

type Phase =
  | { name: "brief" }
  | { name: "asking"; question: string; index: number }
  | { name: "summary"; summary: Summary };

const STORAGE_KEY = "smena-brief";
const STORE_EVENT = "smena-brief-change";

type Draft = {
  brief: string;
  answers: Answer[];
  phase: Phase;
  source: ClarifySource | null;
  draft: string;
};

const emptyDraft: Draft = {
  brief: "",
  answers: [],
  phase: { name: "brief" },
  source: null,
  draft: "",
};

let cachedRaw = "";
let cachedDraft: Draft = emptyDraft;

function parseDraft(raw: string): Draft {
  if (!raw) return emptyDraft;
  try {
    const parsed = JSON.parse(raw) as Draft;
    if (parsed && typeof parsed.brief === "string" && Array.isArray(parsed.answers)) {
      return parsed;
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  return emptyDraft;
}

function readDraft(): Draft {
  const raw = sessionStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === cachedRaw) return cachedDraft;
  cachedRaw = raw;
  cachedDraft = parseDraft(raw);
  return cachedDraft;
}

function writeDraft(next: Draft) {
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cachedDraft = next;
  sessionStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new Event(STORE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(STORE_EVENT, onStoreChange);
  return () => window.removeEventListener(STORE_EVENT, onStoreChange);
}

function checkoutCancelled() {
  return new URLSearchParams(window.location.search).get("checkout") === "cancel";
}

export function BriefFlow() {
  const cancelled = useSyncExternalStore(subscribe, checkoutCancelled, () => false);
  const state = useSyncExternalStore(subscribe, readDraft, () => emptyDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function continueBrief(event: FormEvent) {
    event.preventDefault();
    void advanceBrief();
  }

  async function advanceBrief() {
    setError(null);
    setPending(true);
    try {
      const current = readDraft();
      const result = await postClarify(current.brief, current.answers);
      writeDraft({
        ...current,
        source: result.source,
        draft: "",
        phase:
          result.kind === "question"
            ? { name: "asking", question: result.question, index: result.index }
            : { name: "summary", summary: result.summary },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  }

  function answerQuestion(event: FormEvent) {
    event.preventDefault();
    void submitAnswer();
  }

  async function submitAnswer() {
    const current = readDraft();
    if (current.phase.name !== "asking") return;
    const answer = current.draft.trim();
    if (!answer) {
      setError("Write a short answer before continuing.");
      return;
    }
    const answers = [
      ...current.answers,
      { question: current.phase.question, answer },
    ];
    setError(null);
    setPending(true);
    try {
      const result = await postClarify(current.brief, answers);
      writeDraft({
        ...current,
        answers,
        source: result.source,
        draft: "",
        phase:
          result.kind === "question"
            ? { name: "asking", question: result.question, index: result.index }
            : { name: "summary", summary: result.summary },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  }

  function goBack() {
    setError(null);
    const current = readDraft();
    if (current.phase.name === "asking" && current.answers.length === 0) {
      writeDraft({ ...current, phase: { name: "brief" }, draft: "" });
      return;
    }
    const previous = current.answers[current.answers.length - 1];
    if (!previous) {
      writeDraft({ ...current, phase: { name: "brief" }, draft: "" });
      return;
    }
    writeDraft({
      ...current,
      answers: current.answers.slice(0, -1),
      draft: previous.answer,
      phase: {
        name: "asking",
        question: previous.question,
        index: current.answers.length,
      },
    });
  }

  async function pay() {
    const current = readDraft();
    if (current.phase.name !== "summary") return;
    setError(null);
    setPending(true);
    try {
      const result = await postJson<{ url: string; livemode: boolean }>("/api/checkout", {
        brief: current.brief,
        answers: current.answers,
        summary: current.phase.summary,
      });
      if (result.livemode !== false) {
        throw new Error("Refusing a live-mode Checkout Session.");
      }
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout did not start.");
      setPending(false);
    }
  }

  const step =
    state.phase.name === "brief" ? 1 : state.phase.name === "asking" ? 2 : 3;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:py-14">
      <aside className="flex flex-col gap-8 lg:pt-6">
        <div>
          <p className="font-heading text-3xl tracking-tight text-foreground">Smena</p>
          <p className="mt-2 text-sm text-muted-foreground">Discovery call · €150</p>
        </div>
        <p className="max-w-sm text-sm leading-6 text-foreground/80">
          Forty-five minutes on the task you actually have. We read the brief
          before the call and leave with a first release and a list of what waits.
        </p>
        <ol className="grid gap-3 text-sm">
          {["Describe the task", "Answer two or three questions", "Hold the call"].map(
            (label, index) => (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs ${
                    step === index + 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={step === index + 1 ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
              </li>
            ),
          )}
        </ol>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          Stripe test mode
        </p>
      </aside>

      <section className="min-w-0">
        {cancelled && state.phase.name === "summary" ? (
          <p className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            Checkout was cancelled. The brief is still here.
          </p>
        ) : null}
        {error ? (
          <p
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {state.phase.name === "brief" ? (
          <form
            method="post"
            action="/api/clarify"
            onSubmit={continueBrief}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="task"
                className="font-heading text-4xl font-normal tracking-tight sm:text-5xl"
              >
                Describe the task
              </Label>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Write it the way you would tell a colleague. A messy paragraph
                is more useful than a template.
              </p>
            </div>
            <Textarea
              id="task"
              required
              minLength={12}
              value={state.brief}
              onChange={(event) =>
                writeDraft({ ...readDraft(), brief: event.target.value })
              }
              placeholder="We need a booking desk for a clinic: appointments, payments, and reminders. Right now it all lives in a spreadsheet and WhatsApp, and the front desk mixes up the slots."
              className="min-h-48 bg-card px-4 py-3 text-base md:text-base"
            />
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">{sourceLine(state.source)}</p>
              <Button type="submit" size="lg" className="h-11 px-5" disabled={pending}>
                {pending ? "Reading the brief\u2026" : "Continue"}
              </Button>
            </div>
          </form>
        ) : null}

        {state.phase.name === "asking" ? (
          <form
            method="post"
            action="/api/clarify"
            onSubmit={answerQuestion}
            className="flex flex-col gap-5"
          >
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Question {state.phase.index} of 2\u20133
              </p>
              <Label
                htmlFor="answer"
                className="mt-3 block font-heading text-3xl font-normal tracking-tight"
              >
                {state.phase.question}
              </Label>
            </div>
            {state.answers.length > 0 ? (
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {state.answers.map((item) => (
                  <li key={item.question}>
                    <span className="text-foreground">{item.question}</span>
                    <span className="mt-1 block">{item.answer}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Textarea
              id="answer"
              required
              placeholder="A sentence is enough."
              value={state.draft}
              onChange={(event) =>
                writeDraft({ ...readDraft(), draft: event.target.value })
              }
              className="min-h-32 bg-card px-4 py-3 text-base md:text-base"
              autoFocus
            />
            <div className="flex items-center justify-between gap-4">
              <Button type="button" variant="outline" onClick={goBack} disabled={pending}>
                Back
              </Button>
              <Button type="submit" size="lg" className="h-11 px-5" disabled={pending}>
                {pending ? "Next question\u2026" : "Answer"}
              </Button>
            </div>
          </form>
        ) : null}

        {state.phase.name === "summary" ? (
          <Card className="bg-card shadow-none">
            <CardHeader>
              <CardDescription>Discovery call \u00b7 \u20ac150</CardDescription>
              <CardTitle className="font-heading text-3xl font-normal tracking-tight">
                {state.phase.summary.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Field label="The task" value={state.brief} />
              <div className="grid gap-3">
                {state.answers.map((item, index) => (
                  <div key={`${item.question}-${index}`}>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      {item.question}
                    </p>
                    <p className="mt-1 text-sm leading-6">{item.answer}</p>
                  </div>
                ))}
              </div>
              <Field label="Goal" value={state.phase.summary.goal} />
              <Field label="Context" value={state.phase.summary.context} />
              <Field label="Call focus" value={state.phase.summary.focus} />
              <p className="text-xs text-muted-foreground">{sourceLine(state.source)}</p>
            </CardContent>
            <CardFooter className="justify-between gap-3 bg-transparent">
              <Button type="button" variant="outline" onClick={goBack} disabled={pending}>
                Back
              </Button>
              <Button type="button" size="lg" className="h-11 px-5" onClick={pay} disabled={pending}>
                {pending ? "Opening Checkout\u2026" : "Pay Discovery call \u00b7 \u20ac150"}
              </Button>
            </CardFooter>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function sourceLine(source: ClarifySource | null) {
  if (source === "openrouter") return "Questions from OpenRouter.";
  if (source === "local") {
    return "Questions drafted in the app until an OpenRouter key is connected.";
  }
  return "Two or three questions, then the summary.";
}

type ClarifyResponse =
  | { kind: "question"; question: string; index: number; source: ClarifySource }
  | { kind: "summary"; summary: Summary; source: ClarifySource };

function postClarify(brief: string, answers: Answer[]) {
  return postJson<ClarifyResponse>("/api/clarify", { brief, answers });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data as T;
}
