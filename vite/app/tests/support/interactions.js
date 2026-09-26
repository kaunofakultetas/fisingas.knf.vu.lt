// -----------------------------------------------------------
//  [*] Test support — interaction helpers
//
//  Gestures and DOM lookups several test files share:
//
//    longPress(button, 1600)   — hold a LongPressButton
//    linkAreas(root)           — the link-area overlays an
//                                InteractiveImage drew
//
//  Split into:
//
//    longPress — press, hold N ms on a fake clock, release
//    linkAreas — InteractiveImage overlay lookup
// -----------------------------------------------------------

import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";







// -----------------------------------------------------------
// longPress
// -----------------------------------------------------------
//
// LongPressButton measures the hold with Date.now() inside a
// requestAnimationFrame loop. Only those two are faked for
// the hold — setTimeout stays real, so React Testing Library
// keeps working — and the clock jumps `holdMs` at once (the
// rAF loop runs frame by frame through it). Released after
// the hold: a hold shorter than the button's duration is an
// early release, a longer one completes the press.
//
// A test that already runs on fake timers keeps them: the
// hold just advances them (they must include Date and
// requestAnimationFrame, e.g. toFake: ["setTimeout",
// "clearTimeout", "Date", "requestAnimationFrame",
// "cancelAnimationFrame"]) and nothing is reinstalled.
//
// Used by:
//   - every hold-to-confirm test (finish test, delete student
//     / question / option / administrator)
// -----------------------------------------------------------

export function longPress(element, holdMs) {
  const ownClock = !vi.isFakeTimers();
  if (ownClock) {
    vi.useFakeTimers({ toFake: ["Date", "requestAnimationFrame", "cancelAnimationFrame"] });
  }

  try {
    fireEvent.mouseDown(element);
    act(() => {
      vi.advanceTimersByTime(holdMs);
    });
    fireEvent.mouseUp(element);
  } finally {
    if (ownClock) {
      vi.useRealTimers();
    }
  }
}







// -----------------------------------------------------------
// linkAreas
// -----------------------------------------------------------
//
// InteractiveImage draws each link area as an absolutely
// positioned div with cursor: pointer (inline styles, no
// role or text). Hover one with fireEvent.mouseEnter to get
// its URL tooltip.
//
// Used by:
//   - the InteractiveImage, TestHome, StudentAnswers and
//     QuestionCard tests
// -----------------------------------------------------------

export const linkAreas = (root) =>
  [...root.querySelectorAll("div")].filter(
    (element) => element.style.position === "absolute" && element.style.cursor === "pointer"
  );
