// -----------------------------------------------------------
//  [*] Test support — per-file setup
//
//  Imported FIRST by every test file (right under the
//  `// @vitest-environment jsdom` docblock):
//
//    import "./support/setup";
//
//  Once per file:
//    - jest-dom matchers (toBeInTheDocument, toHaveClass ...)
//    - IS_REACT_ACT_ENVIRONMENT (React Testing Library only
//      sets it itself when vitest globals are on — they aren't)
//    - jsdom polyfills: matchMedia (react-hot-toast asks for
//      prefers-reduced-motion), ResizeObserver (the admin
//      sidebar, the link editor, the DataGrid), scrollTo /
//      scrollIntoView (not implemented by jsdom),
//      IntersectionObserver
//    - axios.defaults.adapter → the fake backend
//
//  Before every test: fresh fake backend, fetch stub, the
//  hard-navigation spy, the console.error recorder.
//
//  After every test: unmount, drop toasts, real timers back,
//  globals/storage/URL reset — and then the three guards FAIL
//  the test when
//    - a request reached no route, or its route's handler
//      threw / returned no reply (see backend.js),
//    - the API contract was broken (tests/contract/api.js,
//      enforced by support/contractGuard.js): an unlisted
//      endpoint or request field, a scripted answer off the
//      contract, or the page reading an unlisted field, or
//    - console.error was called with anything not declared
//      via allowConsoleError(/pattern/) — React key, nesting
//      and prop warnings, MUI dev errors, failures the app
//      logs itself ...
//  ("not wrapped in act" timing warnings are ignored: they
//  describe the test's timing, not the app's behavior). An
//  error THROWN while rendering or in an event handler is not
//  logged — React 19 reports it as a window error, which
//  vitest turns into an unhandled error failing the whole run.
//
//  Split into:
//
//    FakeResizeObserver / resizeObserved — controllable
//                           ResizeObserver
//    allowConsoleError / consoleErrors   — the console guard
//    the beforeEach / afterEach hooks
// -----------------------------------------------------------

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import axios from "axios";
import toast from "react-hot-toast";

import { axiosAdapter, backend, fakeFetch } from "./backend";
import { contractViolations, resetContractGuard } from "./contractGuard";
import { installNavigationSpy } from "./navigation";


globalThis.IS_REACT_ACT_ENVIRONMENT = true;

axios.defaults.adapter = axiosAdapter;







// -----------------------------------------------------------
// FakeResizeObserver / resizeObserved
// -----------------------------------------------------------
//
// jsdom has no ResizeObserver. This one never fires on its
// own; a test reports a size change explicitly:
//
//   resizeObserved(element, { width: 180, height: 20 })
//
// which calls every observer watching `element` with a
// ResizeObserverEntry-like object (contentRect + box sizes).
//
// Used by:
//   - installed as globalThis.ResizeObserver (below)
//   - the admin sidebar width tests, the link editor tests
// -----------------------------------------------------------

const resizeObservers = new Set();

export class FakeResizeObserver {

  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    resizeObservers.add(this);
  }

  observe(target) {
    this.targets.add(target);
  }

  unobserve(target) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    resizeObservers.delete(this);
  }
}

export function resizeObserved(target, { width, height }) {
  const entry = {
    target,
    contentRect: { x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height },
    borderBoxSize: [{ inlineSize: width, blockSize: height }],
    contentBoxSize: [{ inlineSize: width, blockSize: height }],
  };

  for (const observer of [...resizeObservers]) {
    if (observer.targets.has(target)) {
      observer.callback([entry], observer);
    }
  }
}

globalThis.ResizeObserver = FakeResizeObserver;


// Media queries never match (no reduced motion, no print ...)
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
});


// Not implemented by jsdom — window.scrollTo only logs an
// error there. A mock, so tests can assert scrolling
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = function scrollIntoView() {};


// LongPressButton animates with requestAnimationFrame — make
// sure it exists (and so can be faked) even when the jsdom
// environment runs without pretendToBeVisual
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 16);
  globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
}


if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}







// -----------------------------------------------------------
// allowConsoleError / consoleErrors
// -----------------------------------------------------------
//
// Every console.error of a test is recorded (and kept out of
// the output). A test that EXPECTS an error log — e.g. the
// "Error fetching clickable areas:" of a failed request —
// declares it; anything undeclared fails the test.
//
//   allowConsoleError(/Error fetching clickable areas/)
//   consoleErrors()   → every recorded message so far (the
//                       always-tolerated act() timing warnings
//                       left out)
//
// Used by:
//   - tests of logged failures
//   - the afterEach guard (below)
// -----------------------------------------------------------

const ALWAYS_TOLERATED = [
  /not wrapped in act\(/,
];

let recordedErrors = [];
let toleratedErrors = [];
let consoleErrorSpy = null;


// Errors made in jsdom's own realm are not `instanceof Error`
// here — the [[ErrorData]] tag recognises them too
const isError = (argument) =>
  argument instanceof Error || Object.prototype.toString.call(argument) === "[object Error]";

const describeArgument = (argument) => {
  if (isError(argument)) return `${argument.name}: ${argument.message}`;
  if (typeof argument === "string") return argument;
  try {
    return JSON.stringify(argument);
  } catch {
    return String(argument);
  }
};

export function allowConsoleError(pattern) {
  toleratedErrors.push(pattern);
}

export const consoleErrors = () =>
  recordedErrors.filter((message) => !ALWAYS_TOLERATED.some((pattern) => pattern.test(message)));







// -----------------------------------------------------------
// beforeEach / afterEach
// -----------------------------------------------------------
//
// The per-test lifecycle described in the file header. All
// the resetting runs before the guards throw — and every
// reset step runs even when an earlier one throws (e.g. an
// unmount error in cleanup): that error is rethrown only
// once everything is reset, so a failing test never leaks
// its stubs, mocks, timers or requests into the next one.
// -----------------------------------------------------------

beforeEach(() => {
  backend.reset();
  resetContractGuard();
  vi.stubGlobal("fetch", fakeFetch);
  installNavigationSpy();

  recordedErrors = [];
  toleratedErrors = [];
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
    recordedErrors.push(args.map(describeArgument).join(" "));
  });
});


afterEach(() => {
  const resetErrors = [];
  const safely = (step) => {
    try {
      step();
    } catch (error) {
      resetErrors.push(error);
    }
  };

  safely(() => cleanup());
  safely(() => toast.remove());
  safely(() => vi.useRealTimers());

  const unhandledRequests = backend.unhandledAllowed() ? [] : backend.unhandled();
  const brokenContract = contractViolations();
  const unexpectedErrors = recordedErrors.filter(
    (message) => ![...ALWAYS_TOLERATED, ...toleratedErrors].some((pattern) => pattern.test(message))
  );

  safely(() => consoleErrorSpy?.mockRestore());
  safely(() => vi.restoreAllMocks());
  safely(() => vi.clearAllMocks());
  safely(() => vi.unstubAllGlobals());
  safely(() => backend.reset());
  safely(() => resetContractGuard());
  safely(() => localStorage.clear());
  safely(() => sessionStorage.clear());
  safely(() => window.history.replaceState(null, "", "/"));
  safely(() => resizeObservers.clear());

  if (resetErrors.length > 0) {
    throw resetErrors[0];
  }
  if (unhandledRequests.length > 0) {
    throw new Error(`Requests no backend route answered:\n  ${unhandledRequests.join("\n  ")}`);
  }
  if (brokenContract.length > 0) {
    throw new Error(`API contract (tests/contract/api.js) violated:\n  ${brokenContract.join("\n  ")}`);
  }
  if (unexpectedErrors.length > 0) {
    throw new Error(`Unexpected console.error:\n  ${unexpectedErrors.join("\n  ")}`);
  }
});
