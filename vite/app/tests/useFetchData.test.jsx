// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — useFetchData, the app's GET hook
//
//  src/hooks/useFetchData.js — behind every admin grid and
//  dashboard, the leaderboard and the results page:
//    - the request: GET <endpoint>, withCredentials
//    - states: data starts [] (lists can map at once),
//      loadingData true until the first answer, error
//    - 401 → full navigation to /login (consumers never see
//      auth errors, and stay "loading" meanwhile)
//    - any other failure → `error`, loading ends, the LAST
//      GOOD data is kept (a polling page survives a blip)
//    - refetch() — a manual reload without a loading flash
//    - refreshInterval (seconds) — polling until unmount
//    - an endpoint change starts over: [] + loading again
//    - allowEmpty + a falsy endpoint: no request at all
//
//  The hook's two known defects (a late reply from a previous
//  endpoint, the "Error: Not Admin" role-gate reply handed
//  over as data) are pinned in knownBugs.test.jsx (KB-09,
//  KB-10) — not here.
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { hardNavigations } from "./support/navigation";
import { settle } from "./support/render";
import * as fx from "./support/fixtures";

import useFetchData from "@/hooks/useFetchData";


// The hook's latest return value, captured on every render
let hook;

function Probe({ endpoint, refreshInterval = null, allowEmpty = false }) {
  hook = useFetchData(endpoint, refreshInterval, allowEmpty);
  return null;
}


const STUDENTS = "/api/admin/students";







// -----------------------------------------------------------
// The request and the success path
// -----------------------------------------------------------

describe("useFetchData — the request and the success path", () => {

  it("starts empty and loading, before any reply", async () => {
    const pending = deferred();
    backend.on("GET", STUDENTS, () => pending.promise);
    render(<Probe endpoint={STUDENTS} />);

    expect(hook.data).toEqual([]);
    expect(hook.loadingData).toBe(true);
    expect(hook.error).toBeNull();

    // Answered before the test ends — no reply left in flight
    await act(async () => pending.resolve(reply.json([])));
    await waitFor(() => expect(hook.loadingData).toBe(false));
  });


  it("sends exactly one GET with the session cookie", async () => {
    backend.on("GET", STUDENTS, reply.json([]));
    render(<Probe endpoint={STUDENTS} />);
    await waitFor(() => expect(hook.loadingData).toBe(false));

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: STUDENTS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("hands over the parsed reply and ends loading", async () => {
    const students = [fx.studentDetail({ id: 1 }), fx.blankStudentDetail({ id: 2, username: "NAUJOKAS" })];
    backend.on("GET", STUDENTS, reply.json(students));
    render(<Probe endpoint={STUDENTS} />);

    await waitFor(() => expect(hook.loadingData).toBe(false));
    expect(hook.data).toEqual(students);
    expect(hook.error).toBeNull();
  });


  it("hands an object reply over unchanged", async () => {
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard()));
    render(<Probe endpoint="/api/admin/home" />);

    await waitFor(() => expect(hook.loadingData).toBe(false));
    expect(hook.data).toEqual(fx.dashboard());
  });
});







// -----------------------------------------------------------
// Failures
// -----------------------------------------------------------

describe("useFetchData — failures", () => {

  it("sends a 401 to /login with a full navigation and keeps loading", async () => {
    backend.on("GET", STUDENTS, reply.status(401, "Unauthorized"));
    render(<Probe endpoint={STUDENTS} />);

    // The target is pinned, not how often it is set — a shared
    // 401 handler (the fix of KB-21 / KB-36) may redirect as well
    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(hook.loadingData).toBe(true);
    expect(hook.error).toBeNull();
    expect(hook.data).toEqual([]);
  });


  it("reports a server error and ends loading", async () => {
    backend.on("GET", STUDENTS, reply.status(500, "Internal Server Error"));
    render(<Probe endpoint={STUDENTS} />);

    await waitFor(() => expect(hook.loadingData).toBe(false));
    expect(hook.error?.response?.status).toBe(500);
    expect(hook.data).toEqual([]);
    expect(hardNavigations()).toEqual([]);
  });


  it("reports a network failure and ends loading", async () => {
    backend.on("GET", STUDENTS, reply.networkError());
    render(<Probe endpoint={STUDENTS} />);

    await waitFor(() => expect(hook.loadingData).toBe(false));
    expect(hook.error?.code).toBe("ERR_NETWORK");
    expect(hook.error?.response).toBeUndefined();
  });


  it("keeps the last good data when a later fetch fails", async () => {
    const students = [fx.studentDetail()];
    backend.on("GET", STUDENTS, reply.json(students));
    render(<Probe endpoint={STUDENTS} />);
    await waitFor(() => expect(hook.data).toEqual(students));

    backend.on("GET", STUDENTS, reply.status(502, "Bad Gateway"));
    await act(() => hook.refetch());

    expect(hook.error?.response?.status).toBe(502);
    expect(hook.data).toEqual(students);
    expect(hook.loadingData).toBe(false);
  });


  it("clears the error once a fetch succeeds again", async () => {
    backend.on("GET", STUDENTS, reply.status(500));
    render(<Probe endpoint={STUDENTS} />);
    await waitFor(() => expect(hook.error).not.toBeNull());

    backend.on("GET", STUDENTS, reply.json([fx.studentDetail()]));
    await act(() => hook.refetch());

    expect(hook.error).toBeNull();
    expect(hook.data).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// refetch
// -----------------------------------------------------------

describe("useFetchData — refetch", () => {

  it("loads again on demand and applies the new reply", async () => {
    backend.on("GET", STUDENTS, reply.json([fx.studentDetail({ id: 1 })]));
    render(<Probe endpoint={STUDENTS} />);
    await waitFor(() => expect(hook.data).toHaveLength(1));

    backend.on("GET", STUDENTS, reply.json([fx.studentDetail({ id: 1 }), fx.studentDetail({ id: 2 })]));
    await act(() => hook.refetch());

    expect(hook.data).toHaveLength(2);
    expect(backend.requests("GET", STUDENTS)).toHaveLength(2);
  });


  it("does not flash back to loading while a refetch runs", async () => {
    backend.on("GET", STUDENTS, reply.json([fx.studentDetail()]));
    render(<Probe endpoint={STUDENTS} />);
    await waitFor(() => expect(hook.loadingData).toBe(false));

    const slow = deferred();
    backend.once("GET", STUDENTS, () => slow.promise);
    let refetching;
    act(() => {
      refetching = hook.refetch();
    });

    expect(hook.loadingData).toBe(false);
    expect(hook.data).toHaveLength(1);

    await act(async () => {
      slow.resolve(reply.json([]));
      await refetching;
    });
    expect(hook.data).toEqual([]);
  });
});







// -----------------------------------------------------------
// Polling
// -----------------------------------------------------------

describe("useFetchData — polling", () => {

  // Only the interval is faked: the fake backend answers on
  // promises. NOT waitFor here — it re-checks on a setInterval
  // (now fake) or on DOM changes (the probe renders none); the
  // real-setTimeout settle() drains the replies instead
  const useFakeInterval = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });


  it("polls every refreshInterval seconds", async () => {
    useFakeInterval();
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard()));
    render(<Probe endpoint="/api/admin/home" refreshInterval={2} />);
    await settle();
    expect(backend.requests("GET", "/api/admin/home")).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(backend.requests("GET", "/api/admin/home")).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(backend.requests("GET", "/api/admin/home")).toHaveLength(2);

    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(backend.requests("GET", "/api/admin/home")).toHaveLength(4);
  });


  it("picks up new data on every poll", async () => {
    useFakeInterval();
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard({ studentscount: 1 })));
    render(<Probe endpoint="/api/admin/home" refreshInterval={2} />);
    await settle();
    expect(hook.data.studentscount).toBe(1);

    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard({ studentscount: 2 })));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await settle();

    expect(hook.data.studentscount).toBe(2);
  });


  it("stops polling after unmount", async () => {
    useFakeInterval();
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard()));
    const { unmount } = render(<Probe endpoint="/api/admin/home" refreshInterval={2} />);
    await settle();

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));

    expect(backend.requests("GET", "/api/admin/home")).toHaveLength(1);
  });


  it("does not poll without a refreshInterval", async () => {
    useFakeInterval();
    backend.on("GET", STUDENTS, reply.json([]));
    render(<Probe endpoint={STUDENTS} />);
    await settle();

    await act(() => vi.advanceTimersByTimeAsync(60000));

    expect(backend.requests("GET", STUDENTS)).toHaveLength(1);
  });


  it("keeps polling after a failed poll", async () => {
    useFakeInterval();
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard({ studentscount: 1 })));
    render(<Probe endpoint="/api/admin/home" refreshInterval={2} />);
    await settle();
    expect(hook.data.studentscount).toBe(1);

    backend.once("GET", "/api/admin/home", reply.status(500));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await settle();
    expect(hook.error?.response?.status).toBe(500);
    expect(hook.data.studentscount).toBe(1);

    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard({ studentscount: 3 })));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await settle();
    expect(hook.error).toBeNull();
    expect(hook.data.studentscount).toBe(3);
  });
});







// -----------------------------------------------------------
// Endpoint changes and conditional fetching
// -----------------------------------------------------------

describe("useFetchData — endpoint changes and conditional fetching", () => {

  it("starts over on an endpoint change: empty, loading, then the new data", async () => {
    backend.on("GET", "/api/admin/students/1", reply.json(fx.studentDetail({ id: 1, username: "PIRMAS" })));
    const second = deferred();
    backend.on("GET", "/api/admin/students/2", () => second.promise);

    const { rerender } = render(<Probe endpoint="/api/admin/students/1" />);
    await waitFor(() => expect(hook.data.username).toBe("PIRMAS"));

    rerender(<Probe endpoint="/api/admin/students/2" />);
    await settle();
    expect(hook.data).toEqual([]);
    expect(hook.loadingData).toBe(true);

    await act(async () => second.resolve(reply.json(fx.studentDetail({ id: 2, username: "ANTRAS" }))));
    await waitFor(() => expect(hook.data.username).toBe("ANTRAS"));
    expect(hook.loadingData).toBe(false);
  });


  it("with allowEmpty and no endpoint: no request, loading ends, data stays []", async () => {
    render(<Probe endpoint={null} allowEmpty />);

    await waitFor(() => expect(hook.loadingData).toBe(false));
    expect(hook.data).toEqual([]);
    expect(backend.requests()).toHaveLength(0);
  });


  it("with allowEmpty, fetches as soon as the endpoint appears", async () => {
    backend.on("GET", STUDENTS, reply.json([fx.studentDetail()]));
    const { rerender } = render(<Probe endpoint="" allowEmpty />);
    await waitFor(() => expect(hook.loadingData).toBe(false));

    rerender(<Probe endpoint={STUDENTS} allowEmpty />);

    await waitFor(() => expect(hook.data).toHaveLength(1));
    expect(backend.requests("GET", STUDENTS)).toHaveLength(1);
  });
});
