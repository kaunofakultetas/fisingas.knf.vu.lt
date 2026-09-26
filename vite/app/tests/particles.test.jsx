// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — login background and loader
//
//  Two presentational pieces of the login page:
//    - Particles (components/Particles/Particles.jsx) — the
//      tsparticles backdrop. The library draws on a canvas
//      jsdom does not have, so react-tsparticles is replaced
//      by a component recording the props it gets, and
//      tsparticles-slim by a resolving loadSlim. Pinned:
//      fullscreen behind the page (zIndex -1), 30 fps, hover
//      repulse on / click push off, links within 150 px, the
//      faint small slow look, and the particle count — 0 on
//      the first render, window.innerWidth / 10 after mount
//      (102.4 at jsdom's 1024 px); `id` is passed through and
//      init loads the slim bundle into the engine it gets
//    - BouncingDotsLoader — the three staggered dots inside
//      the "PALAUKITE" button
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

import TsParticles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";

import { deferred } from "./support/backend";

import ParticlesBackground from "@/systemPages/PublicPages/Login/components/Particles/Particles";
import BouncingDotsLoader from "@/systemPages/PublicPages/Login/components/BouncingDotsLoader/BouncingDotsLoader";


// The library component renders nothing and keeps every call
// (= every render's props); the slim bundle "loads" at once
vi.mock("react-tsparticles", () => ({
  default: vi.fn(() => null),
}));

vi.mock("tsparticles-slim", () => ({
  loadSlim: vi.fn(() => Promise.resolve()),
}));


// The props of every render of the library component, in order
const renders = () => TsParticles.mock.calls.map(([props]) => props);
const firstRender = () => renders()[0];
const latestRender = () => renders()[renders().length - 1];







// -----------------------------------------------------------
// Particles — the particle count
// -----------------------------------------------------------
//
// Read from the viewport width once the component is mounted
// (~1 particle per 10 px), so wide screens don't look empty
// and phones aren't overcrowded.
// -----------------------------------------------------------

describe("Particles — the particle count", () => {

  it("starts with 0 particles on the first render", () => {
    render(<ParticlesBackground />);

    expect(firstRender().options.particles.number).toEqual({ value: 0 });
  });


  it("sets window.innerWidth / 10 particles after mount — 102.4 at jsdom's 1024 px", () => {
    render(<ParticlesBackground />);

    expect(window.innerWidth).toBe(1024);
    expect(renders().length).toBeGreaterThan(1);
    expect(latestRender().options.particles.number).toEqual({ value: 102.4 });
  });


  it("scales with the viewport: a 375 px phone gets 37.5", () => {
    vi.stubGlobal("innerWidth", 375);
    render(<ParticlesBackground />);

    expect(latestRender().options.particles.number).toEqual({ value: 37.5 });
  });
});







// -----------------------------------------------------------
// Particles — the tsparticles options
// -----------------------------------------------------------

describe("Particles — the tsparticles options", () => {

  it("covers the whole viewport, behind the page content", () => {
    render(<ParticlesBackground />);

    expect(latestRender().options.fullScreen).toEqual({ enable: true, zIndex: -1 });
  });


  it("is capped at 30 fps and retina-aware", () => {
    render(<ParticlesBackground />);

    expect(latestRender().options.fpsLimit).toBe(30);
    expect(latestRender().options.detectRetina).toBe(true);
  });


  it("pushes particles away from the cursor (repulse within 100 px)", () => {
    render(<ParticlesBackground />);

    const { events, modes } = latestRender().options.interactivity;
    expect(events.onHover).toEqual({ enable: true, mode: "repulse" });
    expect(modes.repulse).toEqual({ distance: 100 });
  });


  it("spawns nothing on click — push is off", () => {
    render(<ParticlesBackground />);

    const { events, modes } = latestRender().options.interactivity;
    expect(events.onClick).toEqual({ enable: false, mode: "push" });
    expect(modes.push).toEqual({ quantity: 10 });
  });


  it("links particles closer than 150 px", () => {
    render(<ParticlesBackground />);

    expect(latestRender().options.particles.links).toEqual({ enable: true, distance: 150, opacity: 0.5 });
  });


  it("keeps the backdrop faint, small and slow", () => {
    render(<ParticlesBackground />);

    const { particles } = latestRender().options;
    expect(particles.opacity).toEqual({ value: { min: 0, max: 0.2 } });
    expect(particles.size).toEqual({ value: { min: 1, max: 3 } });
    expect(particles.move).toEqual({ enable: true, speed: { min: 0.01, max: 1 } });
  });
});







// -----------------------------------------------------------
// Particles — the id and the engine
// -----------------------------------------------------------

describe("Particles — the id and the engine", () => {

  it("passes the id prop through", () => {
    render(<ParticlesBackground id="tsparticles" />);

    expect(latestRender().id).toBe("tsparticles");
  });


  it("passes no id when given none, as on the login page", () => {
    render(<ParticlesBackground />);

    expect(latestRender().id).toBeUndefined();
  });


  it("does not load the engine by itself — only through init", () => {
    render(<ParticlesBackground />);

    expect(loadSlim).not.toHaveBeenCalled();
  });


  it("init loads the slim bundle into the engine it receives", async () => {
    render(<ParticlesBackground />);
    const engine = { name: "tsparticles engine" };

    await latestRender().init(engine);

    expect(loadSlim).toHaveBeenCalledTimes(1);
    expect(loadSlim).toHaveBeenCalledWith(engine);
  });


  it("init finishes only once the slim bundle has loaded", async () => {
    // tsparticles waits for init before it builds the scene —
    // links and repulse come from the slim bundle
    const loading = deferred();
    loadSlim.mockReturnValueOnce(loading.promise);
    render(<ParticlesBackground />);

    let initialised = false;
    const initialising = latestRender().init({}).then(() => {
      initialised = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(initialised).toBe(false);

    loading.resolve();
    await initialising;
    expect(initialised).toBe(true);
  });


  it("hands the same init function to every render", () => {
    // react-tsparticles compares `init` by identity and tears
    // the scene down and rebuilds it when it changes
    render(<ParticlesBackground />);

    expect(renders().length).toBeGreaterThan(1);
    expect(latestRender().init).toBe(firstRender().init);
  });
});







// -----------------------------------------------------------
// BouncingDotsLoader
// -----------------------------------------------------------
//
// The animation itself (animate-bounce-dot, a ±5 px swing)
// lives in globals.css — only the classes are there to pin.
// -----------------------------------------------------------

describe("BouncingDotsLoader", () => {

  const dots = (container) => [...container.firstChild.children];


  it("draws three dots", () => {
    const { container } = render(<BouncingDotsLoader />);

    expect(dots(container)).toHaveLength(3);
  });


  it("bounces every dot, each starting 5 px down", () => {
    const { container } = render(<BouncingDotsLoader />);

    for (const dot of dots(container)) {
      expect(dot).toHaveClass("animate-bounce-dot", "[transform:translateY(5px)]");
    }
  });


  it("lets the 1st dot lead, the 2nd trail by 0.2 s and the 3rd by 0.3 s", () => {
    const { container } = render(<BouncingDotsLoader />);
    const [first, second, third] = dots(container);

    expect(first.className).not.toContain("animation-delay");
    expect(second).toHaveClass("[animation-delay:0.2s]");
    expect(second).not.toHaveClass("[animation-delay:0.3s]");
    expect(third).toHaveClass("[animation-delay:0.3s]");
    expect(third).not.toHaveClass("[animation-delay:0.2s]");
  });


  it("carries no text — the button around it keeps its 'PALAUKITE' label", () => {
    const { container } = render(<BouncingDotsLoader />);

    expect(container.textContent).toBe("");
    for (const dot of dots(container)) {
      expect(dot).toBeEmptyDOMElement();
    }
  });
});
