// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — AuthProvider / useAuth
//
//  src/auth/AuthProvider.jsx — the one session check of the
//  app: GET /api/checkauth through fetch() with
//  credentials: "include", once on start, shared via context
//  as { authData, loading }:
//    - loading true until the check settles (route guards wait
//      instead of bouncing a logged-in user to /login)
//    - a 200 JSON reply → authData (AdminAuth / StudentAuth)
//    - 401, a network failure or an unreadable body → not
//      logged in (authData undefined), loading false
//    - no polling: a later login/logout only shows after a
//      full page load
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { settle } from "./support/render";
import * as fx from "./support/fixtures";

import { AuthProvider, useAuth } from "@/auth/AuthProvider";


// Prints the context value so the tests can read it
function AuthProbe() {
  const { authData, loading } = useAuth();
  return (
    <output data-testid="auth" data-loading={String(loading)}>
      {authData === undefined ? "undefined" : JSON.stringify(authData)}
    </output>
  );
}

const renderProvider = () => render(<AuthProvider><AuthProbe /></AuthProvider>);

const probe = () => screen.getByTestId("auth");







// -----------------------------------------------------------
// The request
// -----------------------------------------------------------

describe("AuthProvider — the session check request", () => {

  it("asks GET /api/checkauth once, through fetch, with credentials included", async () => {
    backend.on("GET", "/api/checkauth", reply.json(fx.adminAuth()));
    renderProvider();
    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "fetch", method: "GET", url: "/api/checkauth", credentials: "include" });
  });


  it("does not check again on re-renders", async () => {
    backend.on("GET", "/api/checkauth", reply.json(fx.adminAuth()));
    const { rerender } = renderProvider();
    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));

    rerender(<AuthProvider><AuthProbe /></AuthProvider>);
    await settle();

    expect(backend.requests("GET", "/api/checkauth")).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// The shared state
// -----------------------------------------------------------

describe("AuthProvider — the shared state", () => {

  it("is loading, without authData, until the check answers", async () => {
    const check = deferred();
    backend.on("GET", "/api/checkauth", () => check.promise);
    renderProvider();

    expect(probe()).toHaveAttribute("data-loading", "true");
    expect(probe()).toHaveTextContent("undefined");

    await act(async () => check.resolve(reply.json(fx.studentAuth())));
    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(JSON.parse(probe().textContent)).toEqual(fx.studentAuth());
  });


  it("shares an administrator's identity", async () => {
    backend.on("GET", "/api/checkauth", reply.json(fx.adminAuth({ id: "vadovas@knf.vu.lt", userid: 3 })));
    renderProvider();

    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(JSON.parse(probe().textContent)).toEqual({ id: "vadovas@knf.vu.lt", userid: 3, admin: 1 });
  });


  it("shares a student's identity with the passcode and finished flag", async () => {
    const student = fx.studentAuth({ id: "VARDENĖ_PAVARDENĖ", userid: 7, phishingtestfinished: 1 });
    backend.on("GET", "/api/checkauth", reply.json(student));
    renderProvider();

    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(JSON.parse(probe().textContent)).toEqual(student);
  });


  it("treats 401 as not logged in", async () => {
    backend.on("GET", "/api/checkauth", reply.status(401, "Unauthorized"));
    renderProvider();

    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(probe()).toHaveTextContent("undefined");
  });


  it("treats a network failure as not logged in", async () => {
    backend.on("GET", "/api/checkauth", reply.networkError());
    renderProvider();

    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(probe()).toHaveTextContent("undefined");
  });


  it("treats an unreadable 200 body as not logged in", async () => {
    // A proxy's error page instead of the API — off the contract
    // on purpose
    backend.on("GET", "/api/checkauth", reply.text("<html>proxy error page</html>", 200, { offContract: true }));
    renderProvider();

    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(probe()).toHaveTextContent("undefined");
  });


  it("treats a server error as not logged in", async () => {
    backend.on("GET", "/api/checkauth", reply.status(500, "Internal Server Error"));
    renderProvider();

    await waitFor(() => expect(probe()).toHaveAttribute("data-loading", "false"));
    expect(probe()).toHaveTextContent("undefined");
  });
});







// -----------------------------------------------------------
// useAuth outside the provider
// -----------------------------------------------------------

describe("useAuth outside AuthProvider", () => {

  it("reads the default context: loading, no authData", () => {
    render(<AuthProbe />);

    expect(probe()).toHaveAttribute("data-loading", "true");
    expect(probe()).toHaveTextContent("undefined");
    expect(backend.requests()).toHaveLength(0);
  });
});
