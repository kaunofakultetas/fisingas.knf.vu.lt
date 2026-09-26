// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — LongPressButton (hold to confirm)
//
//  src/components/Other/LongPressButton — the app's only
//  confirmation for irreversible actions (finish the test,
//  delete a student / question / option / administrator):
//    - the action fires only after holding for `duration`
//      (default 3000 ms; the app passes 1500), exactly once —
//      also when the release comes after the duration but
//      before the next animation frame noticed it
//    - releasing or leaving early cancels (optional
//      "hold longer" error toast); a completed hold can show a
//      success toast
//    - while held, the label is hidden (kept in the layout)
//      and a progress ring shows the elapsed share
//    - mouse, touch and the keyboard (Space / Enter held on
//      the button — auto-repeat never restarts the press, their
//      scroll / click defaults are prevented) all work;
//      disabled ignores presses; right-click menus are
//      suppressed; unmounting mid-hold never fires the action
//      later; a caller's own handlers for those events run as
//      well and never switch the press off
//    - a press that is no hold stops without firing or hinting:
//      a finger moving over 10 px (a scroll starting on the
//      button), a touch the system cancels, a blur
//    - a touchend is default-prevented (the browser does not
//      replay the tap as mouse events — no second press, no
//      second hint); a touchstart never is (React listens to
//      it passively)
//    - LongPressDeleteButton — the red preset
//
//  The hold is measured with Date.now() in a
//  requestAnimationFrame loop — the tests fake exactly those
//  two and move the clock by hand.
//
//  NOTE while held the label is visibility: hidden, which also
//  takes it out of the button's accessible NAME — so the
//  button element is looked up once, before pressing.
// -----------------------------------------------------------

import "./support/setup";

import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";

import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { longPress } from "./support/interactions";

import { LongPressButton, LongPressDeleteButton } from "@/components/Other/LongPressButton";


// A manual clock for the in-between states (longPress() covers
// complete press–hold–release gestures). The fake frames land
// every 16 ms from the moment the clock is installed — the
// tests press right then — so a held button completes on the
// first frame at or after `duration` (1504 ms for 1.5 s, 3008
// ms for 3 s), a release at or after `duration` at once; only
// the tests about that edge hold right up to it
const startClock = () => vi.useFakeTimers({ toFake: ["Date", "requestAnimationFrame", "cancelAnimationFrame"] });
const advance = (ms) => act(() => {
  vi.advanceTimersByTime(ms);
});

const button = (name = "Veiksmas") => screen.getByRole("button", { name });

// A finger at a point on the screen — without coordinates MUI's
// touch ripple sizes itself NaN (a React style console.error,
// should the ripple get to render before the test ends)
const TOUCH = { touches: [{ clientX: 10, clientY: 10 }] };







// -----------------------------------------------------------
// Completing and cancelling a hold
// -----------------------------------------------------------

describe("LongPressButton — completing and cancelling a hold", () => {

  it("fires onComplete once after the default 3 s hold", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete}>Veiksmas</LongPressButton>);

    longPress(button(), 3100);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("does not fire before the full duration has passed", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(2900);
    expect(onComplete).not.toHaveBeenCalled();

    advance(200);
    expect(onComplete).toHaveBeenCalledTimes(1);
    fireEvent.mouseUp(target);
  });


  it("honours a custom duration (the app's 1.5 s)", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);

    longPress(button(), 1400);
    expect(onComplete).not.toHaveBeenCalled();

    longPress(button(), 1600);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("fires only once however long the button stays held", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);

    longPress(button(), 10000);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("can be completed again with a new hold", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);

    longPress(button(), 1600);
    longPress(button(), 1600);

    expect(onComplete).toHaveBeenCalledTimes(2);
  });


  // The last frame before a release at 1.5 s ran at 1488 ms, the
  // next is due at 1504 ms — the release itself has to complete
  it("completes on a release right at the full duration, between two animation frames", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(1500);
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.mouseUp(target);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // …and the frame that was due does not fire it again
    advance(100);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  // The frame that reaches the duration and a release can both
  // come in before React re-renders — here inside one act().
  // Whichever is first ends the press; the other finds it over
  it.each([
    ["frame first", (target) => {
      vi.advanceTimersByTime(1600);
      fireEvent.mouseUp(target);
    }],
    ["release first", (target) => {
      vi.advanceTimersByTime(1500);
      fireEvent.mouseUp(target);
      vi.advanceTimersByTime(100);
    }],
  ])("fires once when the last frame and the release both land before a re-render (%s)", (_, endHold) => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    act(() => endHold(target));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("cancels when the mouse leaves the button mid-hold", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(1000);
    fireEvent.mouseLeave(target);
    advance(2000);

    expect(onComplete).not.toHaveBeenCalled();
  });


  it("works with touch as well as with the mouse", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(1000);
    fireEvent.touchEnd(target);
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.touchStart(target, TOUCH);
    advance(1600);
    fireEvent.touchEnd(target);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  // The system took the touch over (a scroll, an incoming call):
  // the press stops — nothing fires later, no hint shows
  it("stops a touch press the system cancels — nothing fires, no hint", () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} duration={1500} uncompletedToastMessage="Laikykite ilgiau">
        Veiksmas
      </LongPressButton>,
      { toaster: true }
    );
    const target = button();

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(500);
    expect(screen.getAllByRole("progressbar")).not.toHaveLength(0);

    fireEvent.touchCancel(target);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);

    advance(2000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);
  });


  // A slow scroll that begins on the button: mobile browsers end
  // it with touchmove + touchend, not touchcancel
  it("stops a touch press whose finger moves away — a scroll never completes it, and no hint", () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} duration={1500} uncompletedToastMessage="Laikykite ilgiau">
        Veiksmas
      </LongPressButton>,
      { toaster: true }
    );
    const target = button();

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(300);
    fireEvent.touchMove(target, { touches: [{ clientX: 10, clientY: 40 }] });
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);

    advance(1700);
    fireEvent.touchEnd(target);

    expect(onComplete).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);
  });


  it("keeps a touch press through a finger's small jitter (under 10 px)", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(300);
    fireEvent.touchMove(target, { touches: [{ clientX: 16, clientY: 16 }] });
    advance(300);
    fireEvent.touchMove(target, { touches: [{ clientX: 4, clientY: 13 }] });
    advance(1000);
    fireEvent.touchEnd(target);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  // React listens to touchstart passively: preventDefault there
  // is ignored and only makes the browser log a warning
  it("prevents a mouse press's default, never a touchstart's", () => {
    const seen = [];
    const record = (event) => seen.push(event);
    renderPage(<LongPressButton onMouseDown={record} onTouchStart={record}>Veiksmas</LongPressButton>);
    const target = button();

    fireEvent.touchStart(target, TOUCH);
    fireEvent.touchEnd(target);
    fireEvent.mouseDown(target);
    fireEvent.mouseUp(target);

    expect(seen.map((event) => [event.type, event.isDefaultPrevented()])).toEqual([
      ["touchstart", false],
      ["mousedown", true],
    ]);
  });


  // React itself drops mouse events on a disabled <button>, but
  // not touch events — those only the component's own guard stops
  it("ignores mouse and touch presses while disabled", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500} disabled>Veiksmas</LongPressButton>);
    const target = button();

    expect(target).toBeDisabled();
    longPress(target, 5000);

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(5000);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    fireEvent.touchEnd(target);

    expect(onComplete).not.toHaveBeenCalled();
  });


  it("never fires after being unmounted mid-hold", () => {
    const onComplete = vi.fn();
    const { unmount } = renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(1000);
    unmount();
    advance(5000);

    expect(onComplete).not.toHaveBeenCalled();
  });


  it("does nothing on a release without a press", () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} uncompletedToastMessage="Laikykite ilgiau">Veiksmas</LongPressButton>,
      { toaster: true }
    );

    fireEvent.mouseUp(button());
    fireEvent.mouseLeave(button());

    expect(onComplete).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);
  });


  it("suppresses the right-click menu (a long touch opens it on phones)", () => {
    renderPage(<LongPressButton>Veiksmas</LongPressButton>);

    // dispatchEvent answers false when the default was prevented
    expect(fireEvent.contextMenu(button())).toBe(false);
  });


  it("runs a caller's own mouse and touch handlers as well — the press keeps working", () => {
    const onComplete = vi.fn();
    const own = {
      onMouseDown: vi.fn(),
      onMouseUp: vi.fn(),
      onMouseLeave: vi.fn(),
      onTouchStart: vi.fn(),
      onTouchMove: vi.fn(),
      onTouchEnd: vi.fn(),
    };
    renderPage(<LongPressButton onComplete={onComplete} duration={1500} {...own}>Veiksmas</LongPressButton>);
    const target = button();

    longPress(target, 1600);
    expect(onComplete).toHaveBeenCalledTimes(1);

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(800);
    fireEvent.touchMove(target, TOUCH);
    advance(800);
    fireEvent.touchEnd(target);
    expect(onComplete).toHaveBeenCalledTimes(2);

    // Leaving early still cancels
    fireEvent.mouseDown(target);
    advance(500);
    fireEvent.mouseLeave(target);
    advance(2000);
    expect(onComplete).toHaveBeenCalledTimes(2);

    expect(own.onMouseDown).toHaveBeenCalledTimes(2);
    expect(own.onMouseUp).toHaveBeenCalledTimes(1);
    expect(own.onMouseLeave).toHaveBeenCalledTimes(1);
    expect(own.onTouchStart).toHaveBeenCalledTimes(1);
    expect(own.onTouchMove).toHaveBeenCalledTimes(1);
    expect(own.onTouchEnd).toHaveBeenCalledTimes(1);
  });


  it("runs a caller's own onContextMenu as well — the menu stays suppressed", () => {
    const onContextMenu = vi.fn();
    renderPage(<LongPressButton onContextMenu={onContextMenu}>Veiksmas</LongPressButton>);

    expect(fireEvent.contextMenu(button())).toBe(false);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// Feedback toasts
// -----------------------------------------------------------

describe("LongPressButton — feedback toasts", () => {

  afterEach(async () => {
    await settle();
  });


  it("toasts the 'hold longer' message on an early release", async () => {
    renderPage(
      <LongPressButton duration={1500} uncompletedToastMessage="Laikykite mygtuką ilgiau">Veiksmas</LongPressButton>,
      { toaster: true }
    );

    longPress(button(), 500);

    await findToast("Laikykite mygtuką ilgiau");
  });


  // Sliding off the button ends the hold like a release; sliding
  // back on and letting go over it must not toast a second time
  it("toasts 'hold longer' once when the pointer leaves mid-hold", async () => {
    renderPage(
      <LongPressButton duration={1500} uncompletedToastMessage="Laikykite mygtuką ilgiau">Veiksmas</LongPressButton>,
      { toaster: true }
    );
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(500);
    fireEvent.mouseLeave(target);
    fireEvent.mouseEnter(target);
    fireEvent.mouseUp(target);
    vi.useRealTimers();

    await findToast("Laikykite mygtuką ilgiau");
    expect(toastTexts()).toEqual(["Laikykite mygtuką ilgiau"]);
  });


  it("stays silent on an early release without an uncompletedToastMessage", async () => {
    renderPage(<LongPressButton duration={1500}>Veiksmas</LongPressButton>, { toaster: true });

    longPress(button(), 500);
    await settle();

    expect(toastTexts()).toEqual([]);
  });


  it("toasts the completion message after a full hold", async () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} duration={1500} completedToastMessage="Atlikta">Veiksmas</LongPressButton>,
      { toaster: true }
    );

    longPress(button(), 1600);

    await findToast("Atlikta");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("a release right at the full duration toasts the completion message — not 'hold longer'", async () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} duration={1500} completedToastMessage="Atlikta" uncompletedToastMessage="Laikykite mygtuką ilgiau">
        Veiksmas
      </LongPressButton>,
      { toaster: true }
    );

    longPress(button(), 1500);

    await findToast("Atlikta");
    expect(toastTexts()).toEqual(["Atlikta"]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  // A browser replays a tap as mouse events (mousedown, mouseup,
  // click) unless its touchend was default-prevented — they would
  // start and cancel a second press: a second hint
  it("shows a short tap's 'hold longer' hint once — the tap is not replayed as mouse events", async () => {
    renderPage(
      <LongPressButton duration={1500} uncompletedToastMessage="Laikykite mygtuką ilgiau">Veiksmas</LongPressButton>,
      { toaster: true }
    );
    const target = button();

    startClock();
    fireEvent.touchStart(target, TOUCH);
    advance(100);
    const replayed = fireEvent.touchEnd(target);   // false: default-prevented
    if (replayed) {
      fireEvent.mouseDown(target);
      fireEvent.mouseUp(target);
    }
    vi.useRealTimers();

    expect(replayed).toBe(false);
    await findToast("Laikykite mygtuką ilgiau");
    expect(toastTexts()).toEqual(["Laikykite mygtuką ilgiau"]);
  });


  it("does not toast 'hold longer' after a completed hold is released", async () => {
    renderPage(
      <LongPressButton duration={1500} uncompletedToastMessage="Laikykite mygtuką ilgiau">Veiksmas</LongPressButton>,
      { toaster: true }
    );

    longPress(button(), 1600);
    await settle();

    expect(toastTexts()).toEqual([]);
  });
});







// -----------------------------------------------------------
// The keyboard
// -----------------------------------------------------------
//
// Space or Enter held on the focused button presses it like the
// mouse — a keyboard-only user has no other way to confirm.
// -----------------------------------------------------------

describe("LongPressButton — the keyboard", () => {

  const SPACE = { key: " ", code: "Space" };
  const ENTER = { key: "Enter", code: "Enter" };


  it.each([
    ["Space", SPACE],
    ["Enter", ENTER],
  ])("holding %s for the full duration completes the press once", (_, key) => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.keyDown(target, key);
    advance(1600);
    fireEvent.keyUp(target, key);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("a release at 1.4 s fires nothing and shows the 'hold longer' hint", async () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} duration={1500} uncompletedToastMessage="Laikykite mygtuką ilgiau">
        Veiksmas
      </LongPressButton>,
      { toaster: true }
    );
    const target = button();

    startClock();
    fireEvent.keyDown(target, SPACE);
    advance(1400);
    fireEvent.keyUp(target, SPACE);
    vi.useRealTimers();

    await findToast("Laikykite mygtuką ilgiau");
    expect(onComplete).not.toHaveBeenCalled();
    await settle();
  });


  // A held key repeats its keydown; restarting the press on each
  // repeat would push the completion out for as long as it is held
  it("auto-repeated keydowns do not restart the press", () => {
    const onComplete = vi.fn();
    renderPage(<LongPressButton onComplete={onComplete} duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.keyDown(target, SPACE);
    advance(500);
    fireEvent.keyDown(target, { ...SPACE, repeat: true });
    advance(500);
    fireEvent.keyDown(target, { ...SPACE, repeat: true });
    advance(600);

    expect(onComplete).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(target, SPACE);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });


  it("a blur mid-hold stops the press — nothing fires, and no hint", () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressButton onComplete={onComplete} duration={1500} uncompletedToastMessage="Laikykite ilgiau">
        Veiksmas
      </LongPressButton>,
      { toaster: true }
    );
    const target = button();

    startClock();
    fireEvent.keyDown(target, SPACE);
    advance(500);
    fireEvent.blur(target);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);

    advance(2000);
    fireEvent.keyUp(target, SPACE);

    expect(onComplete).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);
  });


  // Space scrolls the page on keydown and clicks the button on
  // keyup, Enter clicks it on keydown — a hold needs neither
  it("keeps Space and Enter from scrolling the page or clicking the button — other keys pass", () => {
    renderPage(<LongPressButton duration={1500}>Veiksmas</LongPressButton>);
    const target = button();

    // dispatchEvent answers false when the default was prevented
    expect(fireEvent.keyDown(target, SPACE)).toBe(false);
    expect(fireEvent.keyUp(target, SPACE)).toBe(false);
    expect(fireEvent.keyDown(target, ENTER)).toBe(false);
    expect(fireEvent.keyUp(target, ENTER)).toBe(false);

    expect(fireEvent.keyDown(target, { key: "Tab", code: "Tab" })).toBe(true);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });


  it("runs a caller's own keyboard and blur handlers as well — the press keeps working", () => {
    const onComplete = vi.fn();
    const own = { onKeyDown: vi.fn(), onKeyUp: vi.fn(), onBlur: vi.fn() };
    renderPage(<LongPressButton onComplete={onComplete} duration={1500} {...own}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.keyDown(target, SPACE);
    advance(1600);
    fireEvent.keyUp(target, SPACE);
    fireEvent.blur(target);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(own.onKeyDown).toHaveBeenCalledTimes(1);
    expect(own.onKeyUp).toHaveBeenCalledTimes(1);
    expect(own.onBlur).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// While held
// -----------------------------------------------------------

describe("LongPressButton — while held", () => {

  it("hides the label (keeping its space) and shows the progress ring", () => {
    renderPage(<LongPressButton duration={3000}>Veiksmas</LongPressButton>);
    const target = button();
    const label = screen.getByText("Veiksmas");

    expect(label).toHaveStyle({ visibility: "visible" });
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);

    startClock();
    fireEvent.mouseDown(target);
    advance(20);

    expect(label).toHaveStyle({ visibility: "hidden" });
    expect(within(target).getAllByRole("progressbar")).toHaveLength(2);

    fireEvent.mouseUp(target);
    expect(label).toHaveStyle({ visibility: "visible" });
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });


  it("fills the ring with the elapsed share of the duration", () => {
    renderPage(<LongPressButton duration={3000}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(1500);

    // Ring 0 is the faint full background circle, ring 1 the
    // progress: the last frame before 1.5 s ran at 1488 ms →
    // 49.6 %, which MUI rounds to aria-valuenow 50
    const [background, progress] = within(target).getAllByRole("progressbar");
    expect(background).toHaveAttribute("aria-valuenow", "100");
    const percent = Number(progress.getAttribute("aria-valuenow"));
    expect(percent).toBeGreaterThanOrEqual(45);
    expect(percent).toBeLessThanOrEqual(55);

    fireEvent.mouseUp(target);
  });


  it("shows custom pressedContent instead of the ring", () => {
    renderPage(<LongPressButton duration={3000} pressedContent={<span>Laikoma…</span>}>Veiksmas</LongPressButton>);
    const target = button();

    startClock();
    fireEvent.mouseDown(target);
    advance(20);

    expect(within(target).getByText("Laikoma…")).toBeInTheDocument();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);

    fireEvent.mouseUp(target);
    expect(screen.queryByText("Laikoma…")).toBeNull();
  });


  it("shows the label again after completing", () => {
    renderPage(<LongPressButton duration={1500}>Veiksmas</LongPressButton>);

    longPress(button(), 1600);

    expect(screen.getByText("Veiksmas")).toHaveStyle({ visibility: "visible" });
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });
});







// -----------------------------------------------------------
// Appearance and the delete preset
// -----------------------------------------------------------

describe("LongPressButton — appearance and LongPressDeleteButton", () => {

  it("is a red (error) contained button by default", () => {
    renderPage(<LongPressButton>Veiksmas</LongPressButton>);

    expect(button()).toHaveClass("MuiButton-contained");
    expect(button()).toHaveClass("MuiButton-colorError");
  });


  it("takes the MUI color / variant / fullWidth props", () => {
    renderPage(<LongPressButton color="primary" variant="outlined" fullWidth>Veiksmas</LongPressButton>);

    expect(button()).toHaveClass("MuiButton-outlined");
    expect(button()).toHaveClass("MuiButton-colorPrimary");
    expect(button()).toHaveClass("MuiButton-fullWidth");
  });


  it("shows its tooltip on hover", async () => {
    const { user } = renderPage(<LongPressButton tooltip="Laikykite mygtuką">Veiksmas</LongPressButton>);

    await user.hover(button());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Laikykite mygtuką");
  });


  it("LongPressDeleteButton is red and completes like the base button", async () => {
    const onComplete = vi.fn();
    renderPage(
      <LongPressDeleteButton onComplete={onComplete} duration={1500} completedToastMessage="Ištrinta">Trinti</LongPressDeleteButton>,
      { toaster: true }
    );

    expect(button("Trinti")).toHaveClass("MuiButton-colorError");

    longPress(button("Trinti"), 1600);

    expect(onComplete).toHaveBeenCalledTimes(1);
    await findToast("Ištrinta");
  });
});
