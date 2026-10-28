import assert from "node:assert/strict";
import test from "node:test";
import { nextTurn } from "./interviewer";

const clinic =
  "Нужен кабинет для клиники: запись, оплаты и напоминания. Сейчас всё в таблице.";

test("asks a Russian question for a Russian brief", () => {
  const turn = nextTurn(clinic, []);
  assert.equal(turn.kind, "question");
  if (turn.kind !== "question") return;
  assert.match(turn.question, /сроку/);
  assert.equal(turn.index, 1);
});

test("asks in English when the brief is English", () => {
  const turn = nextTurn(
    "We need a booking desk for a three-room clinic.",
    [],
  );
  assert.equal(turn.kind, "question");
  if (turn.kind !== "question") return;
  assert.match(turn.question, /by when/);
});

test("asks a third question when no deadline has appeared", () => {
  const turn = nextTurn(clinic, [
    {
      question: "Что должно быть готово в конце и к какому сроку?",
      answer: "Администратор больше не ведёт запись вручную.",
    },
    {
      question: "Кто основной пользователь?",
      answer: "Администратор на ресепшене и пациент по ссылке.",
    },
  ]);
  assert.equal(turn.kind, "question");
  if (turn.kind !== "question") return;
  assert.equal(turn.index, 3);
});

test("stops at two answers when a deadline is already known", () => {
  const turn = nextTurn("Clinic portal due next month", [
    {
      question: "What should be true when this is done, and by when?",
      answer: "Patients book themselves. Deadline is the end of the month.",
    },
    {
      question: "Who is the main user?",
      answer: "Front desk and the patient.",
    },
  ]);
  assert.equal(turn.kind, "summary");
  if (turn.kind !== "summary") return;
  assert.match(turn.summary.title, /Clinic portal/);
  assert.match(turn.summary.goal, /Patients book/);
});

test("always summarizes after three answers", () => {
  const turn = nextTurn(clinic, [
    { question: "Q1", answer: "Запись без таблицы." },
    { question: "Q2", answer: "Администратор и пациент." },
    { question: "Q3", answer: "Не делаем мобильное приложение." },
  ]);
  assert.equal(turn.kind, "summary");
  if (turn.kind !== "summary") return;
  assert.match(turn.summary.focus, /мобильное приложение/);
});
