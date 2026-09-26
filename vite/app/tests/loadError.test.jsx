// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — LoadError, the failed-load panel
//
//  src/components/Other/LoadError/LoadError.jsx — what the
//  pages show where their data failed to load (the pages'
//  own tests pin where it appears and what it retries):
//    - an alert with the page's message (a generic one
//      without)
//    - "Bandyti dar kartą" calls onRetry — one retry at a
//      time: while it runs the button is aria-disabled (it
//      keeps the keyboard focus) and "Bandoma iš naujo…" shows
//    - a retry that did not help (the panel is still there once
//      it settled — answered or failed) says "Vis dar
//      nepavyko…" and can be retried again; a successful one
//      makes the page replace the panel
//    - no button without onRetry (the projector page)
// -----------------------------------------------------------

import "./support/setup";

import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { deferred } from "./support/backend";
import { consoleErrors } from "./support/setup";

import LoadError from "@/components/Other/LoadError/LoadError";


const retryButton = () => screen.getByRole("button", { name: "Bandyti dar kartą" });

const STILL_FAILING = "Vis dar nepavyko — bandykite dar kartą vėliau";


// A page that shows the panel until its retry works
function PageWithRetry({ request }) {
  const [loaded, setLoaded] = useState(false);

  const retry = async () => {
    await request.promise;
    setLoaded(true);
  };

  return loaded ? <div>Duomenys</div> : <LoadError message="Nepavyko įkelti duomenų" onRetry={retry} />;
}







// -----------------------------------------------------------
// LoadError
// -----------------------------------------------------------

describe("LoadError", () => {

  it("shows the page's message as an alert, with the retry button", () => {
    render(<LoadError message="Nepavyko įkelti klausimų" onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Nepavyko įkelti klausimų");
    expect(retryButton()).not.toHaveAttribute("aria-disabled", "true");
  });


  it("says 'Nepavyko įkelti duomenų' when the page gives no message", () => {
    render(<LoadError onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Nepavyko įkelti duomenų");
  });


  it("shows no button without onRetry", () => {
    render(<LoadError message="Rezultatai šiuo metu nepasiekiami" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Rezultatai šiuo metu nepasiekiami");
    expect(screen.queryByRole("button")).toBeNull();
  });


  it("retries on a click — one at a time: aria-disabled and 'Bandoma iš naujo…' while it runs", async () => {
    const user = userEvent.setup();
    const request = deferred();
    const onRetry = vi.fn(() => request.promise);
    render(<LoadError onRetry={onRetry} />);

    await user.click(retryButton());
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(retryButton()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Bandoma iš naujo…");

    await user.click(retryButton());
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve());
    expect(retryButton()).not.toHaveAttribute("aria-disabled", "true");
  });


  // Disabling the focused button would drop keyboard users'
  // focus to the page — aria-disabled keeps it where it was
  it("keeps the keyboard focus on the button while the retry runs", async () => {
    const user = userEvent.setup();
    const request = deferred();
    render(<LoadError onRetry={() => request.promise} />);

    await user.tab();
    expect(retryButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(retryButton()).toHaveAttribute("aria-disabled", "true");
    expect(retryButton()).toHaveFocus();

    await act(async () => request.resolve());
  });


  it("says so when a retry did not help — the panel is still there — and can be retried again", async () => {
    const user = userEvent.setup();
    const first = deferred();
    const second = deferred();
    const onRetry = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<LoadError onRetry={onRetry} />);

    await user.click(retryButton());
    // A retry whose request fails still ends — the page keeps
    // the panel on screen and the admin may ask once more
    await act(async () => {
      first.reject(new Error("Network Error"));
      await first.promise.catch(() => {});
    });

    expect(screen.getByRole("alert")).toHaveTextContent(STILL_FAILING);
    expect(screen.queryByText("Bandoma iš naujo…")).toBeNull();

    await user.click(retryButton());
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(STILL_FAILING)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Bandoma iš naujo…");

    await act(async () => second.resolve());
  });


  it("says nothing more when the retry worked — the page replaces the panel", async () => {
    const user = userEvent.setup();
    const request = deferred();
    render(<PageWithRetry request={request} />);

    await user.click(retryButton());
    await act(async () => request.resolve());

    expect(screen.getByText("Duomenys")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(consoleErrors()).toEqual([]);
  });


  it("takes a retry that returns nothing (a page that reloads by state) — ready again at once", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<LoadError onRetry={onRetry} />);

    await user.click(retryButton());

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(retryButton()).not.toHaveAttribute("aria-disabled", "true");
  });
});
