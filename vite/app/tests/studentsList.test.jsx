// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the students list (StudentsList)
//
//  src/systemPages/AdminPages/StudentsList/ — StudentsList (the
//  admin layout, with its own <Toaster/>) around
//  StudentsListTable, a DataGrid of GET /api/admin/students:
//    - the GET (axios, withCredentials) on mount, then every
//      5 s until unmount. The heading "Studentų Sąrašas" is
//      there at once, its count "(N)" — the students the list
//      SHOWS — only once the first reply is in; a progress bar
//      covers the grid meanwhile. A failed FIRST load shows
//      "Nepavyko įkelti studentų sąrašo" with "Bandyti dar
//      kartą" (asks again) instead of the count and the grid,
//      until a retry or the next poll brings the list; a failed
//      later poll keeps the last list — an empty one too; a 401
//      is a full page load of /login
//    - the columns ID, Prisijungimo Vardas, Kl. Skaičius,
//      Įvertinimas, Baigta?, Registracijos Laikas, Paskutinįkart
//      Pastebėtas: the grade printed as the API's 2-decimal
//      string but SORTED as a number, "" (no dealt test) printed
//      empty, "BAIGTA" only for isfinished 1, the timestamps in
//      Vilnius time and empty for null
//    - a click anywhere on a row opens /admin/students/<id>
//      client-side
//    - "Per Paskutinį Mėnesį" (on by default) hides the students
//      not seen within one calendar month — the day clamped to
//      a shorter month (May 31 reaches back to April 30) —
//      never-seen (null) ones too; off, everyone is listed; the
//      switch keeps its position through polls and a retried
//      first load
//    - "Ieškoti..." — the grid's quick filter, applied 150 ms
//      after the last keystroke: the whole trimmed text is ONE
//      search value, found case-insensitively inside any
//      column's printed text ("BAIGTA" finds the finished);
//      the grade column compares numbers; a poll landing inside
//      the 150 ms does not drop the search
//    - "STULPELIAI" toggles the grid's column picker — one click
//      opens it again after the picker closed itself (a click
//      elsewhere, Escape)
//    - 100 students a page, ButtonsPagination's page buttons
//
//  Under jsdom the DataGrid switches row and column
//  virtualization off, so every row of the page and every
//  column is in the DOM. "Now" is pinned wherever the
//  last-month filter matters; the polling tests' students are
//  seen minutes or 40 days back, clear of any cutoff. The
//  role-gate reply is useFetchData's (useFetchData.test.jsx).
// -----------------------------------------------------------

import "./support/setup";

import { beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { renderPage, settle } from "./support/render";
import { hardNavigations } from "./support/navigation";
import * as fx from "./support/fixtures";

import StudentsList from "@/systemPages/AdminPages/StudentsList/StudentsList";


const STUDENTS = "/api/admin/students";

// "Now" wherever the last-month filter matters: 2026-08-15 12:00
// in Vilnius, one calendar month back is 2026-07-15 12:00 — no
// DST switch in between, so the cutoff is the same instant in
// any timezone the suite runs in
const NOW = new Date("2026-08-15T12:00:00+03:00");

const HEADERS = [
  "ID", "Prisijungimo Vardas", "Kl. Skaičius", "Įvertinimas", "Baigta?", "Registracijos Laikas", "Paskutinįkart Pastebėtas",
];

const FIELDS = ["id", "username", "questioncount", "testgrade", "isfinished", "registrationtime", "lastseen"];

const ACTIVE_TINT = "bg-[rgba(var(--mui-palette-primary-mainChannel)/0.20)]";


// Date only — the grid, the fake backend, user-event and React
// Testing Library keep their real timers
const pinClock = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
};

// The polling tests fake ONLY the interval: the fake backend
// answers on promises and React Testing Library keeps its real
// setTimeout. "Now" stays real there — their students are seen
// minutes before whatever day the suite runs
const useFakeInterval = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });


// A student the default filter lists: registered three days and
// seen five minutes before the clock (pin it first, where the
// clock is pinned)
const student = (overrides = {}) => fx.studentDetail({
  registrationtime: fx.daysAgo(3),
  lastseen: fx.minutesAgo(5),
  ...overrides,
});

// The same without a dealt test — the blank-field contract
// (questioncount / testgrade "", isfinished 0)
const newcomer = (overrides = {}) => fx.blankStudentDetail({
  registrationtime: fx.daysAgo(3),
  lastseen: fx.minutesAgo(5),
  ...overrides,
});


// Mounts the page on `students` (setTimeout must be real: user-
// event and React Testing Library's waits run on it); resolves
// once the list is on screen — the heading's "(N)" and the grid's
// rows
const renderList = async (students) => {
  backend.on("GET", STUDENTS, reply.json(students));
  const result = renderPage(<StudentsList />, { path: "/admin/students" });

  const heading = await screen.findByText(/^\(\d+\)$/);
  const shown = Number(heading.textContent.slice(1, -1));
  await waitFor(() => expect(rowIds()).toHaveLength(Math.min(shown, 100)));

  return result;
};

// The same with the interval faked; the first reply is rendered
// when it resolves
const mountPolling = async (students) => {
  useFakeInterval();
  backend.on("GET", STUDENTS, reply.json(students));
  const result = renderPage(<StudentsList />, { path: "/admin/students" });
  await settle();
  return result;
};

const nextPoll = async () => {
  await act(() => vi.advanceTimersByTimeAsync(5000));
  await settle();
};

const listRequests = () => backend.requests("GET", STUDENTS);


// The grid's data rows in screen order — the header row carries
// no data-id
const rowIds = () => [...document.querySelectorAll('[role="row"][data-id]')].map((row) => row.getAttribute("data-id"));

const cell = (id, field) => document.querySelector(`[role="row"][data-id="${id}"] [role="gridcell"][data-field="${field}"]`);

const rowTexts = (id) => Object.fromEntries(FIELDS.map((field) => [field, cell(id, field).textContent]));

const columnTexts = (field) =>
  [...document.querySelectorAll(`[role="row"][data-id] [role="gridcell"][data-field="${field}"]`)].map((element) => element.textContent);

const columnHeader = (field) => document.querySelector(`[role="columnheader"][data-field="${field}"]`);

const headerTitles = () =>
  [...document.querySelectorAll('[role="columnheader"] .MuiDataGrid-columnHeaderTitle')].map((title) => title.textContent);

// The heading's "(N)" — null while the first load runs
const countText = () => screen.queryByText(/^\(\d+\)$/)?.textContent ?? null;

const lastMonthSwitch = () => screen.getByRole("switch", { name: "Per Paskutinį Mėnesį" });

const searchBox = () => screen.getByPlaceholderText("Ieškoti...");

const columnsButton = () => screen.getByRole("button", { name: "STULPELIAI" });

// The failed first load's message and its retry
const LOAD_FAILED = "Nepavyko įkelti studentų sąrašo";

const retryButton = () => screen.findByRole("button", { name: "Bandyti dar kartą" });

// The page content next to the sidebar
const content = () => screen.getByRole("heading", { name: "Studentų Sąrašas" }).closest(".overflow-auto");

// jsdom versions spell a CSS color differently (#ebecef or
// rgb(…)) — spell the expected one the way the page's is
const cssColor = (value) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = value;
  return probe.style.backgroundColor;
};







// -----------------------------------------------------------
// Loading the list
// -----------------------------------------------------------

describe("StudentsList — loading the list", () => {

  it("asks GET /api/admin/students once, with the session cookie — and nothing else", async () => {
    await mountPolling([student()]);

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: STUDENTS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("shows the heading at once, but the count and the rows only once the list has arrived — a progress bar meanwhile", async () => {
    pinClock();
    const first = deferred();
    backend.on("GET", STUDENTS, () => first.promise);
    renderPage(<StudentsList />, { path: "/admin/students" });
    await waitFor(() => expect(listRequests()).toHaveLength(1));

    expect(screen.getByRole("heading", { name: "Studentų Sąrašas" })).toBeInTheDocument();
    expect(countText()).toBeNull();
    expect(rowIds()).toEqual([]);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await act(async () => first.resolve(reply.json([student({ id: 5 }), student({ id: 6 })])));

    await waitFor(() => expect(rowIds()).toEqual(["5", "6"]));
    expect(countText()).toBe("(2)");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });


  it("shows (0) and no rows while nobody has registered", async () => {
    pinClock();
    await renderList([]);

    expect(countText()).toBe("(0)");
    expect(rowIds()).toEqual([]);
  });


  it("sends an expired session (401) to /login with a full page load — the count never shows", async () => {
    // Real timers: the redirect changes nothing on screen, so a
    // waitFor on a faked interval would never look again
    backend.on("GET", STUDENTS, reply.status(401, "Unauthorized"));
    renderPage(<StudentsList />, { path: "/admin/students" });

    // The target is pinned, not how often it is set
    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();

    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(countText()).toBeNull();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });


  it.each([
    ["a server error", reply.status(500, "Internal Server Error")],
    ["a network failure", reply.networkError()],
  ])("a first load lost to %s shows 'Nepavyko įkelti studentų sąrašo' with 'Bandyti dar kartą' — no '(0)', no grid", async (_, failure) => {
    useFakeInterval();
    backend.on("GET", STUDENTS, failure);
    renderPage(<StudentsList />, { path: "/admin/students" });
    await settle();

    expect(screen.getByText(LOAD_FAILED)).toBeInTheDocument();
    expect(await retryButton()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Studentų Sąrašas" })).toBeInTheDocument();
    expect(countText()).toBeNull();
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });


  it("'Bandyti dar kartą' asks again — and shows the list once it arrives", async () => {
    useFakeInterval();
    backend.once("GET", STUDENTS, reply.status(500, "Internal Server Error"));
    backend.on("GET", STUDENTS, reply.json([student({ id: 5 }), student({ id: 6 })]));
    const { user } = renderPage(<StudentsList />, { path: "/admin/students" });

    await user.click(await retryButton());

    await waitFor(() => expect(rowIds()).toEqual(["5", "6"]));
    expect(countText()).toBe("(2)");
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
    expect(listRequests()).toHaveLength(2);
    expect(listRequests()[1]).toMatchObject({ client: "axios", method: "GET", url: STUDENTS, withCredentials: true });
  });


  it("keeps 'Per Paskutinį Mėnesį' switched off through a failed first load and its retry", async () => {
    useFakeInterval();
    const first = deferred();
    backend.once("GET", STUDENTS, () => first.promise);
    // Forty days is more than any calendar month back
    backend.on("GET", STUDENTS, reply.json([student({ id: 1 }), student({ id: 2, lastseen: fx.daysAgo(40) })]));
    const { user } = renderPage(<StudentsList />, { path: "/admin/students" });
    await waitFor(() => expect(listRequests()).toHaveLength(1));

    // Switched off while the first load is on its way
    await user.click(lastMonthSwitch());
    await act(async () => first.resolve(reply.status(500, "Internal Server Error")));
    await user.click(await retryButton());

    await waitFor(() => expect(rowIds()).toEqual(["1", "2"]));
    expect(lastMonthSwitch()).not.toBeChecked();
    expect(countText()).toBe("(2)");
  });


  it("drops a reply that arrives after the admin has left the page", async () => {
    useFakeInterval();
    const first = deferred();
    backend.on("GET", STUDENTS, () => first.promise);
    const { unmount } = renderPage(<StudentsList />, { path: "/admin/students" });
    await settle();
    unmount();

    await act(async () => first.resolve(reply.json([student()])));
    await settle();

    // The late state update must stay silent — setup.js fails the
    // test on any React error it would log
    expect(screen.queryByText("Studentų Sąrašas")).toBeNull();
  });
});







// -----------------------------------------------------------
// Polling
// -----------------------------------------------------------

describe("StudentsList — polling every 5 s", () => {

  it("asks again every 5 seconds, each time with the session cookie", async () => {
    await mountPolling([student()]);
    expect(listRequests()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(listRequests()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(listRequests()).toHaveLength(2);

    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(listRequests()).toHaveLength(4);
    expect(listRequests().every((request) => request.withCredentials === true)).toBe(true);
  });


  it("shows the fresh list of every poll — a new student, a changed grade, the count", async () => {
    await mountPolling([student({ id: 5, username: "JONAS_JONAITIS", testgrade: "7.50" })]);
    expect(rowIds()).toEqual(["5"]);
    expect(countText()).toBe("(1)");

    backend.on("GET", STUDENTS, reply.json([
      student({ id: 6, username: "PETRAS_PETRAITIS" }),
      student({ id: 5, username: "JONAS_JONAITIS", testgrade: "8.00" }),
    ]));
    await nextPoll();

    expect(rowIds()).toEqual(["6", "5"]);
    expect(countText()).toBe("(2)");
    expect(cell(6, "username").textContent).toBe("PETRAS_PETRAITIS");
    expect(cell(5, "testgrade").textContent).toBe("8.00");
  });


  it("stops once the page is unmounted", async () => {
    const { unmount } = await mountPolling([student()]);

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(20000));

    expect(listRequests()).toHaveLength(1);
  });


  it("stops once the admin has opened a student", async () => {
    const { location } = await mountPolling([student({ id: 5 })]);

    fireEvent.click(cell(5, "username"));
    expect(location().pathname).toBe("/admin/students/5");

    await act(() => vi.advanceTimersByTimeAsync(20000));

    expect(listRequests()).toHaveLength(1);
  });


  it.each([
    ["a server error", reply.status(500, "Internal Server Error")],
    ["a network failure", reply.networkError()],
  ])("keeps the last list through %s and takes the next good poll", async (_, failure) => {
    await mountPolling([student({ id: 5, testgrade: "7.50" })]);

    backend.once("GET", STUDENTS, failure);
    await nextPoll();

    expect(listRequests()).toHaveLength(2);
    expect(rowIds()).toEqual(["5"]);
    expect(cell(5, "testgrade").textContent).toBe("7.50");
    expect(countText()).toBe("(1)");
    expect(screen.queryByRole("progressbar")).toBeNull();

    backend.on("GET", STUDENTS, reply.json([student({ id: 5, testgrade: "8.00" })]));
    await nextPoll();

    expect(cell(5, "testgrade").textContent).toBe("8.00");
  });


  it("keeps an empty list — '(0)', no failure message — through a failed poll", async () => {
    await mountPolling([]);
    expect(countText()).toBe("(0)");

    backend.once("GET", STUDENTS, reply.status(500, "Internal Server Error"));
    await nextPoll();

    expect(listRequests()).toHaveLength(2);
    expect(countText()).toBe("(0)");
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });


  it("keeps polling after a failed first load — the next good poll brings the list in", async () => {
    useFakeInterval();
    backend.once("GET", STUDENTS, reply.status(500, "Internal Server Error"));
    backend.on("GET", STUDENTS, reply.json([student({ id: 5 })]));
    renderPage(<StudentsList />, { path: "/admin/students" });
    await settle();
    expect(screen.getByText(LOAD_FAILED)).toBeInTheDocument();

    await nextPoll();

    expect(listRequests()).toHaveLength(2);
    await waitFor(() => expect(rowIds()).toEqual(["5"]));
    expect(countText()).toBe("(1)");
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
  });


  it("sends the admin to /login (full page load) when a later poll finds the session expired", async () => {
    await mountPolling([student()]);
    expect(hardNavigations()).toEqual([]);

    backend.once("GET", STUDENTS, reply.status(401, "Unauthorized"));
    await nextPoll();

    // The redirect happened within nextPoll; only the interval is
    // fake, so settle() still runs on a real setTimeout
    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
  });


  it("keeps the admin's grade sort when a poll brings new students", async () => {
    await mountPolling([
      student({ id: 2, testgrade: "10.00" }),
      student({ id: 1, testgrade: "9.50" }),
    ]);

    fireEvent.click(columnHeader("testgrade"));
    expect(rowIds()).toEqual(["1", "2"]);

    backend.on("GET", STUDENTS, reply.json([
      student({ id: 3, testgrade: "5.00" }),
      student({ id: 2, testgrade: "10.00" }),
      student({ id: 1, testgrade: "9.50" }),
    ]));
    await nextPoll();

    expect(rowIds()).toEqual(["3", "1", "2"]);
    expect(columnHeader("testgrade")).toHaveAttribute("aria-sort", "ascending");
  });


  it("keeps 'Per Paskutinį Mėnesį' switched off when a poll brings the list again", async () => {
    // Forty days is more than any calendar month back
    await mountPolling([
      student({ id: 1 }),
      student({ id: 2, lastseen: fx.daysAgo(40) }),
    ]);
    expect(rowIds()).toEqual(["1"]);

    fireEvent.click(lastMonthSwitch());
    await settle();
    expect(rowIds()).toEqual(["1", "2"]);

    await nextPoll();

    expect(listRequests()).toHaveLength(2);
    expect(lastMonthSwitch()).not.toBeChecked();
    expect(rowIds()).toEqual(["1", "2"]);
    expect(countText()).toBe("(2)");
  });
});







// -----------------------------------------------------------
// The columns
// -----------------------------------------------------------

describe("StudentsList — the columns", () => {

  beforeEach(pinClock);


  it("heads the grid ID, Prisijungimo Vardas, Kl. Skaičius, Įvertinimas, Baigta?, Registracijos Laikas, Paskutinįkart Pastebėtas", async () => {
    await renderList([student()]);

    expect(headerTitles()).toEqual(HEADERS);
    expect([...document.querySelectorAll('[role="columnheader"]')].map((header) => header.getAttribute("data-field"))).toEqual(FIELDS);
  });


  it("fills a student's row: ID, name, dealt questions, grade, BAIGTA and both times in Vilnius time", async () => {
    await renderList([student({
      id: 5,
      username: "JONAS_JONAITIS",
      questioncount: 12,
      testgrade: "7.50",
      isfinished: 1,
      registrationtime: "2026-08-12T09:30:00+03:00",
      lastseen: "2026-08-15T11:55:00+03:00",
    })]);

    expect(rowTexts(5)).toEqual({
      id: "5",
      username: "JONAS_JONAITIS",
      questioncount: "12",
      testgrade: "7.50",
      isfinished: "BAIGTA",
      registrationtime: "2026-08-12 09:30:00",
      lastseen: "2026-08-15 11:55:00",
    });
  });


  it("prints the grade as the API's 2-decimal string — '7.50', '10.00', '0.00', '9.05'", async () => {
    await renderList([
      student({ id: 1, testgrade: "7.50" }),
      student({ id: 2, testgrade: "10.00" }),
      student({ id: 3, testgrade: "0.00" }),
      student({ id: 4, testgrade: "9.05" }),
    ]);

    expect(columnTexts("testgrade")).toEqual(["7.50", "10.00", "0.00", "9.05"]);
  });


  it("leaves the dealt questions and the grade empty for a student without a dealt test (\"\") — and no BAIGTA", async () => {
    await renderList([newcomer({ id: 9, username: "NAUJOKAS" })]);

    expect(rowTexts(9)).toMatchObject({
      id: "9",
      username: "NAUJOKAS",
      questioncount: "",
      testgrade: "",
      isfinished: "",
    });
  });


  it("marks a finished student (isfinished 1) with the green 'BAIGTA' badge, an unfinished one (0) with nothing", async () => {
    await renderList([
      student({ id: 5, isfinished: 1 }),
      student({ id: 6, isfinished: 0, answeredquestioncount: 7, testgrade: "4.20" }),
    ]);

    const badge = cell(5, "isfinished").firstElementChild;
    expect(badge.textContent).toBe("BAIGTA");
    expect(badge).toHaveClass("bg-[green]");
    expect(cell(6, "isfinished")).toBeEmptyDOMElement();
  });


  it("prints both times in Vilnius time — a winter (+02:00) one too — and nothing for null", async () => {
    await renderList([
      student({ id: 5, registrationtime: "2026-01-15T10:00:00+02:00", lastseen: "2026-08-15T11:55:00+03:00" }),
      student({ id: 6, registrationtime: null, lastseen: "2026-08-01T00:05:00+03:00" }),
    ]);

    expect(cell(5, "registrationtime").textContent).toBe("2026-01-15 10:00:00");
    expect(cell(5, "lastseen").textContent).toBe("2026-08-15 11:55:00");
    expect(cell(6, "registrationtime").textContent).toBe("");
    expect(cell(6, "lastseen").textContent).toBe("2026-08-01 00:05:00");
  });


  it("keeps the order the API sends (newest first) while no column is sorted", async () => {
    await renderList([student({ id: 7 }), student({ id: 5 }), student({ id: 6 })]);

    expect(rowIds()).toEqual(["7", "5", "6"]);
    expect(columnHeader("testgrade")).toHaveAttribute("aria-sort", "none");
  });


  it("shows Lithuanian usernames exactly", async () => {
    await renderList([
      student({ id: 5, username: "ŽYDRŪNAS_ČIURLIONIS" }),
      student({ id: 6, username: "VARDENĖ_PAVARDENĖ" }),
    ]);

    expect(columnTexts("username")).toEqual(["ŽYDRŪNAS_ČIURLIONIS", "VARDENĖ_PAVARDENĖ"]);
  });
});







// -----------------------------------------------------------
// Sorting by grade
// -----------------------------------------------------------

describe("StudentsList — sorting by grade", () => {

  beforeEach(pinClock);

  // In the API's order: 9.50, 10.00, 2.00 and a student without
  // a dealt test (grade "") — as strings "10.00" < "2.00" < "9.50"
  const graded = () => [
    student({ id: 1, username: "DEVYNI_SU_PUSE", testgrade: "9.50" }),
    student({ id: 2, username: "DESIMT", testgrade: "10.00" }),
    student({ id: 3, username: "DU", testgrade: "2.00" }),
    newcomer({ id: 4, username: "NAUJOKAS" }),
  ];


  it("sorts the grades as numbers although the API sends strings — '10.00' after '9.50', the blank grade first", async () => {
    const { user } = await renderList(graded());

    await user.click(columnHeader("testgrade"));

    await waitFor(() => expect(rowIds()).toEqual(["4", "3", "1", "2"]));
    expect(columnTexts("testgrade")).toEqual(["", "2.00", "9.50", "10.00"]);
    expect(columnHeader("testgrade")).toHaveAttribute("aria-sort", "ascending");
  });


  it("a second click sorts descending, a third restores the API's order", async () => {
    const { user } = await renderList(graded());

    await user.click(columnHeader("testgrade"));
    await user.click(columnHeader("testgrade"));

    await waitFor(() => expect(columnTexts("testgrade")).toEqual(["10.00", "9.50", "2.00", ""]));
    expect(columnHeader("testgrade")).toHaveAttribute("aria-sort", "descending");

    await user.click(columnHeader("testgrade"));

    await waitFor(() => expect(rowIds()).toEqual(["1", "2", "3", "4"]));
    expect(columnHeader("testgrade")).toHaveAttribute("aria-sort", "none");
  });
});







// -----------------------------------------------------------
// Opening a student
// -----------------------------------------------------------

describe("StudentsList — opening a student", () => {

  beforeEach(pinClock);


  it("a click on a row opens that student's page, /admin/students/<id>, without a page load", async () => {
    const { user, location } = await renderList([
      student({ id: 5 }),
      student({ id: 37, username: "KITAS_STUDENTAS" }),
    ]);

    await user.click(cell(37, "username"));

    await waitFor(() => expect(location().pathname).toBe("/admin/students/37"));
    expect(screen.getByTestId("other-route")).toBeInTheDocument();
    expect(hardNavigations()).toEqual([]);
  });


  it.each(["id", "testgrade", "lastseen"])("a click on the row's %s cell opens it too", async (field) => {
    const { user, location } = await renderList([student({ id: 5 }), student({ id: 6 })]);

    await user.click(cell(5, field));

    await waitFor(() => expect(location().pathname).toBe("/admin/students/5"));
  });


  it("a click on the BAIGTA badge opens its row too", async () => {
    const { user, location } = await renderList([student({ id: 5, isfinished: 1 }), student({ id: 6 })]);

    await user.click(cell(5, "isfinished").firstElementChild);

    await waitFor(() => expect(location().pathname).toBe("/admin/students/5"));
  });
});







// -----------------------------------------------------------
// "Per Paskutinį Mėnesį"
// -----------------------------------------------------------

describe("StudentsList — 'Per Paskutinį Mėnesį'", () => {

  beforeEach(pinClock);

  // Seen yesterday, three weeks ago, two months ago and never
  const seen = () => [
    student({ id: 1, username: "VAKAR", lastseen: "2026-08-14T12:00:00+03:00" }),
    student({ id: 2, username: "PRIES_TRIS_SAVAITES", lastseen: "2026-07-25T12:00:00+03:00" }),
    student({ id: 3, username: "PRIES_DU_MENESIUS", lastseen: "2026-06-10T12:00:00+03:00" }),
    student({ id: 4, username: "NIEKADA", lastseen: null }),
  ];


  it("is a switch in the grid's toolbar, on by default", async () => {
    await renderList(seen());

    const toolbarSwitch = within(screen.getByRole("toolbar")).getByRole("switch", { name: "Per Paskutinį Mėnesį" });
    expect(toolbarSwitch).toBeChecked();
  });


  it("on: lists only the students seen within the last month — older and never-seen (null) ones are hidden", async () => {
    await renderList(seen());

    expect(rowIds()).toEqual(["1", "2"]);
    expect(countText()).toBe("(2)");
  });


  it("cuts off exactly one calendar month back: seen 2026-07-15 12:00:00 stays, a second earlier goes", async () => {
    await renderList([
      student({ id: 1, username: "RIBOJE", lastseen: "2026-07-15T12:00:00+03:00" }),
      student({ id: 2, username: "SEKUNDE_PER_ANKSTI", lastseen: "2026-07-15T11:59:59+03:00" }),
    ]);

    expect(rowIds()).toEqual(["1"]);
    expect(countText()).toBe("(1)");
  });


  it("on March 31 reaches back into February — a student seen March 2, 29 days before, is listed", async () => {
    vi.setSystemTime(new Date("2026-03-31T12:00:00+03:00"));
    await renderList([student({ id: 1, username: "PRIES_29_DIENAS", lastseen: "2026-03-02T12:00:00+02:00" })]);

    expect(rowIds()).toEqual(["1"]);
    expect(countText()).toBe("(1)");
  });


  it("clamps the day to the shorter month: on May 31 12:00:00 seen April 30 12:00:00 stays, a second earlier goes", async () => {
    // Both in Vilnius summer time (+03:00): no DST switch between
    // the two dates, whatever timezone the suite runs in
    vi.setSystemTime(new Date("2026-05-31T12:00:00+03:00"));
    await renderList([
      student({ id: 1, username: "RIBOJE", lastseen: "2026-04-30T12:00:00+03:00" }),
      student({ id: 2, username: "SEKUNDE_PER_ANKSTI", lastseen: "2026-04-30T11:59:59+03:00" }),
    ]);

    expect(rowIds()).toEqual(["1"]);
    expect(countText()).toBe("(1)");
  });


  it("off: lists everyone — the never-seen student with an empty last-seen cell — and the count follows", async () => {
    const { user } = await renderList(seen());

    await user.click(lastMonthSwitch());

    await waitFor(() => expect(rowIds()).toEqual(["1", "2", "3", "4"]));
    expect(lastMonthSwitch()).not.toBeChecked();
    expect(countText()).toBe("(4)");
    expect(cell(3, "lastseen").textContent).toBe("2026-06-10 12:00:00");
    expect(cell(4, "lastseen").textContent).toBe("");
  });


  it("on again: hides them again", async () => {
    const { user } = await renderList(seen());

    await user.click(lastMonthSwitch());
    await waitFor(() => expect(rowIds()).toHaveLength(4));
    await user.click(lastMonthSwitch());

    await waitFor(() => expect(rowIds()).toEqual(["1", "2"]));
    expect(lastMonthSwitch()).toBeChecked();
    expect(countText()).toBe("(2)");
  });
});







// -----------------------------------------------------------
// The quick search "Ieškoti..."
// -----------------------------------------------------------

describe("StudentsList — the quick search 'Ieškoti...'", () => {

  // The clock pinned AND the 5 s polls held back (the interval
  // faked), so every test searches the list it mounted with.
  // setTimeout stays real for user-event, the search's 150 ms
  // debounce and React Testing Library, whose waits then look
  // again on every DOM change
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
  });

  // Distinct names, grades and one registration day apart from
  // the rest — built after the clock is pinned
  const group = () => [
    student({ id: 5, username: "JONAS_JONAITIS", testgrade: "7.50", registrationtime: "2026-01-15T10:00:00+02:00" }),
    student({ id: 6, username: "PETRAS_PETRAITIS", testgrade: "9.00" }),
    student({ id: 7, username: "ONA_ONAITĖ", testgrade: "10.00" }),
    student({ id: 8, username: "ŽYDRŪNAS_ČIURLIONIS", testgrade: "6.25" }),
  ];

  const EVERYONE = ["5", "6", "7", "8"];


  it("sits in the grid's toolbar as a search box, 'Ieškoti...'", async () => {
    await renderList(group());

    expect(within(screen.getByRole("toolbar")).getByRole("searchbox")).toBe(searchBox());
    expect(searchBox()).toHaveValue("");
  });


  it("finds a student by part of the name, whatever the case", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "jonas");

    await waitFor(() => expect(rowIds()).toEqual(["5"]));
    expect(searchBox()).toHaveValue("jonas");
  });


  it("lists everyone whose name holds the text — 'ona' finds JONAS_JONAITIS and ONA_ONAITĖ", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "ona");

    await waitFor(() => expect(rowIds()).toEqual(["5", "7"]));
  });


  it("matches Lithuanian letters in either case — 'čiurlionis' finds ŽYDRŪNAS_ČIURLIONIS", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "čiurlionis");

    await waitFor(() => expect(rowIds()).toEqual(["8"]));
  });


  it("searches the other columns as they are printed — a registration day '2026-01-15'", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "2026-01-15");

    await waitFor(() => expect(rowIds()).toEqual(["5"]));
  });


  it("finds the students who finished by the word on their badge — 'BAIGTA' — and only them", async () => {
    const { user } = await renderList([
      student({ id: 5, username: "BAIGES_STUDENTAS", isfinished: 1 }),
      student({ id: 6, username: "DAR_SPRENDZIA", isfinished: 0, answeredquestioncount: 7, testgrade: "4.20" }),
      student({ id: 7, username: "IRGI_BAIGES", isfinished: 1 }),
    ]);
    expect(cell(5, "isfinished").textContent).toBe("BAIGTA");

    await user.type(searchBox(), "BAIGTA");

    await waitFor(() => expect(rowIds()).toEqual(["5", "7"]));
  });


  it("compares the grade as a number — '7.5' finds the student graded '7.50'", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "7.5");

    await waitFor(() => expect(rowIds()).toEqual(["5"]));
  });


  it("trims the text — '  jonas  ' still finds JONAS_JONAITIS", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "  jonas  ");

    await waitFor(() => expect(rowIds()).toEqual(["5"]));
  });


  it("searches the whole text as one piece, spaces included — 'jonas petras' finds nobody", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "jonas petras");

    await waitFor(() => expect(rowIds()).toEqual([]));
  });


  it("shows no rows when nothing matches, and everyone again once the box is cleared", async () => {
    const { user } = await renderList(group());

    await user.type(searchBox(), "nėra-tokio");
    await waitFor(() => expect(rowIds()).toEqual([]));

    await user.clear(searchBox());

    await waitFor(() => expect(rowIds()).toEqual(EVERYONE));
  });


  it("filters 150 ms after the last keystroke — not a moment earlier", async () => {
    // The box debounces with setTimeout: fake it too, on top of Date
    // and the interval (whose first poll, 5 s in, is never reached).
    // fireEvent + synchronous queries while faked
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(NOW);
    backend.on("GET", STUDENTS, reply.json(group()));
    renderPage(<StudentsList />, { path: "/admin/students" });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(rowIds()).toEqual(EVERYONE);

    fireEvent.change(searchBox(), { target: { value: "jona" } });
    await act(() => vi.advanceTimersByTimeAsync(100));
    fireEvent.change(searchBox(), { target: { value: "jonas" } });

    // 250 ms after the first keystroke, but only 149 after the last
    await act(() => vi.advanceTimersByTimeAsync(149));
    expect(rowIds()).toEqual(EVERYONE);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(rowIds()).toEqual(["5"]);
  });


  it("keeps a search typed just before a poll — the list is filtered once the poll's reply is in", async () => {
    // The whole clock fake: the search's 150 ms, the 5 s polls and
    // Date — fireEvent + synchronous queries. "jonas" goes into the
    // box 100 ms before the first poll (the search is due 50 ms
    // after it); the poll and its reply's re-render run in the next
    // act — separate acts, because an async act renders its queued
    // updates only when its callback is done — and the last act
    // runs well past the search's due time
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(NOW);
    backend.on("GET", STUDENTS, reply.json(group()));
    renderPage(<StudentsList />, { path: "/admin/students" });
    await act(() => vi.advanceTimersByTimeAsync(4900));

    fireEvent.change(searchBox(), { target: { value: "jonas" } });

    await act(() => vi.advanceTimersByTimeAsync(100));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(listRequests()).toHaveLength(2);
    expect(searchBox()).toHaveValue("jonas");
    expect(rowIds()).toEqual(["5"]);
  });
});







// -----------------------------------------------------------
// The column picker "STULPELIAI"
// -----------------------------------------------------------

describe("StudentsList — the column picker 'STULPELIAI'", () => {

  beforeEach(pinClock);

  // A column of the picker — on screen while the picker is open
  const pickerColumn = () => screen.queryByRole("checkbox", { name: "Prisijungimo Vardas" });

  // The picker opened by "STULPELIAI" and then closed by the grid
  // itself — `closeIt` does that: the panel closes on a pointerup
  // outside it (a click-away armed one tick after it opened) and
  // on Escape inside it. Resolves with the user-event instance
  const pickerClosedByTheGrid = async (closeIt) => {
    const { user } = await renderList([student()]);

    await user.click(columnsButton());
    await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" });

    await closeIt(user);
    await waitFor(() => expect(pickerColumn()).toBeNull());
    return user;
  };


  it("opens the grid's column picker: every column listed, every one ticked", async () => {
    const { user } = await renderList([student()]);
    expect(screen.queryByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeNull();

    await user.click(columnsButton());

    for (const header of HEADERS) {
      expect(await screen.findByRole("checkbox", { name: header })).toBeChecked();
    }
  });


  it("a second click closes it, a third opens it again", async () => {
    const { user } = await renderList([student()]);

    await user.click(columnsButton());
    await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" });

    await user.click(columnsButton());
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeNull());

    await user.click(columnsButton());
    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });


  it("after a click elsewhere closed it, one click opens it again", async () => {
    const user = await pickerClosedByTheGrid((user) => user.click(screen.getByRole("heading", { name: "Studentų Sąrašas" })));

    await user.click(columnsButton());

    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });


  it("after Escape closed it, one click opens it again", async () => {
    const user = await pickerClosedByTheGrid(() => {
      fireEvent.keyDown(pickerColumn(), { key: "Escape" });
    });

    await user.click(columnsButton());

    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });


  it("unticking a column there takes it off the grid", async () => {
    const { user } = await renderList([student({ id: 5 })]);

    await user.click(columnsButton());
    await user.click(await screen.findByRole("checkbox", { name: "Kl. Skaičius" }));

    await waitFor(() => expect(headerTitles()).toEqual(HEADERS.filter((header) => header !== "Kl. Skaičius")));
    expect(cell(5, "questioncount")).toBeNull();
    expect(cell(5, "username")).not.toBeNull();
  });
});







// -----------------------------------------------------------
// Pages of 100
// -----------------------------------------------------------

describe("StudentsList — pages of 100", () => {

  it("fits a short list on one page: a single, current page button; next and last disabled", async () => {
    pinClock();
    await renderList([student({ id: 1 }), student({ id: 2 }), student({ id: 3 })]);

    const pages = screen.getByRole("navigation", { name: "pagination navigation" });
    expect(within(pages).getByRole("button", { name: "page 1" })).toHaveAttribute("aria-current", "page");
    expect(within(pages).queryByRole("button", { name: "Go to page 2" })).toBeNull();
    expect(within(pages).getByRole("button", { name: "Go to next page" })).toBeDisabled();
    expect(within(pages).getByRole("button", { name: "Go to last page" })).toBeDisabled();
  });


  it("splits 101 students over two pages — 100 on the first, the 101st on page 2", async () => {
    // The interval is faked too: a poll would re-render the hundred
    // rows in the middle of the test
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    const students = Array.from({ length: 101 }, (_, index) => student({ id: index + 1, username: `STUDENTAS_${index + 1}` }));
    backend.on("GET", STUDENTS, reply.json(students));
    const { user } = renderPage(<StudentsList />, { path: "/admin/students" });
    await settle();

    expect(countText()).toBe("(101)");
    const firstPage = rowIds();
    expect(firstPage).toHaveLength(100);
    expect([firstPage[0], firstPage[99]]).toEqual(["1", "100"]);

    await user.click(screen.getByRole("button", { name: "Go to page 2" }));

    await waitFor(() => expect(rowIds()).toEqual(["101"]));
    expect(cell(101, "username").textContent).toBe("STUDENTAS_101");
    expect(screen.getByRole("button", { name: "page 2" })).toHaveAttribute("aria-current", "page");
    expect(countText()).toBe("(101)");
  }, 30000);
});







// -----------------------------------------------------------
// The admin layout
// -----------------------------------------------------------

describe("StudentsList — the admin layout", () => {

  it("frames the list: the navbar, the sidebar with 'Studentai' lit, the grey content area", async () => {
    pinClock();
    await renderList([student()]);

    expect(screen.getByAltText("VU logotipas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Studentai" }).querySelector("li")).toHaveClass(ACTIVE_TINT);
    expect(content().style.backgroundColor).toBe(cssColor("#EBECEF"));
  });
});
