// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Known bugs — pinned as EXPECTED FAILURES
//
//  The frontend's ledger of defects that are known but not
//  fixed yet (the counterpart of the backend's
//  test_known_bugs.py). No defect is pinned at the moment.
//
//  A defect found but not fixed at once gets an entry here:
//  one numbered describe per bug (KB-NN) whose banner states
//  WHERE the defect lives, the TRIGGER, the IMPACT and a
//  SUGGESTED FIX, holding one or more PAIRS of tests — one
//  pair per way the defect shows:
//
//    - "reproduces: …" — a plain test asserting the CURRENT,
//      wrong behavior. It proves the scenario really triggers
//      in this environment, so the expected failure next to
//      it cannot be a broken test in disguise
//    - it.fails(…)     — asserts the CORRECT behavior and is
//      expected to fail, so the suite stays green while the
//      defect stays documented and executable
//
//  When a bug gets fixed, BOTH tests of each of its pairs fail
//  the suite: the reproduction no longer reproduces and the
//  expected failure unexpectedly passes. The fix is completed
//  by deleting the reproductions and moving the other tests
//  (as plain `it`s) into their topic files.
// -----------------------------------------------------------

import "./support/setup";

import { describe, it } from "vitest";


// vitest refuses a test file without tests — the placeholder
// keeps the ledger in the suite while it holds no entry
describe("Known bugs", () => {
  it.todo("no known bug is pinned at the moment");
});
