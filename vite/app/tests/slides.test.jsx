// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the Slides projector kiosk
//
//  src/systemPages/PublicPages/Slides/Slides.jsx — the event
//  loop: the live /leaderboard (iframe) for 6 s while the next
//  slide is preloaded, then that slide for 20 s, repeat.
//    - GET /api/leaderboard/nextslide through fetch (public,
//      no options); the image blob becomes an object URL and is
//      fully decoded (new Image()) before it is shown
//    - no slide available (404, network error, broken image)
//      → the leaderboard simply stays up and it retries on the
//      next cycle
//    - object URLs are revoked when replaced, and on unmount
//      (also a preloaded one that never got shown)
//    - the leaderboard iframe stays mounted the whole time
//      (the layers cross-fade, the live page never reloads)
//
//  Timing runs on a fake setTimeout / clearTimeout (the loop's
//  sleep()) driven by advanceTimersByTimeAsync, which lets the
//  preload's promise chain run after every timer; jsdom decodes
//  no images (a FakeImage stands in) and the object URLs are
//  spied on so they get predictable names (blob:slide-1, -2 …).
//  A preload starts the moment the previous phase's sleep ends:
//  requests go out at 0 s, then at every leaderboard phase.
// -----------------------------------------------------------

import "./support/setup";

import { beforeEach, describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";

import { backend, reply } from "./support/backend";
import { allowConsoleError, consoleErrors } from "./support/setup";
import { renderPage } from "./support/render";

import SlidesPage from "@/systemPages/PublicPages/Slides/Slides";


const NEXT_SLIDE = "/api/leaderboard/nextslide";

let objectUrlCount;
let imagesFail;


// Decodes on the next microtask — or fails, when imagesFail
class FakeImage {
  set src(value) {
    this.currentSrc = value;
    queueMicrotask(() => (imagesFail ? this.onerror?.(new Event("error")) : this.onload?.(new Event("load"))));
  }

  get src() {
    return this.currentSrc;
  }
}


// Spies, not assignments: setup.js's vi.restoreAllMocks() puts
// the real URL statics back after every test
beforeEach(() => {
  objectUrlCount = 0;
  imagesFail = false;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:slide-${++objectUrlCount}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("Image", FakeImage);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});


const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));

const slidePanel = () => document.querySelector("iframe").parentElement.previousElementSibling;
const leaderboardPanel = () => document.querySelector("iframe").parentElement;
const shownSlide = () => screen.queryByAltText("Skaidrė");
const slideRequests = () => backend.requests("GET", NEXT_SLIDE).length;

// Tailwind is not loaded — which layer shows is in its classes:
// opaque and on top (opacity-100 z-2), or transparent and
// underneath (opacity-0 z-1); anything else fails loudly
const isVisible = (panel) => {
  const shown = panel.classList.contains("opacity-100") && panel.classList.contains("z-2");
  const hidden = panel.classList.contains("opacity-0") && panel.classList.contains("z-1");
  if (shown === hidden) {
    throw new Error(`Neither shown nor hidden: "${panel.className}"`);
  }
  return shown;
};







// -----------------------------------------------------------
// The first cycle
// -----------------------------------------------------------

describe("Slides — the first cycle", () => {

  it("starts on the leaderboard iframe with no slide", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });
    await advance(0);

    const iframe = screen.getByTitle("Leaderboard");
    expect(iframe).toHaveAttribute("src", "/leaderboard");
    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(isVisible(slidePanel())).toBe(false);
    expect(shownSlide()).toBeNull();
  });


  it("preloads the next slide through a plain GET while the leaderboard shows", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });
    await advance(0);

    const requests = backend.requests("GET", NEXT_SLIDE);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "fetch", method: "GET", url: NEXT_SLIDE });
    expect(requests[0].credentials).toBeUndefined();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Preloaded, not shown yet
    expect(shownSlide()).toBeNull();
  });


  it("keeps the leaderboard for the full 6 s", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(5999);

    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(shownSlide()).toBeNull();
  });


  it("swaps the preloaded slide in after 6 s", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);

    expect(shownSlide()).toHaveAttribute("src", "blob:slide-1");
    expect(isVisible(slidePanel())).toBe(true);
    expect(isVisible(leaderboardPanel())).toBe(false);
  });


  it("shows the slide for 20 s, then the leaderboard again", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);
    await advance(19999);
    expect(isVisible(slidePanel())).toBe(true);

    await advance(1);
    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(isVisible(slidePanel())).toBe(false);
  });
});







// -----------------------------------------------------------
// Following cycles and object URLs
// -----------------------------------------------------------

describe("Slides — following cycles and object URLs", () => {

  it("preloads the next slide during the next leaderboard phase and swaps it in", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/jpeg"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);    // slide 1 on
    await advance(19999);   // …still on — nothing fetched meanwhile
    expect(slideRequests()).toBe(1);

    await advance(1);       // leaderboard again, slide 2 preloading
    expect(slideRequests()).toBe(2);
    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(shownSlide()).toHaveAttribute("src", "blob:slide-1");

    await advance(6000);    // slide 2 on
    expect(shownSlide()).toHaveAttribute("src", "blob:slide-2");
    expect(isVisible(slidePanel())).toBe(true);
  });


  // The layers only cross-fade — a remounted iframe would reload
  // the live leaderboard (a white flash) every cycle
  it("keeps the one leaderboard iframe mounted through the cycle", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });
    const iframe = screen.getByTitle("Leaderboard");

    await advance(6000);    // slide on
    expect(screen.getByTitle("Leaderboard")).toBe(iframe);

    await advance(20000);   // leaderboard again
    expect(screen.getByTitle("Leaderboard")).toBe(iframe);
    expect(isVisible(leaderboardPanel())).toBe(true);
  });


  it("revokes the previous slide's object URL when the next one replaces it", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    await advance(26000);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:slide-1");
  });


  it("revokes the shown slide's URL on unmount and stops the loop", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    const { unmount } = renderPage(<SlidesPage />, { path: "/slides" });
    await advance(6000);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:slide-1");

    await advance(60000);
    expect(backend.requests("GET", NEXT_SLIDE)).toHaveLength(1);
  });


  it("revokes a preloaded slide that never got shown when unmounted meanwhile", async () => {
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    const { unmount } = renderPage(<SlidesPage />, { path: "/slides" });
    await advance(1000);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    unmount();
    await advance(5000);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:slide-1");
  });
});







// -----------------------------------------------------------
// No slide available
// -----------------------------------------------------------

describe("Slides — no slide available", () => {

  // Each failed phase starts the next one — and its preload —
  // at once: requests at 0, 6 and 12 s
  it("stays on the leaderboard when there are no slides (404) and retries every 6 s", async () => {
    backend.on("GET", NEXT_SLIDE, reply.json({ error: "No slide images found" }, 404));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);
    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(shownSlide()).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(slideRequests()).toBe(2);

    await advance(6000);
    expect(slideRequests()).toBe(3);
    expect(isVisible(leaderboardPanel())).toBe(true);
  });


  it("stays on the leaderboard when the request fails, logging the failure", async () => {
    allowConsoleError(/Failed to fetch slide/);
    backend.on("GET", NEXT_SLIDE, reply.networkError());
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);

    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(shownSlide()).toBeNull();
    expect(consoleErrors()).toContain("Failed to fetch slide: TypeError: Failed to fetch");
  });


  it("does not show an image the browser cannot decode", async () => {
    allowConsoleError(/Failed to fetch slide/);
    imagesFail = true;
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);

    expect(isVisible(leaderboardPanel())).toBe(true);
    expect(shownSlide()).toBeNull();
  });


  it("shows a slide on the next cycle once slides reappear", async () => {
    backend.once("GET", NEXT_SLIDE, reply.json({ error: "Slides directory not found" }, 404));
    backend.on("GET", NEXT_SLIDE, reply.image("image/png"));
    renderPage(<SlidesPage />, { path: "/slides" });

    await advance(6000);
    expect(shownSlide()).toBeNull();

    await advance(6000);
    expect(shownSlide()).toHaveAttribute("src", "blob:slide-1");
    expect(isVisible(slidePanel())).toBe(true);
  });
});
