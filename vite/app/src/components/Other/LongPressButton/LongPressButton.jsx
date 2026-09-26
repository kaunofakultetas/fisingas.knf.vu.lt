// -----------------------------------------------------------
//  [*] Other — LongPressButton
//
//  Button that must be held down (default 3 s) before it
//  fires — used for destructive actions instead of a confirm
//  dialog. While holding, the label is replaced by a circular
//  progress ring; releasing early cancels and can show an
//  error toast, completing can show a success toast. A hold
//  counts once the full duration has passed — even when the
//  release comes before the next animation frame noticed.
//
//  Works with the mouse, touch and the keyboard (Space or
//  Enter held on the focused button). A finger that wanders
//  off (a scroll starting on the button), a touch the system
//  takes over and a button losing focus stop the press
//  without firing or hinting. A caller's own handlers for the
//  events the press uses run as well, never instead of ours.
//  Split into small pieces (main component near the end):
//
//    chain                  — caller's handler, then ours
//    useLongPress           — press state + rAF progress loop
//    PressProgress          — circular progress ring
//    ButtonTooltip          — tooltip that works when disabled
//    LongPressButton        — the button itself (default export)
//    LongPressDeleteButton  — red "delete" preset
//
//  Imported via the folder's index.js:
//    @/components/Other/LongPressButton
// -----------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, CircularProgress, Tooltip } from "@mui/material";
import toast from 'react-hot-toast';


const DEFAULT_DURATION = 3000; // 3 seconds

// How far (px) a finger may wander and still be holding —
// any further is a scroll or a drag that began on the button
const TOUCH_SLOP = 10;

// The keys that press a focused button
const PRESS_KEYS = [" ", "Enter"];

// The caller's own handler for an event the press listens to
// runs first, then ours — passing e.g. onMouseDown must never
// switch the long press off
const chain = (theirs, ours) => (event) => { theirs?.(event); ours(event); };







// -----------------------------------------------------------
// useLongPress
// -----------------------------------------------------------
//
// All the press logic. `pressedAt` is the timestamp when the
// hold started (null = not pressed). While it is set, an
// effect runs a requestAnimationFrame loop that updates the
// 0–100 progress until the duration is reached.
//
// A press starts with a mouse button, a finger, or Space /
// Enter on the focused button. It ends in endPress — from
// the frame that reaches the duration, or from the release
// (mouse up or the pointer leaving, touchend, keyup of the key
// that started it): held for the full duration it fires
// onComplete (+ optional success toast), otherwise it only
// cancels (+ optional error toast). The release decides too
// because it can land after the duration but before the next
// frame (a frame's time, longer on a busy device). Clearing
// `pressedAt` lets the effect cleanup stop the loop, which
// also covers unmount mid-press.
//
// A press that turns out to be no hold is aborted instead —
// nothing fires and no hint shows: a finger moving more than
// TOUCH_SLOP px (a scroll that began on the button — mobile
// browsers end a scroll with touchend, not touchcancel), a
// touch the system takes over (touchcancel — an incoming
// call, a system gesture) and the button losing focus.
//
// Returns { isPressed, progress } and one handler per event
// the press uses — LongPressButton wires them up.
//
// Used by:
//   - LongPressButton (below)
// -----------------------------------------------------------

function useLongPress({ onComplete, disabled, duration, completedToastMessage, uncompletedToastMessage }) {

  const [pressedAt, setPressedAt] = useState(null);
  const [progress, setProgress] = useState(0);

  // The running press's start, set and cleared at once — the
  // last frame and a release can both come in before React
  // re-renders, and only the first of them may end the press
  const runningPress = useRef(null);

  // What started the running press: where the finger went
  // down, which key is held (null for the other inputs)
  const touchOrigin = useRef(null);
  const heldKey = useRef(null);


  // Ends the press that started at `startedAt` — nothing when
  // it is over already, so onComplete fires once per press
  const endPress = useCallback((startedAt) => {
    if (runningPress.current !== startedAt) return;
    runningPress.current = null;

    setPressedAt(null);
    setProgress(0);

    if (Date.now() - startedAt >= duration) {
      if (completedToastMessage) {
        toast.success(<b>{completedToastMessage}</b>, { duration: 3000 });
      }
      onComplete?.();
    } else if (uncompletedToastMessage) {
      toast.error(<b>{uncompletedToastMessage}</b>, { duration: 3000 });
    }
  }, [duration, onComplete, completedToastMessage, uncompletedToastMessage]);


  // Animation loop — runs only while the button is held
  useEffect(() => {
    if (pressedAt === null) return;

    let frame;
    const tick = () => {
      const elapsed = Date.now() - pressedAt;
      if (elapsed >= duration) {
        endPress(pressedAt);
        return;
      }

      setProgress((elapsed / duration) * 100);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pressedAt, duration, endPress]);


  // A press begins — `touch` / `key` say what started it
  const begin = ({ touch = null, key = null } = {}) => {
    const now = Date.now();
    runningPress.current = now;
    touchOrigin.current = touch;
    heldKey.current = key;
    setProgress(0);
    setPressedAt(now);
  };


  // The release — after the full duration it completes the
  // press, earlier it cancels it
  const release = (e) => {
    if (runningPress.current === null) return;
    e.stopPropagation();

    endPress(runningPress.current);
  };


  // No hold after all — the press stops, nothing fires and no
  // hint shows
  const abort = () => {
    if (runningPress.current === null) return;
    runningPress.current = null;

    setPressedAt(null);
    setProgress(0);
  };


  // Mouse down — preventDefault keeps the focus and the text
  // selection where they are while the button is held
  const pressMouse = (e) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();

    begin();
  };


  // Touch start — never default-prevented: React listens to it
  // passively, so the browser would only log a warning
  const pressTouch = (e) => {
    if (disabled) return;
    e.stopPropagation();

    const touch = e.touches?.[0];
    begin({ touch: touch ? { x: touch.clientX, y: touch.clientY } : null });
  };


  // A finger that wanders off is scrolling or dragging, not
  // holding — a slow scroll must never complete the press
  const moveTouch = (e) => {
    const origin = touchOrigin.current;
    const touch = e.touches?.[0];
    if (runningPress.current === null || !origin || !touch) return;

    if (Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > TOUCH_SLOP) {
      abort();
    }
  };


  // Touch end — default-prevented, or the browser replays the
  // tap as mouse events (a second press, a second hint). After
  // a scroll it is not cancelable (and needs no preventing)
  const releaseTouch = (e) => {
    if (e.cancelable) e.preventDefault();

    release(e);
  };


  // Space / Enter on the focused button. Their defaults are
  // prevented — Space scrolls the page, both click the button;
  // an auto-repeated keydown never restarts the press
  const pressKey = (e) => {
    if (!PRESS_KEYS.includes(e.key)) return;
    e.preventDefault();
    if (disabled || e.repeat || runningPress.current !== null) return;
    e.stopPropagation();

    begin({ key: e.key });
  };


  // Only the key that started the press releases it (Space's
  // click comes on keyup, so that one is prevented too)
  const releaseKey = (e) => {
    if (!PRESS_KEYS.includes(e.key)) return;
    e.preventDefault();
    if (e.key !== heldKey.current) return;

    release(e);
  };


  return {
    isPressed: pressedAt !== null,
    progress,
    pressMouse,
    pressTouch,
    moveTouch,
    pressKey,
    release,
    releaseTouch,
    releaseKey,
    abort,
  };
}







// -----------------------------------------------------------
// PressProgress
// -----------------------------------------------------------
//
// The circular progress ring shown inside the button while
// it is held: a faint full circle in the background with the
// actual progress drawn on top. Transitions are disabled so
// the rAF-driven value animates smoothly.
//
// Used by:
//   - LongPressButton (below) — default pressed content
// -----------------------------------------------------------

function PressProgress({ progress, size, thickness, color, bgColor }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      {/* Background circle */}
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={thickness}
        sx={{ color: bgColor, position: 'absolute' }}
      />

      {/* Progress circle */}
      <CircularProgress
        variant="determinate"
        value={progress}
        size={size}
        thickness={thickness}
        sx={{
          color: color,
          position: 'absolute',
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
            transition: 'none',
          },
        }}
      />
    </div>
  );
}







// -----------------------------------------------------------
// ButtonTooltip
// -----------------------------------------------------------
//
// Black tooltip around the button. Renders the button as-is
// when no tooltip text is given; otherwise wraps it in a
// <span> so the tooltip also works on disabled buttons
// (disabled elements don't fire hover events themselves).
//
// Used by:
//   - LongPressButton (below)
// -----------------------------------------------------------

function ButtonTooltip({ tooltip, fullWidth, children }) {

  if (!tooltip) return children;

  return (
    <Tooltip
      title={<span style={{ fontSize: '0.9rem' }}>{tooltip}</span>}
      arrow
      disableInteractive
      slotProps={{
        tooltip: { sx: { backgroundColor: 'black', py: 0.5, px: 1 } },
        arrow: { sx: { color: 'black' } },
      }}
    >
      {/* Stretches only for fullWidth buttons — otherwise it
          must not grab flex space from its siblings */}
      <span style={{ display: 'inline-flex', flex: fullWidth ? 1 : 'none', width: fullWidth ? '100%' : 'auto' }}>
        {children}
      </span>
    </Tooltip>
  );
}







// -----------------------------------------------------------
// LongPressButton (default export)
// -----------------------------------------------------------
//
// The button itself — wires the useLongPress handlers to the
// mouse / touch / keyboard / focus events; a caller's own
// handlers for those events (and for the context menu) are
// chained in front of ours, so passing one never disables the
// press. While held, the label is hidden (but kept in the
// layout so the button size never changes) and the progress
// ring (or custom pressedContent) is overlaid centered on top.
//
// Used by:
//   - LongPressDeleteButton (below)
//   - StudentSidebar — the "Užbaigti testą" button
// -----------------------------------------------------------

export default function LongPressButton({
  // Core functionality
  onComplete,              // Called when long press completes
  disabled = false,
  duration = DEFAULT_DURATION,

  // Button content
  children,                // Button content when not pressed
  pressedContent,          // Custom content while pressing (optional)

  // Appearance
  color = "error",         // MUI color: "primary" | "secondary" | "error" | "warning" | "info" | "success"
  variant = "contained",   // MUI variant: "contained" | "outlined" | "text"
  fullWidth = false,
  size = "medium",         // MUI size: "small" | "medium" | "large"
  sx = {},

  // Feedback
  completedToastMessage,
  uncompletedToastMessage,

  // Tooltip (shown on hover, works even when disabled)
  tooltip = "",

  // Progress indicator customization
  progressSize = 24,
  progressThickness = 4,
  progressColor = "white",
  progressBgColor = "rgba(255,255,255,0.3)",

  // The caller's own handlers for the events the press uses —
  // chained with ours below, never replacing them
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  onContextMenu,

  // Other props passed to Button
  ...buttonProps
}) {

  const press = useLongPress({
    onComplete,
    disabled,
    duration,
    completedToastMessage,
    uncompletedToastMessage,
  });

  return (
    <ButtonTooltip tooltip={tooltip} fullWidth={fullWidth}>
      <Button
        variant={variant}
        color={color}
        fullWidth={fullWidth}
        size={size}
        disabled={disabled}
        onMouseDown={chain(onMouseDown, press.pressMouse)}
        onMouseUp={chain(onMouseUp, press.release)}
        onMouseLeave={chain(onMouseLeave, press.release)}
        onTouchStart={chain(onTouchStart, press.pressTouch)}
        onTouchMove={chain(onTouchMove, press.moveTouch)}
        onTouchEnd={chain(onTouchEnd, press.releaseTouch)}
        onTouchCancel={chain(onTouchCancel, press.abort)}
        onKeyDown={chain(onKeyDown, press.pressKey)}
        onKeyUp={chain(onKeyUp, press.releaseKey)}
        onBlur={chain(onBlur, press.abort)}
        onContextMenu={chain(onContextMenu, (e) => e.preventDefault())} // Prevent right-click menu on long press
        sx={{
          userSelect: 'none', // Prevent text selection while holding
          ...sx,
        }}
        {...buttonProps}
      >
        {/* The idle content always stays in the layout (only
            hidden while pressed) so the button keeps its exact
            size; the progress ring is overlaid centered on top */}
        <span style={{ display: 'inline-flex', alignItems: 'center', visibility: press.isPressed ? 'hidden' : 'visible' }}>
          {children}
        </span>

        {press.isPressed && (
          <span style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {pressedContent || (
              <PressProgress
                progress={press.progress}
                size={progressSize}
                thickness={progressThickness}
                color={progressColor}
                bgColor={progressBgColor}
              />
            )}
          </span>
        )}
      </Button>
    </ButtonTooltip>
  );
}







// -----------------------------------------------------------
// LongPressDeleteButton (exported)
// -----------------------------------------------------------
//
// Preset: red hold-to-delete button.
//
// Used by:
//   - AddEditAdministrator — "delete record" button in the
//     admin administrators dialog
//   - StudentInformation — the "Ištrinti Studentą" button
//   - QuestionCard — question/option delete buttons
// -----------------------------------------------------------

export function LongPressDeleteButton({
  children,
  completedToastMessage,
  uncompletedToastMessage,
  ...props
}) {
  return (
    <LongPressButton
      color="error"
      completedToastMessage={completedToastMessage}
      uncompletedToastMessage={uncompletedToastMessage}
      {...props}
    >
      {children}
    </LongPressButton>
  );
}
