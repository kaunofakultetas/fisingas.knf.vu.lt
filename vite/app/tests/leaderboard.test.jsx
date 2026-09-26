// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the public leaderboard
//
//  src/systemPages/PublicPages/Leaderboard/Leaderboard.jsx +
//  LeaderboardTable.jsx — the projector view of /leaderboard
//  (also shown by /slides); public, no session:
//    - the frame: the VU KnF logo → "/", the "Apsilankyk:
//      https://fisingas.knf.vu.lt" badge, the title, the
//      column headers, the footer
//    - GET /api/leaderboard through useFetchData — axios with
//      withCredentials: true although the endpoint is public;
//      "Kraunama..." until the first reply, and no empty-state
//      message meanwhile
//    - the countdown "Atnaujinimas po: Ns": 5 → 1 once a
//      second, then a refetch and 5 again; the rows stay (no
//      loading flash) while a refresh runs, the last good
//      standings survive a failed one, it all stops on unmount
//    - ranking by testgrade DESCENDING, compared as numbers
//      although the API sends strings ("10.00" > "9.50" >
//      "2.00"; "" counts as 0); gold / silver / bronze badges
//      for places 1–3, plain numbers after
//    - the bar: finished → full burgundy "Įvertinimas: X";
//      running → blue "answered / total", round(a / q × 100)%
//    - last seen in Vilnius wall time ("YYYY-MM-DD HH:MM:SS")
//    - only students seen within the last day (exactly 24 h
//      ago still counts, null never does); "Rodyti Visus"
//      lifts that; "Šiuo metu dalyvių nėra" when nobody is left
//
//  Time: wherever rows are shown "now" is pinned with a fake
//  Date (the fixtures' default lastseen is then under an hour
//  old). The countdown tests fake setInterval too and drive it
//  with advance() — synchronous queries and fireEvent there,
//  because React Testing Library's waitFor polls with
//  setInterval.
//
//  A RUNNING row of a student without a dealt test prints
//  "null / " — that is KB-01 in knownBugs.test.jsx; running
//  rows here always carry a numeric answeredquestioncount.
//  Also in the ledger, and so left open here: what a failed
//  FIRST load shows (the empty-state message, KB-23), and
//  refreshes that overlap when the backend is slower than 5 s
//  (KB-24).
// -----------------------------------------------------------

import "./support/setup";

import { beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { renderPage } from "./support/render";
import * as fx from "./support/fixtures";

import LeaderboardPage from "@/systemPages/PublicPages/Leaderboard/Leaderboard";


const LEADERBOARD = "/api/leaderboard";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "Now" wherever rows are shown: 2026-08-26 20:00 in Vilnius.
// Far from any DST switch — the table steps "one day back" as a
// calendar day in the local zone, which is exactly 24 h here
const NOW = new Date("2026-08-26T20:00:00+03:00");


// Date only — React Testing Library's waits and user-event keep
// their real timers (the countdown's real 1 s interval is far
// slower than these tests)
const pinNow = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
};

// Date AND the countdown's interval: time moves only through
// advance(), ONE act() around the fake clock. The fake
// backend's replies settle between the ticks, but React
// applies all the ticks' state updates (the countdown's
// refetch() runs inside one of them) in a single render once
// the advance is over — a refresh due within an advance has
// gone out (and, unless the test holds its reply, been
// answered) when it returns
const pinNowAndCountdown = () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
};

const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));


// A lastseen `ms` before the pinned "now", as the API writes it
const seenAgo = (ms) => fx.apiTimestamp(new Date(Date.now() - ms));


// The /leaderboard page, the API answering `entries` every time
const renderBoard = (entries) => {
  backend.on("GET", LEADERBOARD, reply.json(entries));
  return renderPage(<LeaderboardPage />, { path: "/leaderboard" });
};


// The student rows, top to bottom — the empty-state row (one
// cell spanning the table) is not one of them
const studentRows = () => [...document.querySelectorAll("tbody tr")].filter((row) => row.cells.length === 4);

const shownNames = () => studentRows().map((row) => row.cells[1].textContent);

const rowOf = (username) => studentRows().find((row) => row.cells[1].textContent === username);

// A row's cells: place badge | name | bar | last seen
const rankBadge = (row) => row.cells[0].firstElementChild;
const bar = (row) => row.cells[2].querySelector(".transition-\\[width\\]");
const barText = (row) => row.cells[2].textContent;
const lastSeenText = (row) => row.cells[3].textContent;

const showAllBox = () => screen.getByRole("checkbox", { name: "Rodyti Visus" });







// -----------------------------------------------------------
// The page frame
// -----------------------------------------------------------

describe("Leaderboard page — the frame around the table", () => {

  // An empty leaderboard: the frame depends neither on the
  // rows nor on the clock
  const renderEmptyPage = async () => {
    const result = renderBoard([]);
    await screen.findByText("Šiuo metu dalyvių nėra");
    return result;
  };


  it("shows the VU KnF logo, linked to the home route", async () => {
    await renderEmptyPage();

    const logo = screen.getByAltText("VU KnF logotipas");
    expect(logo).toHaveAttribute("src", "/img/vuknflogowithbackground.png");
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });


  it("goes home (client-side) when the logo is clicked", async () => {
    const { user, location } = await renderEmptyPage();

    await user.click(screen.getByAltText("VU KnF logotipas"));

    expect(location().pathname).toBe("/");
    expect(screen.getByTestId("other-route")).toBeInTheDocument();
  });


  it("invites the room with the 'Apsilankyk: https://fisingas.knf.vu.lt' badge", async () => {
    await renderEmptyPage();

    expect(screen.getByText("Apsilankyk: https://fisingas.knf.vu.lt")).toBeInTheDocument();
  });


  it("titles the table 'Fišingo Atakų Atpažinimo Lyderiai'", async () => {
    await renderEmptyPage();

    expect(screen.getByRole("heading", { level: 2, name: "Fišingo Atakų Atpažinimo Lyderiai" })).toBeInTheDocument();
  });


  it("labels the columns: place, name, grade / progress, last seen", async () => {
    await renderEmptyPage();

    const headers = [...document.querySelectorAll("thead th")].map((header) => header.textContent);
    expect(headers).toEqual(["Vieta", "Vardas", "Įvertinimas / Progresas", "Paskutinįkart Pastebėtas"]);
  });


  it("offers 'Rodyti Visus' unticked — recent students only by default", async () => {
    await renderEmptyPage();

    expect(showAllBox()).not.toBeChecked();
  });


  it("ends with the copyright footer", async () => {
    await renderEmptyPage();

    expect(screen.getByText("Copyright © | All Rights Reserved | VUKnF")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Loading GET /api/leaderboard
// -----------------------------------------------------------

describe("Leaderboard — loading GET /api/leaderboard", () => {

  beforeEach(pinNowAndCountdown);


  it("asks GET /api/leaderboard once through axios, withCredentials although public — and nothing else", async () => {
    renderBoard([fx.leaderboardEntry()]);
    await advance(0);

    // No session check either: the projector runs logged out
    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: LEADERBOARD, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("shows 'Kraunama...' — no rows, no empty-state message — until the reply arrives", async () => {
    const first = deferred();
    backend.on("GET", LEADERBOARD, () => first.promise);
    renderPage(<LeaderboardPage />, { path: "/leaderboard" });
    await advance(0);

    expect(screen.getByText("Kraunama...")).toBeInTheDocument();
    expect(screen.queryByText(/Atnaujinimas po/)).toBeNull();
    expect(screen.queryByText("Šiuo metu dalyvių nėra")).toBeNull();
    expect(studentRows()).toHaveLength(0);

    await act(async () => first.resolve(reply.json([fx.leaderboardEntry()])));
    await advance(0);

    expect(screen.queryByText("Kraunama...")).toBeNull();
    expect(screen.getByText("Atnaujinimas po: 5s")).toBeInTheDocument();
    expect(shownNames()).toEqual(["JONAS_JONAITIS"]);
  });


  it("stays quiet when the page is left before the first reply arrives", async () => {
    const first = deferred();
    backend.on("GET", LEADERBOARD, () => first.promise);
    const { unmount } = renderPage(<LeaderboardPage />, { path: "/leaderboard" });
    await advance(0);

    unmount();
    await act(async () => first.resolve(reply.json([fx.leaderboardEntry()])));
    await advance(10000);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(1);
    expect(screen.queryByText("JONAS_JONAITIS")).toBeNull();
  });
});







// -----------------------------------------------------------
// The refresh countdown
// -----------------------------------------------------------

describe("Leaderboard — the refresh countdown", () => {

  beforeEach(pinNowAndCountdown);

  // The page with its first reply rendered
  const renderLoaded = async (entries = [fx.leaderboardEntry()]) => {
    const result = renderBoard(entries);
    await advance(0);
    return result;
  };


  it("reads 'Atnaujinimas po: 5s' when the standings come in at once", async () => {
    await renderLoaded();

    // The countdown runs from mount, behind "Kraunama..." until
    // the first reply — a prompt reply finds it still at 5
    expect(screen.getByText("Atnaujinimas po: 5s")).toBeInTheDocument();
  });


  it("ticks down once per second", async () => {
    await renderLoaded();

    await advance(1000);
    expect(screen.getByText("Atnaujinimas po: 4s")).toBeInTheDocument();

    await advance(999);
    expect(screen.getByText("Atnaujinimas po: 4s")).toBeInTheDocument();

    await advance(1);
    expect(screen.getByText("Atnaujinimas po: 3s")).toBeInTheDocument();

    await advance(2000);
    expect(screen.getByText("Atnaujinimas po: 1s")).toBeInTheDocument();
  });


  it("does not refetch before the countdown runs out", async () => {
    await renderLoaded();

    await advance(4999);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(1);
    expect(screen.getByText("Atnaujinimas po: 1s")).toBeInTheDocument();
  });


  it("refetches when it runs out and starts again at 5 s", async () => {
    await renderLoaded();
    await advance(4999);

    await advance(1);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(2);
    expect(screen.getByText("Atnaujinimas po: 5s")).toBeInTheDocument();
    expect(screen.queryByText("Atnaujinimas po: 0s")).toBeNull();
  });


  it("refetches with the same request: GET through axios, withCredentials", async () => {
    await renderLoaded();

    await advance(5000);

    const requests = backend.requests();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ client: "axios", method: "GET", url: LEADERBOARD, withCredentials: true });
    expect(requests[1].body).toBeUndefined();
  });


  it("keeps refreshing every 5 s", async () => {
    await renderLoaded();

    // Cycle by cycle, like the real clock: each refresh is
    // answered before the next one starts (one long jump would
    // let React run the ticks' updates in a single render and
    // fire those refreshes all at once)
    await advance(5000);
    await advance(5000);
    await advance(5000);
    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(4);
    expect(screen.getByText("Atnaujinimas po: 5s")).toBeInTheDocument();

    await advance(5000);
    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(5);
  });


  it("replaces the rows with the refreshed standings", async () => {
    await renderLoaded([
      fx.leaderboardEntry({ id: 1, username: "PIRMAS", testgrade: "9.00" }),
      fx.leaderboardEntry({ id: 2, username: "ANTRAS", testgrade: "8.00" }),
    ]);
    expect(shownNames()).toEqual(["PIRMAS", "ANTRAS"]);

    backend.on("GET", LEADERBOARD, reply.json([
      fx.leaderboardEntry({ id: 2, username: "ANTRAS", testgrade: "9.50" }),
      fx.leaderboardEntry({ id: 3, username: "TREČIAS", testgrade: "7.00" }),
    ]));
    await advance(5000);

    expect(shownNames()).toEqual(["ANTRAS", "TREČIAS"]);
    expect(barText(rowOf("ANTRAS"))).toBe("Įvertinimas: 9.50");
  });


  it("keeps the standings and the countdown on screen while a refresh is in flight", async () => {
    await renderLoaded([fx.leaderboardEntry({ id: 1, username: "PIRMAS" })]);
    const slowRefresh = deferred();
    backend.once("GET", LEADERBOARD, () => slowRefresh.promise);

    // The refresh due at 5 s is still unanswered at 7 s (whether
    // the countdown runs on meanwhile is left open — that is how
    // refreshes overlap, KB-24)
    await advance(7000);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(2);
    expect(screen.queryByText("Kraunama...")).toBeNull();
    expect(screen.getByText(/^Atnaujinimas po: \ds$/)).toBeInTheDocument();
    expect(shownNames()).toEqual(["PIRMAS"]);

    await act(async () => slowRefresh.resolve(reply.json([fx.leaderboardEntry({ id: 2, username: "ANTRAS" })])));
    await advance(0);

    expect(shownNames()).toEqual(["ANTRAS"]);
  });


  it.each([
    ["a server error (500)", reply.status(500, "Internal Server Error")],
    ["a lost connection", reply.networkError()],
  ])("keeps the last standings when a refresh fails with %s, and takes the next good one", async (_, failure) => {
    await renderLoaded([fx.leaderboardEntry({ id: 1, username: "PIRMAS" })]);

    backend.once("GET", LEADERBOARD, failure);
    await advance(5000);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(2);
    expect(shownNames()).toEqual(["PIRMAS"]);

    backend.on("GET", LEADERBOARD, reply.json([fx.leaderboardEntry({ id: 2, username: "ANTRAS" })]));
    await advance(5000);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(3);
    expect(shownNames()).toEqual(["ANTRAS"]);
  });


  it("retries a failed first load when the countdown runs out", async () => {
    backend.once("GET", LEADERBOARD, reply.status(502, "Bad Gateway"));
    await renderLoaded([fx.leaderboardEntry()]);

    // What the page shows for the failed load itself is a known
    // bug (KB-23: the empty-state message) — only the recovery
    // is pinned here
    expect(studentRows()).toHaveLength(0);

    await advance(5000);

    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(2);
    expect(shownNames()).toEqual(["JONAS_JONAITIS"]);
  });


  it("filters on the spot when 'Rodyti Visus' is toggled — no request, and the countdown keeps its pace", async () => {
    await renderLoaded([
      fx.leaderboardEntry({ id: 1, username: "ŠIANDIEN", testgrade: "5.00", lastseen: seenAgo(HOUR) }),
      fx.leaderboardEntry({ id: 2, username: "UŽVAKAR", testgrade: "9.00", lastseen: seenAgo(2 * DAY) }),
    ]);
    await advance(2000);
    expect(shownNames()).toEqual(["ŠIANDIEN"]);

    fireEvent.click(showAllBox());

    expect(shownNames()).toEqual(["UŽVAKAR", "ŠIANDIEN"]);
    expect(screen.getByText("Atnaujinimas po: 3s")).toBeInTheDocument();
    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(1);

    // The choice outlives the next refresh
    await advance(3000);
    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(2);
    expect(shownNames()).toEqual(["UŽVAKAR", "ŠIANDIEN"]);
  });


  it("drops a student as soon as their last visit is over a day old — without waiting for a refresh", async () => {
    await renderLoaded([
      fx.leaderboardEntry({ id: 1, username: "BEVEIK_PARA", testgrade: "9.00", lastseen: seenAgo(DAY - 2 * SECOND) }),
      fx.leaderboardEntry({ id: 2, username: "KĄ_TIK", testgrade: "5.00", lastseen: seenAgo(MINUTE) }),
    ]);
    expect(shownNames()).toEqual(["BEVEIK_PARA", "KĄ_TIK"]);

    // The ticks re-render the table, which re-reads the clock:
    // two seconds on, the visit is exactly a day old — still
    // shown
    await advance(2000);
    expect(shownNames()).toEqual(["BEVEIK_PARA", "KĄ_TIK"]);

    // One more — a day and a second: gone, before any refetch
    await advance(1000);
    expect(shownNames()).toEqual(["KĄ_TIK"]);
    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(1);
  });


  it("stops counting down and refreshing once the page is left", async () => {
    const { unmount } = await renderLoaded();

    unmount();
    await advance(20000);

    expect(vi.getTimerCount()).toBe(0);
    expect(backend.requests("GET", LEADERBOARD)).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// Ranking
// -----------------------------------------------------------

describe("Leaderboard — ranking", () => {

  beforeEach(pinNow);


  it("orders by grade, best first — numerically, although the grades are strings", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "DU_BALAI", testgrade: "2.00" }),
      fx.leaderboardEntry({ id: 2, username: "DEŠIMT_BALŲ", testgrade: "10.00" }),
      fx.leaderboardEntry({ id: 3, username: "DEVYNI_SU_PUSE", testgrade: "9.50" }),
    ]);
    await screen.findByText("DU_BALAI");

    // Compared as text it would be "9.50" > "2.00" > "10.00"
    expect(shownNames()).toEqual(["DEŠIMT_BALŲ", "DEVYNI_SU_PUSE", "DU_BALAI"]);
    expect(studentRows().map(barText)).toEqual(["Įvertinimas: 10.00", "Įvertinimas: 9.50", "Įvertinimas: 2.00"]);
  });


  it('ranks a blank grade ("") as 0 — below every real grade', async () => {
    renderBoard([
      // Finished, so its bar shows a grade — a RUNNING blank row
      // would print "null / " (KB-01)
      fx.blankLeaderboardEntry({ id: 1, username: "BE_TESTO", isfinished: 1 }),
      fx.leaderboardEntry({ id: 2, username: "PUSĖ_BALO", testgrade: "0.50" }),
      fx.leaderboardEntry({ id: 3, username: "AŠTUONI", testgrade: "8.00" }),
    ]);
    await screen.findByText("BE_TESTO");

    expect(shownNames()).toEqual(["AŠTUONI", "PUSĖ_BALO", "BE_TESTO"]);
  });


  it("ranks running tests by their live grade among the finished ones", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "BAIGUSI", testgrade: "6.00", isfinished: 1 }),
      fx.leaderboardEntry({ id: 2, username: "DAR_SPRENDŽIA", testgrade: "7.25", isfinished: 0, answeredquestioncount: 9, questioncount: 12 }),
    ]);
    await screen.findByText("BAIGUSI");

    expect(shownNames()).toEqual(["DAR_SPRENDŽIA", "BAIGUSI"]);
    expect(barText(rowOf("DAR_SPRENDŽIA"))).toBe("9 / 12");
  });


  it("keeps the API's order between equal grades — each still gets its own place", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "NAUJESNĖ", testgrade: "8.00" }),
      fx.leaderboardEntry({ id: 2, username: "SENESNĖ", testgrade: "8.00" }),
      fx.leaderboardEntry({ id: 3, username: "GERIAUSIAS", testgrade: "9.00" }),
    ]);
    await screen.findByText("GERIAUSIAS");

    expect(shownNames()).toEqual(["GERIAUSIAS", "NAUJESNĖ", "SENESNĖ"]);
    expect(studentRows().map((row) => rankBadge(row).textContent)).toEqual(["1", "2", "3"]);
  });


  it("gives places 1–3 their gold, silver and bronze badges", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "KETVIRTAS", testgrade: "4.00" }),
      fx.leaderboardEntry({ id: 2, username: "PIRMAS", testgrade: "9.00" }),
      fx.leaderboardEntry({ id: 3, username: "TREČIAS", testgrade: "6.00" }),
      fx.leaderboardEntry({ id: 4, username: "ANTRAS", testgrade: "8.00" }),
    ]);
    await screen.findByText("PIRMAS");

    expect(shownNames()).toEqual(["PIRMAS", "ANTRAS", "TREČIAS", "KETVIRTAS"]);

    const [gold, silver, bronze] = studentRows().map(rankBadge);
    expect(gold.textContent).toBe("1");
    expect(gold).toHaveClass("rounded-full", "bg-amber-100", "text-amber-700", "border-amber-300");
    expect(silver.textContent).toBe("2");
    expect(silver).toHaveClass("rounded-full", "bg-slate-100", "text-slate-600", "border-slate-300");
    expect(bronze.textContent).toBe("3");
    expect(bronze).toHaveClass("rounded-full", "bg-orange-100", "text-orange-700", "border-orange-300");
  });


  it("shows plain numbers from place 4 on", async () => {
    renderBoard(Array.from({ length: 5 }, (_, index) =>
      fx.leaderboardEntry({ id: index + 1, username: `VIETA_${index + 1}`, testgrade: `${9 - index}.00` })
    ));
    await screen.findByText("VIETA_1");

    const badges = studentRows().map(rankBadge);
    expect(badges.map((badge) => badge.textContent)).toEqual(["1", "2", "3", "4", "5"]);

    for (const badge of badges.slice(3)) {
      expect(badge).toHaveClass("text-gray-400");
      expect(badge).not.toHaveClass("rounded-full");
      expect(badge.className).not.toMatch(/\bbg-/);
    }
  });


  it("ranks a long list 1..25 with medals for the top three only", async () => {
    // Grades 0.00, 0.25, … 6.00 — the API lists the worst first
    const students = Array.from({ length: 25 }, (_, index) =>
      fx.leaderboardEntry({ id: index + 1, username: `STUDENTAS_${index + 1}`, testgrade: (index * 0.25).toFixed(2) })
    );
    renderBoard(students);
    await screen.findByText("STUDENTAS_1");

    expect(shownNames()).toEqual(students.map((student) => student.username).reverse());

    const badges = studentRows().map(rankBadge);
    expect(badges.map((badge) => badge.textContent)).toEqual(Array.from({ length: 25 }, (_, index) => String(index + 1)));
    expect(badges.filter((badge) => badge.classList.contains("rounded-full"))).toHaveLength(3);
  });
});







// -----------------------------------------------------------
// A student's row
// -----------------------------------------------------------

describe("Leaderboard — a student's row", () => {

  beforeEach(pinNow);


  it("shows the place, the name, the result and the last visit", async () => {
    renderBoard([fx.leaderboardEntry({ username: "VARDENĖ_PAVARDENĖ", testgrade: "8.50", lastseen: "2026-08-26T19:09:07+03:00" })]);
    await screen.findByText("VARDENĖ_PAVARDENĖ");

    const [row] = studentRows();
    expect(rankBadge(row).textContent).toBe("1");
    expect(row.cells[1].textContent).toBe("VARDENĖ_PAVARDENĖ");
    expect(barText(row)).toBe("Įvertinimas: 8.50");
    expect(lastSeenText(row)).toBe("2026-08-26 19:09:07");
  });


  it("shows a finished test as 'Įvertinimas: 7.50' on a full burgundy bar", async () => {
    renderBoard([fx.leaderboardEntry({ testgrade: "7.50", isfinished: 1 })]);
    await screen.findByText("JONAS_JONAITIS");

    const [row] = studentRows();
    expect(barText(row)).toBe("Įvertinimas: 7.50");
    expect(bar(row)).toHaveStyle({ width: "100%" });
    expect(bar(row)).toHaveClass("bg-[rgb(123,0,63)]");
    expect(bar(row)).not.toHaveClass("bg-blue-500/80");
    expect(screen.getByText("Įvertinimas: 7.50")).toHaveClass("text-white");
  });


  it("shows the grade, not the count, for a test finished before every question was answered", async () => {
    renderBoard([fx.leaderboardEntry({ testgrade: "3.20", isfinished: 1, answeredquestioncount: 5, questioncount: 12 })]);
    await screen.findByText("JONAS_JONAITIS");

    const [row] = studentRows();
    expect(barText(row)).toBe("Įvertinimas: 3.20");
    expect(bar(row)).toHaveStyle({ width: "100%" });
    expect(screen.queryByText("5 / 12")).toBeNull();
  });


  it("shows a running test as 'answered / total' on a blue bar that wide (6 / 12 → 50%)", async () => {
    renderBoard([fx.leaderboardEntry({ isfinished: 0, answeredquestioncount: 6, questioncount: 12, testgrade: "4.00" })]);
    await screen.findByText("JONAS_JONAITIS");

    const [row] = studentRows();
    expect(barText(row)).toBe("6 / 12");
    expect(bar(row)).toHaveStyle({ width: "50%" });
    expect(bar(row)).toHaveClass("bg-blue-500/80");
    expect(bar(row)).not.toHaveClass("bg-[rgb(123,0,63)]");
    expect(screen.getByText("6 / 12")).toHaveClass("text-gray-800");
    expect(screen.queryByText(/^Įvertinimas:/)).toBeNull();
  });


  it.each([
    [1, 3, "33%"],
    [2, 3, "67%"],
    [0, 12, "0%"],
    [12, 12, "100%"],
  ])("sizes a running bar at %i / %i to %s (rounded)", async (answered, total, width) => {
    renderBoard([fx.leaderboardEntry({ isfinished: 0, answeredquestioncount: answered, questioncount: total, testgrade: "0.00" })]);
    await screen.findByText("JONAS_JONAITIS");

    // A running test at 12 / 12 still reads as a count, on blue
    const [row] = studentRows();
    expect(barText(row)).toBe(`${answered} / ${total}`);
    expect(bar(row)).toHaveStyle({ width });
    expect(bar(row)).toHaveClass("bg-blue-500/80");
  });


  it("keeps a running test with no questions at an empty bar — no division by zero", async () => {
    renderBoard([fx.leaderboardEntry({ isfinished: 0, answeredquestioncount: 0, questioncount: 0, testgrade: "0.00" })]);
    await screen.findByText("JONAS_JONAITIS");

    const [row] = studentRows();
    expect(barText(row)).toBe("0 / 0");
    expect(bar(row)).toHaveStyle({ width: "0%" });
  });


  it("prints the last visit as Vilnius wall time, zero-padded", async () => {
    renderBoard([fx.leaderboardEntry({ lastseen: "2026-08-26T09:05:03+03:00" })]);
    await screen.findByText("JONAS_JONAITIS");

    expect(lastSeenText(studentRows()[0])).toBe("2026-08-26 09:05:03");
  });
});







// -----------------------------------------------------------
// The recent filter
// -----------------------------------------------------------

describe("Leaderboard — only students seen within the last day", () => {

  beforeEach(pinNow);


  it("shows a student seen exactly 24 h ago", async () => {
    renderBoard([fx.leaderboardEntry({ username: "LYGIAI_PARA", lastseen: seenAgo(DAY) })]);

    expect(await screen.findByText("LYGIAI_PARA")).toBeInTheDocument();
  });


  it("hides a student seen 24 h and 1 s ago", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "PARA_IR_SEKUNDĖ", lastseen: seenAgo(DAY + SECOND) }),
      fx.leaderboardEntry({ id: 2, username: "PRIEŠ_VALANDĄ", lastseen: seenAgo(HOUR) }),
    ]);
    await screen.findByText("PRIEŠ_VALANDĄ");

    expect(screen.queryByText("PARA_IR_SEKUNDĖ")).toBeNull();
    expect(shownNames()).toEqual(["PRIEŠ_VALANDĄ"]);
  });


  it("hides a student never seen (lastseen null)", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "NIEKADA", lastseen: null }),
      fx.leaderboardEntry({ id: 2, username: "PRIEŠ_VALANDĄ", lastseen: seenAgo(HOUR) }),
    ]);
    await screen.findByText("PRIEŠ_VALANDĄ");

    expect(shownNames()).toEqual(["PRIEŠ_VALANDĄ"]);
  });


  it("shows everyone once 'Rodyti Visus' is ticked, and hides them again when unticked", async () => {
    const { user } = renderBoard([
      fx.leaderboardEntry({ id: 1, username: "ŠIANDIEN", testgrade: "5.00", lastseen: seenAgo(HOUR) }),
      fx.leaderboardEntry({ id: 2, username: "VAKAR", testgrade: "9.00", lastseen: seenAgo(DAY + SECOND) }),
      fx.leaderboardEntry({ id: 3, username: "NIEKADA", testgrade: "7.00", lastseen: null }),
    ]);
    await screen.findByText("ŠIANDIEN");
    expect(shownNames()).toEqual(["ŠIANDIEN"]);

    await user.click(showAllBox());
    expect(showAllBox()).toBeChecked();
    expect(shownNames()).toEqual(["VAKAR", "NIEKADA", "ŠIANDIEN"]);

    await user.click(showAllBox());
    expect(showAllBox()).not.toBeChecked();
    expect(shownNames()).toEqual(["ŠIANDIEN"]);
  });


  it("counts places among the students shown", async () => {
    const { user } = renderBoard([
      fx.leaderboardEntry({ id: 1, username: "ŠIANDIEN", testgrade: "5.00", lastseen: seenAgo(HOUR) }),
      fx.leaderboardEntry({ id: 2, username: "VAKAR", testgrade: "9.00", lastseen: seenAgo(DAY + SECOND) }),
      fx.leaderboardEntry({ id: 3, username: "UŽVAKAR", testgrade: "7.00", lastseen: seenAgo(2 * DAY) }),
    ]);
    await screen.findByText("ŠIANDIEN");

    // Alone on today's board: gold
    expect(rankBadge(rowOf("ŠIANDIEN")).textContent).toBe("1");
    expect(rankBadge(rowOf("ŠIANDIEN"))).toHaveClass("bg-amber-100");

    await user.click(showAllBox());

    expect(rankBadge(rowOf("VAKAR")).textContent).toBe("1");
    expect(rankBadge(rowOf("ŠIANDIEN")).textContent).toBe("3");
    expect(rankBadge(rowOf("ŠIANDIEN"))).toHaveClass("bg-orange-100");
  });


  it("shows an old visit in Vilnius time, and an empty cell for a student never seen, under 'Rodyti Visus'", async () => {
    const { user } = renderBoard([
      fx.leaderboardEntry({ id: 1, username: "ŽIEMĄ", testgrade: "9.00", lastseen: "2026-01-15T10:00:00+02:00" }),
      fx.leaderboardEntry({ id: 2, username: "NIEKADA", testgrade: "8.00", lastseen: null }),
    ]);
    await screen.findByText("Šiuo metu dalyvių nėra");

    await user.click(showAllBox());

    expect(lastSeenText(rowOf("ŽIEMĄ"))).toBe("2026-01-15 10:00:00");
    expect(lastSeenText(rowOf("NIEKADA"))).toBe("");
  });
});







// -----------------------------------------------------------
// Nobody to show
// -----------------------------------------------------------

describe("Leaderboard — nobody to show", () => {

  beforeEach(pinNow);


  it("says 'Šiuo metu dalyvių nėra' across the whole table for an empty leaderboard", async () => {
    renderBoard([]);

    const message = await screen.findByText("Šiuo metu dalyvių nėra");
    expect(message).toHaveAttribute("colspan", "4");
    expect(studentRows()).toHaveLength(0);
  });


  it("says so when nobody was seen within the last day", async () => {
    renderBoard([
      fx.leaderboardEntry({ id: 1, username: "VAKARYKŠTIS", lastseen: seenAgo(DAY + SECOND) }),
      fx.leaderboardEntry({ id: 2, username: "NIEKADA", lastseen: null }),
      // Registered two days ago and never dealt a test — the
      // contract's blank entry, filtered out before any bar
      fx.blankLeaderboardEntry({ id: 3, username: "BE_TESTO", lastseen: seenAgo(2 * DAY) }),
    ]);

    await screen.findByText("Šiuo metu dalyvių nėra");
    expect(studentRows()).toHaveLength(0);
  });


  it("drops the message once 'Rodyti Visus' reveals someone", async () => {
    const { user } = renderBoard([fx.leaderboardEntry({ username: "VAKARYKŠTIS", lastseen: seenAgo(2 * DAY) })]);
    await screen.findByText("Šiuo metu dalyvių nėra");

    await user.click(showAllBox());

    expect(screen.queryByText("Šiuo metu dalyvių nėra")).toBeNull();
    expect(shownNames()).toEqual(["VAKARYKŠTIS"]);
  });


  it("keeps the message under 'Rodyti Visus' when the API lists nobody at all", async () => {
    const { user } = renderBoard([]);
    await screen.findByText("Šiuo metu dalyvių nėra");

    await user.click(showAllBox());

    expect(showAllBox()).toBeChecked();
    expect(screen.getByText("Šiuo metu dalyvių nėra")).toBeInTheDocument();
  });
});
