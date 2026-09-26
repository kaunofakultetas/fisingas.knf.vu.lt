// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the admin sidebar
//
//  src/components/Admin/Sidebar/Sidebar.jsx — the left
//  navigation of every admin page:
//    - 11 links in four sections (PAGRINDINIS, SĄRAŠAI,
//      PREZENTACIJA, SISTEMA): router links inside the app
//      (Pradžia, Studentai, Klausimai, Administratoriai, and
//      Atsijungti → /login) and plain new-tab links to the
//      stack's other services (/slides, /filebrowser/…,
//      /leaderboard, /swagger, /dbgate)
//    - the active row (tinted, label in the brand color): the
//      LONGEST href the URL equals or nests under, on whole
//      path segments — /admin/students/5 lights "Studentai",
//      not "Pradžia"; new-tab rows never light up
//    - pinned: docked open, taking its width in the page
//      layout; floating: a 52 px rail whose panel flies out
//      OVER the page while hovered and folds back 200 ms after
//      the pointer leaves. Starts pinned on windows of 768 px
//      and up unless localStorage "sidebarOpen" is "false";
//      the pin button flips it and stores "true" / "false"
//    - on the rail: divider lines instead of the section
//      titles, invisible labels
//    - the expanded width fits the content: the widest label
//      (an invisible ghost copy watched by a ResizeObserver)
//      rounded up + 65.5 px, clamped to 140–400 px; reports
//      under 30 px are ignored
//
//  The last measured width lives in a MODULE-level variable
//  shared by every sidebar this file mounts (a remounted
//  sidebar starts from it) — so every test asserting an
//  expanded width reports a measurement first, whatever ran
//  before it. The 210 px default before any measurement is
//  pinned in adminHome.test.jsx, where nothing ever measures.
// -----------------------------------------------------------

import "./support/setup";

import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { resizeObserved } from "./support/setup";
import { renderPage, settle } from "./support/render";
import { hardNavigations } from "./support/navigation";

import AdminSidebar from "@/components/Admin/Sidebar/Sidebar";


const RAIL = "52px";
const ACTIVE_TINT = "bg-[rgba(var(--mui-palette-primary-mainChannel)/0.20)]";
const FLY_OVER_SHADOW = "shadow-[4px_0_20px_rgba(0,0,0,0.25)]";

// [label, href, MUI icon test id]
const INTERNAL_LINKS = [
  ["Pradžia", "/admin", "DashboardIcon"],
  ["Studentai", "/admin/students", "PersonOutlineIcon"],
  ["Klausimai", "/admin/questions", "QuestionMarkIcon"],
  ["Administratoriai", "/admin/administrators", "BadgeIcon"],
  ["Atsijungti", "/login", "ExitToAppIcon"],
];

const EXTERNAL_LINKS = [
  ["Skaidrės (Paleisti)", "/slides", "SlideshowIcon"],
  ["Skaidrės (Failai)", "/filebrowser/slides", "ImageIcon"],
  ["Leaderboard'as", "/leaderboard", "LeaderboardIcon"],
  ["Failų Dropbox'as", "/filebrowser/dropbox", "UploadFileIcon"],
  ["API Dokumentacija", "/swagger", "ApiIcon"],
  ["Duomenų Bazė", "/dbgate", "StorageIcon"],
];

// [section title, its labels top to bottom]
const SECTIONS = [
  ["PAGRINDINIS", ["Pradžia"]],
  ["SĄRAŠAI", ["Studentai", "Klausimai"]],
  ["PREZENTACIJA", ["Skaidrės (Paleisti)", "Skaidrės (Failai)", "Leaderboard'as"]],
  ["SISTEMA", ["Administratoriai", "Failų Dropbox'as", "API Dokumentacija", "Duomenų Bazė", "Atsijungti"]],
];

const SECTION_TITLES = SECTIONS.map(([title]) => title);
const ALL_LABELS = SECTIONS.flatMap(([, labels]) => labels);


const renderSidebar = (url = "/admin") => renderPage(<AdminSidebar />, { path: url });

// Floating = the stored preference says "not pinned"
const renderFloating = (url) => {
  localStorage.setItem("sidebarOpen", "false");
  return renderSidebar(url);
};

// Found through the ghost — the only aria-hidden <div> — which
// sits in the panel, which sits in the layout slot: the two
// boxes whose widths make the fly-over work
const ghost = () => document.querySelector('div[aria-hidden="true"]');
const panel = () => ghost().parentElement;
const slot = () => panel().parentElement;

// The ResizeObserver's report for the ghost: its width IS the
// widest label (the ghost itself is zero-height)
const measure = (labelWidth) => {
  act(() => {
    resizeObserved(ghost(), { width: labelWidth, height: 0 });
  });
};

const link = (label) => screen.getByRole("link", { name: label });
const row = (label) => link(label).querySelector("li");
const labelSpan = (label) => within(link(label)).getByText(label);
const pinButton = () => screen.getByRole("button", { name: /šoninį meniu$/ });

// The rows marked as the open page — by the row tint and by the
// brand-colored label; the two marks must name the same rows
const tintedRows = () =>
  screen.getAllByRole("link")
    .filter((anchor) => anchor.querySelector("li").classList.contains(ACTIVE_TINT))
    .map((anchor) => anchor.textContent);

const brandLabels = () =>
  screen.getAllByRole("link")
    .filter((anchor) => anchor.querySelector("span").classList.contains("text-primary"))
    .map((anchor) => anchor.textContent);







// -----------------------------------------------------------
// The links
// -----------------------------------------------------------

describe("AdminSidebar — the links", () => {

  it.each(INTERNAL_LINKS)("'%s' is a router link to %s inside the app", (label, href, icon) => {
    renderSidebar();

    expect(link(label)).toHaveAttribute("href", href);
    expect(link(label)).not.toHaveAttribute("target");
    expect(link(label)).not.toHaveAttribute("rel");
    expect(within(link(label)).getByTestId(icon)).toBeInTheDocument();
  });


  it.each(EXTERNAL_LINKS)("'%s' opens %s in a new tab", (label, href, icon) => {
    renderSidebar();

    expect(link(label)).toHaveAttribute("href", href);
    expect(link(label)).toHaveAttribute("target", "_blank");
    // The opened service gets no handle on the admin's tab
    expect(link(label)).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(link(label)).getByTestId(icon)).toBeInTheDocument();
  });


  it("lists exactly these 11 links, top to bottom", () => {
    renderSidebar();

    const anchors = screen.getAllByRole("link");
    expect(anchors.map((anchor) => anchor.textContent)).toEqual(ALL_LABELS);
    expect(anchors.map((anchor) => anchor.getAttribute("href"))).toEqual([
      "/admin", "/admin/students", "/admin/questions",
      "/slides", "/filebrowser/slides", "/leaderboard",
      "/admin/administrators", "/filebrowser/dropbox", "/swagger", "/dbgate", "/login",
    ]);
  });


  it("groups them under PAGRINDINIS, SĄRAŠAI, PREZENTACIJA and SISTEMA", () => {
    renderSidebar();

    const titles = screen.getAllByText(/^(PAGRINDINIS|SĄRAŠAI|PREZENTACIJA|SISTEMA)$/);
    expect(titles.map((title) => title.textContent)).toEqual(SECTION_TITLES);

    for (const [title, labels] of SECTIONS) {
      // title → its heading row → the section holding the links
      const section = screen.getByText(title).parentElement.parentElement;
      expect(within(section).getAllByRole("link").map((anchor) => anchor.textContent)).toEqual(labels);
    }
  });


  it.each(INTERNAL_LINKS.filter(([label]) => label !== "Atsijungti"))(
    "clicking '%s' opens %s without a page load",
    async (label, href) => {
      const { user, location } = renderSidebar("/admin/questions/7");

      await user.click(link(label));

      expect(location().pathname).toBe(href);
      expect(hardNavigations()).toEqual([]);
    }
  );


  it("'Atsijungti' moves to /login inside the app", async () => {
    const { user, location } = renderSidebar();

    await user.click(link("Atsijungti"));

    // No full page load needed: the login page ends the session
    // itself (POST /api/logout as it mounts)
    expect(location().pathname).toBe("/login");
    expect(screen.getByTestId("other-route")).toBeInTheDocument();
    expect(hardNavigations()).toEqual([]);
  });
});







// -----------------------------------------------------------
// The active row
// -----------------------------------------------------------

describe("AdminSidebar — the active row", () => {

  it.each([
    ["/admin", "Pradžia"],
    ["/admin/students", "Studentai"],
    ["/admin/students/5", "Studentai"],
    ["/admin/questions", "Klausimai"],
    ["/admin/questions/7", "Klausimai"],
    ["/admin/administrators", "Administratoriai"],
  ])("on %s only '%s' is lit (row tint + brand-colored label)", (url, label) => {
    renderSidebar(url);

    expect(tintedRows()).toEqual([label]);
    expect(brandLabels()).toEqual([label]);
  });


  it("paints every other label grey", () => {
    renderSidebar("/admin/students/5");

    for (const label of ALL_LABELS.filter((other) => other !== "Studentai")) {
      expect(labelSpan(label)).toHaveClass("text-[rgb(65,65,65)]");
      expect(labelSpan(label)).not.toHaveClass("text-primary");
    }
  });


  it.each(EXTERNAL_LINKS.map(([, href]) => href))(
    "never lights a new-tab row, not even on its own URL %s",
    (url) => {
      renderSidebar(url);

      expect(tintedRows()).toEqual([]);
      expect(brandLabels()).toEqual([]);
    }
  );


  it("nests on whole path segments only: /admin/studentsexport is not the students list", () => {
    renderSidebar("/admin/studentsexport");

    expect(tintedRows()).not.toContain("Studentai");
    expect(brandLabels()).not.toContain("Studentai");
  });
});







// -----------------------------------------------------------
// Pinned or floating
// -----------------------------------------------------------

describe("AdminSidebar — pinned or floating", () => {

  // The window width is read once, on mount — tests narrow the
  // window before mounting, and it is put back after each one
  const originalWidth = window.innerWidth;

  afterEach(() => {
    window.innerWidth = originalWidth;
  });


  it("starts pinned on a wide window with nothing stored: docked at the content width", () => {
    renderSidebar();
    measure(100);

    expect(pinButton()).toHaveAccessibleName("Atsegti šoninį meniu");
    expect(within(pinButton()).getByTestId("PushPinIcon")).toBeInTheDocument();
    expect(within(pinButton()).queryByTestId("PushPinOutlinedIcon")).toBeNull();
    expect(slot()).toHaveStyle({ width: "165.5px" });
    expect(panel()).toHaveStyle({ width: "165.5px" });
  });


  it("starts pinned when 'true' is stored", () => {
    localStorage.setItem("sidebarOpen", "true");
    renderSidebar();

    expect(pinButton()).toHaveAccessibleName("Atsegti šoninį meniu");
  });


  it("starts as the 52 px rail when 'false' is stored", () => {
    renderFloating();
    measure(100);

    expect(pinButton()).toHaveAccessibleName("Prisegti šoninį meniu");
    expect(within(pinButton()).getByTestId("PushPinOutlinedIcon")).toBeInTheDocument();
    expect(within(pinButton()).queryByTestId("PushPinIcon")).toBeNull();
    expect(slot()).toHaveStyle({ width: RAIL });
    expect(panel()).toHaveStyle({ width: RAIL });
  });


  it("starts as the rail on a window narrower than 768 px, even with 'true' stored", () => {
    window.innerWidth = 767;
    localStorage.setItem("sidebarOpen", "true");
    renderSidebar();

    expect(pinButton()).toHaveAccessibleName("Prisegti šoninį meniu");
    expect(slot()).toHaveStyle({ width: RAIL });
  });


  it("counts a window of exactly 768 px as wide", () => {
    window.innerWidth = 768;
    renderSidebar();

    expect(pinButton()).toHaveAccessibleName("Atsegti šoninį meniu");
  });


  it("undocks with the pin button (storing 'false') and docks again (storing 'true')", async () => {
    const { user } = renderSidebar();
    measure(100);

    await user.click(pinButton());

    expect(localStorage.getItem("sidebarOpen")).toBe("false");
    expect(pinButton()).toHaveAccessibleName("Prisegti šoninį meniu");
    expect(within(pinButton()).getByTestId("PushPinOutlinedIcon")).toBeInTheDocument();
    // The page gets its room back at once (the panel itself stays
    // out while the pointer is on it — see the fly-over tests)
    expect(slot()).toHaveStyle({ width: RAIL });

    await user.click(pinButton());

    expect(localStorage.getItem("sidebarOpen")).toBe("true");
    expect(pinButton()).toHaveAccessibleName("Atsegti šoninį meniu");
    expect(within(pinButton()).getByTestId("PushPinIcon")).toBeInTheDocument();
    expect(slot()).toHaveStyle({ width: "165.5px" });
  });


  it("starts in the stored state when mounted again — as on every page switch", async () => {
    const first = renderSidebar();
    await first.user.click(pinButton());
    first.unmount();

    renderSidebar("/admin/students");

    expect(pinButton()).toHaveAccessibleName("Prisegti šoninį meniu");
    expect(slot()).toHaveStyle({ width: RAIL });
  });


  it("can be pinned by hand on a narrow window, yet starts as the rail there next time", async () => {
    window.innerWidth = 500;
    const first = renderSidebar();
    measure(100);

    await first.user.click(pinButton());

    expect(localStorage.getItem("sidebarOpen")).toBe("true");
    expect(pinButton()).toHaveAccessibleName("Atsegti šoninį meniu");
    expect(slot()).toHaveStyle({ width: "165.5px" });

    first.unmount();
    renderSidebar();

    // A narrow window keeps its room for the page on every load
    expect(pinButton()).toHaveAccessibleName("Prisegti šoninį meniu");
    expect(slot()).toHaveStyle({ width: RAIL });
  });


  it("explains the pin button in a tooltip while docked: 'Atsegti šoninį meniu'", async () => {
    const { user } = renderSidebar();

    await user.hover(pinButton());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Atsegti šoninį meniu");
  });


  it("explains the pin button in a tooltip while floating: 'Prisegti šoninį meniu'", async () => {
    const { user } = renderFloating();

    await user.hover(pinButton());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Prisegti šoninį meniu");
  });
});







// -----------------------------------------------------------
// The rail and the expanded panel
// -----------------------------------------------------------

describe("AdminSidebar — the rail and the expanded panel", () => {

  it("on the rail, replaces the section titles with divider lines", () => {
    renderFloating();

    expect(screen.getAllByRole("separator")).toHaveLength(4);
    for (const title of SECTION_TITLES) {
      expect(screen.queryByText(title)).toBeNull();
    }
  });


  it("on the rail, keeps every label in its row but invisible", () => {
    renderFloating();

    for (const label of ALL_LABELS) {
      expect(labelSpan(label)).toHaveClass("opacity-0");
      expect(labelSpan(label)).not.toHaveClass("opacity-100");
    }
  });


  it("expanded, shows the section titles and the labels, without dividers", () => {
    renderSidebar();

    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    for (const title of SECTION_TITLES) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    for (const label of ALL_LABELS) {
      expect(labelSpan(label)).toHaveClass("opacity-100");
    }
  });


  it("on the rail, names the row under the pointer in a tooltip", async () => {
    renderFloating();

    // The pointer moves onto the row from elsewhere INSIDE the
    // panel, so only the row registers an enter. (A pointer from
    // outside enters the panel too, which flies out and shows the
    // labels instead — see the next test)
    fireEvent.mouseOut(panel(), { relatedTarget: row("Studentai") });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Studentai");
    expect(panel()).toHaveStyle({ width: RAIL });

    fireEvent.mouseOut(row("Studentai"), { relatedTarget: panel() });

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });


  it("a pointer arriving on a rail row flies the whole panel out instead: labels, no tooltip", async () => {
    renderFloating();
    measure(100);

    fireEvent.mouseEnter(row("Studentai"));

    expect(panel()).toHaveStyle({ width: "165.5px" });
    expect(labelSpan("Studentai")).toHaveClass("opacity-100");
    await settle();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });


  it("shows no tooltip over a row while docked open — the label is on screen", async () => {
    renderSidebar();

    fireEvent.mouseEnter(row("Studentai"));
    await settle();

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});







// -----------------------------------------------------------
// Fly-over on hover
// -----------------------------------------------------------

describe("AdminSidebar — fly-over on hover", () => {

  // The fold-back delay runs on setTimeout, faked on its own so
  // the tests step through it exactly — and therefore fireEvent
  // and synchronous queries only: RTL's waits and user-event need
  // the real setTimeout
  const useFakeTimeout = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });


  it("hovering the rail flies the panel out over the page, wider and shadowed — the slot keeps 52 px", () => {
    renderFloating();
    measure(100);

    fireEvent.mouseEnter(panel());

    expect(panel()).toHaveStyle({ width: "165.5px" });
    expect(panel()).toHaveClass(FLY_OVER_SHADOW);
    // The page next to the slot does not reflow
    expect(slot()).toHaveStyle({ width: RAIL });
    expect(screen.getByText("PAGRINDINIS")).toBeInTheDocument();
    expect(labelSpan("Pradžia")).toHaveClass("opacity-100");
  });


  it("folds back only 200 ms after the pointer leaves", async () => {
    useFakeTimeout();
    renderFloating();
    measure(100);

    fireEvent.mouseEnter(panel());
    fireEvent.mouseLeave(panel());

    await act(() => vi.advanceTimersByTimeAsync(199));
    expect(panel()).toHaveStyle({ width: "165.5px" });
    expect(panel()).toHaveClass(FLY_OVER_SHADOW);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(panel()).toHaveStyle({ width: RAIL });
    expect(panel()).not.toHaveClass(FLY_OVER_SHADOW);
    expect(labelSpan("Pradžia")).toHaveClass("opacity-0");
  });


  it("stays out when the pointer returns within 200 ms; the next leave starts a fresh 200 ms", async () => {
    useFakeTimeout();
    renderFloating();
    measure(100);

    fireEvent.mouseEnter(panel());
    fireEvent.mouseLeave(panel());
    await act(() => vi.advanceTimersByTimeAsync(150));
    fireEvent.mouseEnter(panel());
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(panel()).toHaveStyle({ width: "165.5px" });

    fireEvent.mouseLeave(panel());
    await act(() => vi.advanceTimersByTimeAsync(199));
    expect(panel()).toHaveStyle({ width: "165.5px" });

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(panel()).toHaveStyle({ width: RAIL });
  });


  it("hovering a docked sidebar changes nothing: same width, no fly-over shadow", () => {
    renderSidebar();
    measure(100);

    fireEvent.mouseEnter(panel());

    expect(slot()).toHaveStyle({ width: "165.5px" });
    expect(panel()).toHaveStyle({ width: "165.5px" });
    expect(panel()).not.toHaveClass(FLY_OVER_SHADOW);
  });


  it("undocked under the pointer, it gives the page its room at once but stays out until the pointer leaves", async () => {
    useFakeTimeout();
    renderSidebar();
    measure(100);

    fireEvent.mouseEnter(panel());
    fireEvent.click(pinButton());

    expect(slot()).toHaveStyle({ width: RAIL });
    expect(panel()).toHaveStyle({ width: "165.5px" });
    expect(panel()).toHaveClass(FLY_OVER_SHADOW);

    fireEvent.mouseLeave(panel());
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(panel()).toHaveStyle({ width: RAIL });
  });
});







// -----------------------------------------------------------
// Content-fit width
// -----------------------------------------------------------

describe("AdminSidebar — content-fit width", () => {

  it.each([
    [100, "165.5px"],
    [99.2, "165.5px"],
    [150.01, "216.5px"],
  ])("a widest label of %s px docks it at %s — rounded up, plus 65.5 px around the label", (labelWidth, width) => {
    renderSidebar();
    measure(labelWidth);

    expect(slot()).toHaveStyle({ width });
    expect(panel()).toHaveStyle({ width });
  });


  it.each([
    [1000, "400px"],
    [335, "400px"],
    [334, "399.5px"],
    [75, "140.5px"],
    [74, "140px"],
    [60, "140px"],
    [30, "140px"],
  ])("keeps it within 140–400 px: a %s px label gives %s", (labelWidth, width) => {
    renderSidebar();
    measure(labelWidth);

    expect(slot()).toHaveStyle({ width });
  });


  it.each([0, 10, 29.9])("ignores a %s px report — the ghost was not laid out yet", (tinyWidth) => {
    renderSidebar();
    measure(100);

    measure(tinyWidth);

    expect(slot()).toHaveStyle({ width: "165.5px" });
  });


  it("follows every later report — e.g. once the web font has swapped in", () => {
    renderSidebar();
    measure(100);

    measure(120);

    expect(slot()).toHaveStyle({ width: "185.5px" });
    expect(panel()).toHaveStyle({ width: "185.5px" });
  });


  it("keeps the rail at 52 px whatever the labels measure", () => {
    renderFloating();

    measure(300);

    expect(slot()).toHaveStyle({ width: RAIL });
    expect(panel()).toHaveStyle({ width: RAIL });
  });


  it("starts a sidebar mounted later at the width measured last — no resize on every page switch", () => {
    const first = renderSidebar();
    measure(150);
    first.unmount();

    renderSidebar("/admin/students");

    // Nothing has measured THIS sidebar's ghost yet
    expect(slot()).toHaveStyle({ width: "215.5px" });
  });


  it("measures every label: the invisible ghost copy lists all 11", () => {
    renderSidebar();

    expect([...ghost().children].map((copy) => copy.textContent)).toEqual(ALL_LABELS);
  });


  it("measures in the labels' own typography", () => {
    renderSidebar();

    // A ghost set in another size or weight would report a width
    // that fits no real label
    expect(ghost()).toHaveClass("text-[13px]", "font-semibold", "whitespace-nowrap", "w-max");
    for (const label of ALL_LABELS) {
      expect(labelSpan(label)).toHaveClass("text-[13px]", "font-semibold");
    }
  });
});
