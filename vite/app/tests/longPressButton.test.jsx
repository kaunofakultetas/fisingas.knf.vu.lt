// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — LongPressButton (hold to confirm)
//
//  src/components/Other/LongPressButton — the app's only
//  confirmation for irreversible actions (finish the test,
//  delete a student / question / option / administrator):
//    - the action fires only after holding for `duration`
//      (default 3000 ms; the app passes 1500), exactly once
//    - releasing or leaving early cancels (optional
//      "hold longer" error toast); a completed hold can show a
//      success toast
//    - while held, the label is hidden (kept in the layout)
//      and a progress ring shows the elapsed share
//    - mouse and touch both work; disabled ignores presses;
//      right-click menus are suppressed; unmounting mid-hold
//      never fires the action later
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
// tests press right then — so a hold completes on the first
// frame at or after `duration` (1504 ms for 1.5 s, 3008 ms for
// 3 s); the holds below stay clear of that edge
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
