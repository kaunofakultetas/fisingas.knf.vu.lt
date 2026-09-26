// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the student test sidebar
//
//  src/components/Student/Sidebar/Sidebar.jsx — the panel
//  next to the open question:
//    - "Atsakyta: X / N" + the progress bar; a question counts
//      as answered once it has ANY verdict — "Tikras" is 0,
//      falsy but answered; only null is unanswered
//    - one numbered jump button per question: burgundy when
//      answered, white when not, a ring on the current one
//    - "Užbaigti testą" — IRREVERSIBLE, so hold-to-confirm
//      (1.5 s) — with the mouse, a finger or Space held on the
//      focused button (a keyboard-only student can finish); an
//      early release explains itself in a toast; a release
//      right at 1.5 s is a full hold
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";

import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { longPress } from "./support/interactions";
import * as fx from "./support/fixtures";

import StudentSidebar from "@/components/Student/Sidebar/Sidebar";


const ANSWERED = "bg-[rgb(123,0,63)]";
const CURRENT = "ring-2";

// Questions 11..(10+n); `verdicts` sets selectedanswer by index
const questions = (count, verdicts = {}) =>
  fx.dealtTest(count).map((question, index) => ({ ...question, selectedanswer: verdicts[index] ?? null }));

const renderSidebar = (props = {}) => {
  const handlers = { setCurrentQuestionIndex: vi.fn(), onFinish: vi.fn() };
  const result = renderPage(
    <StudentSidebar currentQuestionIndex={0} questionsData={questions(3)} {...handlers} {...props} />,
    { toaster: true }
  );
  return { ...result, ...handlers };
};

const jumpButton = (number) => screen.getByRole("button", { name: String(number) });

const finishButton = () => screen.getByRole("button", { name: "Užbaigti testą" });







// -----------------------------------------------------------
// Progress summary
// -----------------------------------------------------------

describe("StudentSidebar — progress summary", () => {

  it("counts nothing answered at the start", () => {
    const { container } = renderSidebar({ questionsData: questions(12) });

    expect(screen.getByText("Klausimai")).toBeInTheDocument();
    expect(screen.getByText("Atsakyta: 0 / 12")).toBeInTheDocument();
    expect(container.querySelector(".transition-\\[width\\]")).toHaveStyle({ width: "0%" });
  });


  it("counts 'Tikras' (0) as answered, not only 'Fišingas' (1)", () => {
    renderSidebar({ questionsData: questions(4, { 0: 0, 1: 1 }) });

    expect(screen.getByText("Atsakyta: 2 / 4")).toBeInTheDocument();
  });


  it("fills the progress bar with the answered share", () => {
    const { container } = renderSidebar({ questionsData: questions(4, { 0: 1, 2: 0, 3: 1 }) });

    expect(screen.getByText("Atsakyta: 3 / 4")).toBeInTheDocument();
    expect(container.querySelector(".transition-\\[width\\]")).toHaveStyle({ width: "75%" });
  });


  it("is full when everything is answered", () => {
    const { container } = renderSidebar({ questionsData: questions(2, { 0: 1, 1: 0 }) });

    expect(screen.getByText("Atsakyta: 2 / 2")).toBeInTheDocument();
    expect(container.querySelector(".transition-\\[width\\]")).toHaveStyle({ width: "100%" });
  });
});







// -----------------------------------------------------------
// Question jump buttons
// -----------------------------------------------------------

describe("StudentSidebar — question jump buttons", () => {

  it("shows one numbered button per question, in order", () => {
    renderSidebar({ questionsData: questions(5) });

    // The jump buttons, then the finish button under the grid
    const labels = screen.getAllByRole("button").map((element) => element.textContent);
    expect(labels).toEqual(["1", "2", "3", "4", "5", "Užbaigti testą"]);
  });


  it("marks answered questions burgundy and the rest white", () => {
    renderSidebar({ questionsData: questions(3, { 1: 0 }) });

    expect(jumpButton(1)).not.toHaveClass(ANSWERED);
    expect(jumpButton(1)).toHaveClass("bg-white");
    expect(jumpButton(2)).toHaveClass(ANSWERED);
    expect(jumpButton(3)).not.toHaveClass(ANSWERED);
  });


  it("rings the current question only", () => {
    renderSidebar({ questionsData: questions(3), currentQuestionIndex: 2 });

    expect(jumpButton(3)).toHaveClass(CURRENT);
    expect(jumpButton(1)).not.toHaveClass(CURRENT);
    expect(jumpButton(2)).not.toHaveClass(CURRENT);
  });


  it("jumps to the clicked question (zero-based index)", async () => {
    const { user, setCurrentQuestionIndex } = renderSidebar({ questionsData: questions(5) });

    await user.click(jumpButton(4));

    expect(setCurrentQuestionIndex).toHaveBeenCalledWith(3);
  });


  it("never finishes the test by jumping around", async () => {
    const { user, onFinish } = renderSidebar({ questionsData: questions(3) });

    await user.click(jumpButton(2));
    await user.click(jumpButton(3));

    expect(onFinish).not.toHaveBeenCalled();
  });
});







// -----------------------------------------------------------
// Finishing the test
// -----------------------------------------------------------

describe("StudentSidebar — finishing the test", () => {

  // A click is a hold of a few milliseconds — an early release
  it("a plain click does not finish the test but explains how to", async () => {
    const { user, onFinish } = renderSidebar();

    await user.click(finishButton());

    await findToast("Laikykite mygtuką ilgiau, kad užbaigtumėte testą");
    await settle();
    expect(onFinish).not.toHaveBeenCalled();
  });


  it("holding 'Užbaigti testą' for 1.5 s finishes the test", () => {
    const { onFinish } = renderSidebar();

    longPress(finishButton(), 1600);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });


  it("an early release explains how to finish instead", async () => {
    const { onFinish } = renderSidebar();

    longPress(finishButton(), 800);

    await findToast("Laikykite mygtuką ilgiau, kad užbaigtumėte testą");
    expect(onFinish).not.toHaveBeenCalled();
  });


  // Held exactly 1500 ms on a fake clock. Animation frames run
  // every 16 ms from the clock's start, so the last one ran at
  // 1488 ms (not complete yet) and the next is due at 1504 ms —
  // the release lands between them. setTimeout shares the
  // clock, so completing on a timer would not count
  it("a hold released right at the full 1.5 s — between two animation frames — finishes the test", () => {
    const { onFinish } = renderSidebar();
    const button = finishButton();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    longPress(button, 1500);

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(toastTexts()).toEqual([]);
  });


  // Tab to the button, hold Space — the keyboard-only way
  it("a keyboard-only student finishes the test by holding Space on the focused button", () => {
    const { onFinish } = renderSidebar();
    const button = finishButton();
    act(() => button.focus());
    expect(button).toHaveFocus();

    vi.useFakeTimers({ toFake: ["Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    fireEvent.keyDown(button, { key: " ", code: "Space" });
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    fireEvent.keyUp(button, { key: " ", code: "Space" });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });


  it("tells on hover that the button must be held", async () => {
    const { user } = renderSidebar();

    await user.hover(finishButton());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Laikykite mygtuką, kad užbaigtumėte testą");
  });
});
