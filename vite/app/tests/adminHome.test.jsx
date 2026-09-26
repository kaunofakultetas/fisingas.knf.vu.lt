// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the admin dashboard (Home)
//
//  src/systemPages/AdminPages/Home/Home.jsx inside its
//  AdminPageLayout (Navbar, Sidebar, the grey #EBECEF content
//  area and the layout's own <Toaster/>):
//    - GET /api/admin/home (withCredentials) on mount, then
//      every 2 s until unmount; NOTHING is rendered — not even
//      the frame — before the first reply. A failing later
//      poll keeps the last dashboard; a 401 is a full page
//      load of /login
//    - "Studentų" = studentscount, "Klausimai" =
//      "enabledquestionscount/totalquestionscount"; their
//      icons are router links to /admin/students and
//      /admin/questions; "Testą Sprendžia:" shows the live
//      progress bars
//    - "Testo dydis", the test-size picker: 9, 12, 15, 21 or
//      30 questions, opening on the size of the first reply.
//      A pick shows at once and is saved at once with
//      POST /api/admin/update/phishingtestsize
//      {"phishingtestsize": "21"} — the size as a STRING —
//      and toasted "Išsaugota" / "Nepavyko išsaugoti"
//
//  The page's known bugs stay in knownBugs.test.jsx, and every
//  test here holds before AND after their fixes:
//    - KB-11 a failed FIRST poll — every test here gets a good
//      first reply, or a 401
//    - KB-33 a never-saved size (null) leaves the picker blank
//    - KB-34 the picker ignores the sizes later polls report
//      and keeps a pick whose save failed — so nothing here
//      pins what it shows once a save has landed, until a
//      poll reports the saved size
//    - KB-36 a save refused with 401 reads as a failure
//      instead of sending the admin to /login
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { allowConsoleError } from "./support/setup";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { hardNavigations } from "./support/navigation";
import * as fx from "./support/fixtures";

import Home from "@/systemPages/AdminPages/Home/Home";


const HOME = "/api/admin/home";
const TEST_SIZE = "/api/admin/update/phishingtestsize";

// The success reply of POST /api/admin/update/phishingtestsize
// (StatusOk)
const SAVED = reply.json({ status: "ok" });

const ACTIVE_TINT = "bg-[rgba(var(--mui-palette-primary-mainChannel)/0.20)]";


// On real timers; resolves once the first reply is on screen
const renderDashboard = async (dashboard = fx.dashboard()) => {
  backend.on("GET", HOME, reply.json(dashboard));
  const result = renderPage(<Home />, { path: "/admin" });
  await screen.findByText("Studentų");
  return result;
};

// The polling tests fake ONLY the interval: the fake backend
// answers on promises and React Testing Library keeps its real
// setTimeout
const useFakeInterval = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

const mountPolling = async (dashboard = fx.dashboard()) => {
  useFakeInterval();
  backend.on("GET", HOME, reply.json(dashboard));
  const result = renderPage(<Home />, { path: "/admin" });
  await settle();
  return result;
};

const nextPoll = async () => {
  await act(() => vi.advanceTimersByTimeAsync(2000));
  await settle();
};

const homeRequests = () => backend.requests("GET", HOME);

// The page content next to the sidebar — which repeats
// "Klausimai", so widget lookups stay inside the content
const content = () => screen.getByText("Studentų").closest(".overflow-auto");

// A widget card by its label (label → its column → the card),
// and the big number right under the label
const widget = (label) => within(content()).getByText(label).parentElement.parentElement;
const countOf = (label) => within(content()).getByText(label).nextElementSibling.textContent;

const progressCard = () => screen.getByText("Testą Sprendžia:").parentElement;

const picker = () => screen.getByRole("combobox");

// A closing menu lingers for its exit transition — wait it out,
// so the next query or pick never meets two menus
const pickSize = async (user, option) => {
  await user.click(picker());
  await user.click(screen.getByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};

// The sidebar's layout slot: its label-measuring ghost is the
// only aria-hidden <div> on the page (ghost → panel → slot)
const sidebarSlot = (container) => container.querySelector('div[aria-hidden="true"]').parentElement.parentElement;

// jsdom versions spell a CSS color differently (#ebecef or
// rgb(…)) — spell the expected one the way the page's is
const cssColor = (value) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = value;
  return probe.style.backgroundColor;
};







// -----------------------------------------------------------
// The first load
// -----------------------------------------------------------

describe("Home — the first load", () => {

  it("asks GET /api/admin/home once, with the session cookie — and nothing else", async () => {
    await mountPolling();

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: HOME, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("renders nothing — not even the navbar or the sidebar — until the first reply", async () => {
    useFakeInterval();
    const first = deferred();
    backend.on("GET", HOME, () => first.promise);
    const { container } = renderPage(<Home />, { path: "/admin" });
    await settle();

    expect(container).toBeEmptyDOMElement();

    await act(async () => first.resolve(reply.json(fx.dashboard())));
    await settle();

    expect(screen.getByText("Studentų")).toBeInTheDocument();
    expect(screen.getByAltText("VU logotipas")).toBeInTheDocument();
  });


  it("sends an expired session (401) to /login with a full page load, showing nothing", async () => {
    useFakeInterval();
    backend.on("GET", HOME, reply.status(401, "Unauthorized"));
    const { container } = renderPage(<Home />, { path: "/admin" });
    await settle();

    // Only the target is pinned, not the count — the 401
    // interceptor KB-21 / KB-36 suggest may redirect on top of
    // the hook's own redirect. (No waitFor: with setInterval
    // faked it re-checks on DOM changes only, and a hard
    // navigation is none — settle() has drained the reply)
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(container).toBeEmptyDOMElement();
  });


  it("drops a reply that arrives after the admin has left the page", async () => {
    useFakeInterval();
    const first = deferred();
    backend.on("GET", HOME, () => first.promise);
    const { unmount } = renderPage(<Home />, { path: "/admin" });
    await settle();
    unmount();

    await act(async () => first.resolve(reply.json(fx.dashboard())));
    await settle();

    // The late state update must stay silent — setup.js fails the
    // test on any React error it would log
    expect(screen.queryByText("Studentų")).toBeNull();
  });
});







// -----------------------------------------------------------
// Polling
// -----------------------------------------------------------

describe("Home — polling every 2 s", () => {

  it("asks again every 2 seconds, each time with the session cookie", async () => {
    await mountPolling();
    expect(homeRequests()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(homeRequests()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(homeRequests()).toHaveLength(2);

    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(homeRequests()).toHaveLength(4);
    expect(homeRequests().every((request) => request.withCredentials === true)).toBe(true);
  });


  it("shows the fresh numbers of every poll", async () => {
    await mountPolling(fx.dashboard({
      studentscount: 41,
      enabledquestionscount: 18,
      totalquestionscount: 20,
      studentsprogress: [fx.progressEntry({ answeredquestioncount: 6, questioncount: 12 })],
    }));

    expect(countOf("Studentų")).toBe("41");
    expect(countOf("Klausimai")).toBe("18/20");
    expect(within(progressCard()).getByText("6 / 12")).toBeInTheDocument();

    backend.on("GET", HOME, reply.json(fx.dashboard({
      studentscount: 42,
      enabledquestionscount: 19,
      totalquestionscount: 21,
      studentsprogress: [fx.progressEntry({ answeredquestioncount: 12, questioncount: 12, isfinished: 1 })],
    })));
    await nextPoll();

    expect(countOf("Studentų")).toBe("42");
    expect(countOf("Klausimai")).toBe("19/21");
    expect(within(progressCard()).getByText("(TESTAS BAIGTAS)")).toBeInTheDocument();
    expect(within(progressCard()).queryByText("6 / 12")).toBeNull();
  });


  it("stops once the page is unmounted", async () => {
    const { unmount } = await mountPolling();

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));

    expect(homeRequests()).toHaveLength(1);
  });


  it("stops once the admin moves on to another page", async () => {
    const { location } = await mountPolling();

    fireEvent.click(screen.getByTestId("PeopleOutlinedIcon"));
    expect(location().pathname).toBe("/admin/students");

    await act(() => vi.advanceTimersByTimeAsync(10000));

    expect(homeRequests()).toHaveLength(1);
  });


  it.each([
    ["a server error", reply.status(500, "Internal Server Error")],
    ["a network failure", reply.networkError()],
  ])("keeps the last dashboard through %s and takes the next good poll", async (_, failure) => {
    await mountPolling(fx.dashboard({ studentscount: 42 }));

    backend.once("GET", HOME, failure);
    await nextPoll();

    expect(homeRequests()).toHaveLength(2);
    expect(countOf("Studentų")).toBe("42");
    expect(countOf("Klausimai")).toBe("18/20");
    expect(picker()).toHaveTextContent("12 klausimų");

    backend.on("GET", HOME, reply.json(fx.dashboard({ studentscount: 43 })));
    await nextPoll();

    expect(countOf("Studentų")).toBe("43");
  });


  it("sends the admin to /login (full page load) when a later poll finds the session expired", async () => {
    await mountPolling();

    backend.once("GET", HOME, reply.status(401, "Unauthorized"));
    await nextPoll();

    // The target, not the count (see the first-load 401 test)
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
  });
});







// -----------------------------------------------------------
// The admin layout
// -----------------------------------------------------------

describe("Home — the admin layout", () => {

  it("frames the dashboard: the navbar, the sidebar docked open with 'Pradžia' lit, the grey content area", async () => {
    const { container } = await renderDashboard();

    expect(screen.getByAltText("VU logotipas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Pradžia" }).querySelector("li")).toHaveClass(ACTIVE_TINT);
    expect(screen.getByRole("button", { name: "Atsegti šoninį meniu" })).toBeInTheDocument();

    const slot = sidebarSlot(container);
    // jsdom lays nothing out and no test in this file reports a
    // label size, so the docked sidebar keeps its first-frame
    // default width
    expect(slot).toHaveStyle({ width: "210px" });
    expect(slot.nextElementSibling).toBe(content());

    expect(content().style.backgroundColor).toBe(cssColor("#EBECEF"));
  });
});







// -----------------------------------------------------------
// The widgets
// -----------------------------------------------------------

describe("Home — the widgets", () => {

  it("'Studentų' shows how many students are registered", async () => {
    await renderDashboard(fx.dashboard({ studentscount: 42 }));

    expect(countOf("Studentų")).toBe("42");
  });


  it("'Studentų' shows no students as 0, not as an empty card", async () => {
    await renderDashboard(fx.dashboard({ studentscount: 0 }));

    expect(countOf("Studentų")).toBe("0");
  });


  it.each([
    [18, 20, "18/20"],
    [0, 20, "0/20"],
    [0, 0, "0/0"],
  ])("'Klausimai' shows %i enabled of %i questions as '%s'", async (enabled, total, text) => {
    await renderDashboard(fx.dashboard({ enabledquestionscount: enabled, totalquestionscount: total }));

    expect(countOf("Klausimai")).toBe(text);
  });


  it.each([
    ["Studentų", "/admin/students", "PeopleOutlinedIcon"],
    ["Klausimai", "/admin/questions", "QuestionMarkOutlinedIcon"],
  ])("the '%s' icon opens %s without a page load", async (label, href, icon) => {
    const { user, location } = await renderDashboard();
    const iconElement = within(widget(label)).getByTestId(icon);

    expect(iconElement.closest("a")).toHaveAttribute("href", href);

    await user.click(iconElement);

    expect(location().pathname).toBe(href);
    expect(hardNavigations()).toEqual([]);
  });


  it("lists everyone taking the test under 'Testą Sprendžia:', a bar each", async () => {
    await renderDashboard(fx.dashboard({
      studentsprogress: [
        fx.progressEntry({ studentid: 5, username: "VARDENĖ_PAVARDENĖ", answeredquestioncount: 3, questioncount: 12 }),
        fx.progressEntry({ studentid: 6, username: "ŽYDRŪNAS_ČIURLIONIS", answeredquestioncount: 12, questioncount: 12, isfinished: 1 }),
      ],
    }));

    const card = progressCard();
    expect(within(card).getByText("VARDENĖ_PAVARDENĖ:")).toBeInTheDocument();
    expect(within(card).getByText("3 / 12")).toBeInTheDocument();
    expect(within(card).getByText("ŽYDRŪNAS_ČIURLIONIS:")).toBeInTheDocument();
    expect(within(card).getByText("(TESTAS BAIGTAS)")).toBeInTheDocument();
    expect(within(card).getAllByRole("progressbar").map((bar) => bar.getAttribute("aria-valuenow"))).toEqual(["25", "100"]);
  });


  it("says nobody is taking the test when no student is active", async () => {
    await renderDashboard(fx.dashboard({ studentsprogress: [] }));

    expect(within(progressCard()).getByText("Šiuo metu testo nesprendžia nei vienas studentas")).toBeInTheDocument();
    expect(within(progressCard()).queryByRole("progressbar")).toBeNull();
  });
});







// -----------------------------------------------------------
// The test-size picker
// -----------------------------------------------------------

describe("Home — the test-size picker", () => {

  it("sits in the 'Klausimai' widget, under 'Testo dydis'", async () => {
    await renderDashboard();

    const card = widget("Klausimai");
    expect(within(card).getByText("Testo dydis")).toBeInTheDocument();
    expect(within(card).getByRole("combobox")).toBe(picker());
  });


  it.each([
    [9, "9 klausimų"],
    [12, "12 klausimų"],
    [15, "15 klausimų"],
    [21, "21 klausimų"],
    [30, "30 klausimų"],
  ])("shows a saved size of %i as '%s'", async (size, text) => {
    await renderDashboard(fx.dashboard({ phishingtestsize: size }));

    expect(picker().textContent).toBe(text);
  });


  it("offers 9, 12, 15, 21 and 30 questions, the saved size selected", async () => {
    const { user } = await renderDashboard(fx.dashboard({ phishingtestsize: 15 }));

    await user.click(picker());

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "9 klausimų", "12 klausimų", "15 klausimų", "21 klausimų", "30 klausimų",
    ]);
    // String values — what a pick posts (see the next test)
    expect(options.map((option) => option.getAttribute("data-value"))).toEqual(["9", "12", "15", "21", "30"]);
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "false", "false"]);
  });


  it("saves a pick at once — POST {phishingtestsize: \"21\"} with the session cookie — and says 'Išsaugota'", async () => {
    backend.on("POST", TEST_SIZE, SAVED);
    const { user } = await renderDashboard();

    await pickSize(user, "21 klausimų");
    await findToast("Išsaugota");

    const saves = backend.requests("POST", TEST_SIZE);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ client: "axios", url: TEST_SIZE, withCredentials: true });
    expect(saves[0].headers["content-type"]).toMatch(/^application\/json/);
    // The menu's values are strings and go out as picked; the
    // backend coerces them with int(), so "21" is how a size
    // travels — not 21
    expect(saves[0].json).toEqual({ phishingtestsize: "21" });

    // Exactly one toast: the layout's own Toaster is the only one.
    // (The picker is not checked here: once the save has landed,
    // a picker driven by the polled size — the KB-34 fix — shows
    // the stored size until a poll reports the new one; see
    // "keeps showing a saved pick once the polls report it")
    expect(toastTexts()).toEqual(["Išsaugota"]);
  });


  it("shows the pick at once, and says 'Išsaugota' only when the save has landed", async () => {
    const save = deferred();
    backend.on("POST", TEST_SIZE, () => save.promise);
    const { user } = await renderDashboard();

    await pickSize(user, "21 klausimų");

    expect(picker()).toHaveTextContent("21 klausimų");
    expect(backend.requests("POST", TEST_SIZE)).toHaveLength(1);
    expect(toastTexts()).toEqual([]);

    await act(async () => save.resolve(SAVED));

    await findToast("Išsaugota");
  });


  it("saves every pick, in order", async () => {
    backend.on("POST", TEST_SIZE, SAVED);
    const { user } = await renderDashboard();

    await pickSize(user, "21 klausimų");
    await pickSize(user, "9 klausimų");

    await waitFor(() => expect(toastTexts()).toEqual(["Išsaugota", "Išsaugota"]));
    expect(backend.requests("POST", TEST_SIZE).map((request) => request.json)).toEqual([
      { phishingtestsize: "21" },
      { phishingtestsize: "9" },
    ]);
  });


  it("sends nothing when the size already shown is picked again", async () => {
    const { user } = await renderDashboard(fx.dashboard({ phishingtestsize: 12 }));

    await pickSize(user, "12 klausimų");
    await settle();

    expect(backend.requests("POST", TEST_SIZE)).toHaveLength(0);
    expect(toastTexts()).toEqual([]);
    expect(picker()).toHaveTextContent("12 klausimų");
  });


  // A 401 is left out: toasting it is known bug KB-36 (the fix
  // sends the admin to /login) — see the next test
  it.each([
    ["refused to a non-admin (403 'Error: Not Admin')", reply.text("Error: Not Admin", 403)],
    ["refused as malformed (400)", reply.text("Error: Invalid request body", 400)],
    ["hit by a server error (500)", reply.status(500, "Internal Server Error")],
    ["lost on the network", reply.networkError()],
  ])("says 'Nepavyko išsaugoti' when the save is %s", async (_, failure) => {
    backend.on("POST", TEST_SIZE, failure);
    const { user } = await renderDashboard();

    await pickSize(user, "21 klausimų");

    await findToast("Nepavyko išsaugoti");
    expect(toastTexts()).toEqual(["Nepavyko išsaugoti"]);
    expect(backend.lastRequest("POST", TEST_SIZE).json).toEqual({ phishingtestsize: "21" });
  });


  // What a 401 SHOULD do is KB-36's business (today a
  // "Nepavyko išsaugoti" toast, after the fix a full page load
  // of /login) — only what holds either way is pinned
  it("never says 'Išsaugota' when the save is refused to an expired session (401)", async () => {
    backend.on("POST", TEST_SIZE, reply.status(401, "Unauthorized"));
    const { user } = await renderDashboard();

    await pickSize(user, "21 klausimų");
    await settle();

    expect(backend.lastRequest("POST", TEST_SIZE).json).toEqual({ phishingtestsize: "21" });
    expect(toastTexts()).not.toContain("Išsaugota");
  });


  it("lets a size be picked and saved when none was ever saved (null)", async () => {
    backend.on("POST", TEST_SIZE, SAVED);
    const { user } = await renderDashboard(fx.dashboard({ phishingtestsize: null }));

    await pickSize(user, "15 klausimų");

    await findToast("Išsaugota");
    expect(backend.lastRequest("POST", TEST_SIZE).json).toEqual({ phishingtestsize: "15" });
  });


  // Holds for today's uncontrolled picker and for one driven by
  // the polled size (the fix KB-34 suggests) alike: once the
  // backend reports the saved size, that size is on screen.
  // Only the poll interval is faked — user-event and findToast
  // keep the real setTimeout
  it("keeps showing a saved pick once the polls report it", async () => {
    // Today's uncontrolled picker makes MUI's development build
    // complain when a poll brings a size the page did not open
    // with — exactly what the poll below does
    allowConsoleError(/changing the default value state of an uncontrolled Select/);
    backend.on("POST", TEST_SIZE, SAVED);
    const { user } = await mountPolling(fx.dashboard({ phishingtestsize: 12, studentscount: 42 }));

    await pickSize(user, "21 klausimų");
    await findToast("Išsaugota");
    expect(backend.lastRequest("POST", TEST_SIZE).json).toEqual({ phishingtestsize: "21" });

    backend.on("GET", HOME, reply.json(fx.dashboard({ phishingtestsize: 21, studentscount: 43 })));
    await nextPoll();

    // The poll landed …
    expect(countOf("Studentų")).toBe("43");
    // … and the picker shows the size that was saved
    expect(picker()).toHaveTextContent("21 klausimų");
  });
});
