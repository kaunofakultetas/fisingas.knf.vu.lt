// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — a student's page (StudentInformation)
//
//  src/systemPages/AdminPages/StudentInformation/
//  StudentInformation.jsx at /admin/students/:studentID, inside
//  the admin layout (with its own <Toaster/>):
//    - GET /api/admin/students/<id> (axios, withCredentials,
//      once); the page renders blurred (blur-[5px]) until it
//      answers; a 401 is a full page load of /login; a 404 (the
//      student is gone) leaves only the heading and "Studentas
//      nerastas" — no retry, no delete button, no tabs; any
//      other failure shows "Nepavyko įkelti studento duomenų"
//      with "Bandyti dar kartą" (asks again) in place of the
//      profile card and the tiles, the rest of the page kept
//    - the profile card: the username, "ID:" (the ROUTE's id),
//      the login code, the registration and last-seen times in
//      Vilnius time — "—" for null
//    - the summary: the grade tile (testgrade as the API sends
//      it, "" → 0) and three count tiles "a / b" with the
//      percentage to 2 decimals and a bar; 0 / n, 0 / 0 and the
//      blank-field contract ("" everywhere) read "0.00 %"; each
//      tile explains itself in its title
//    - the tabs: "Atsakymai" (the default — the answer review,
//      StudentAnswers, pinned in studentAnswers.test.jsx) and
//      "Testo Apibendrinimas" — the summary DataGrid, mounted
//      only once opened, with its OWN GET .../answers: the
//      question id "#<id>", the email thumbnail, "Teisingai" /
//      "Neteisingai", the options mini bar "a / b" and the
//      "<points> tšk." chip; a failed GET shows "Nepavyko įkelti
//      atsakymų" with "Bandyti dar kartą" instead of the grid
//    - "Ištrinti Studentą", held 1.5 s: POST .../<id>/delete {}
//      (withCredentials) → "Studentas ištrintas" and client-side
//      back to /admin/students. The button is disabled while the
//      POST is on its way — a second hold sends nothing. A 401
//      is a full page load of /login; any other failure →
//      "Nepavyko ištrinti studento", the page stays and the
//      button can be held again; an early release only toasts
//
//  Left to other files: a route change while the record loads
//  and the role-gate reply (useFetchData's —
//  useFetchData.test.jsx), a failed load of the answer review
//  (StudentAnswers') and a hold released right at 1.5 s
//  (LongPressButton's).
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { hardNavigations } from "./support/navigation";
import { longPress } from "./support/interactions";
import * as fx from "./support/fixtures";

import StudentInformation from "@/systemPages/AdminPages/StudentInformation/StudentInformation";


const RECORD = "/api/admin/students/5";
const ANSWERS = "/api/admin/students/5/answers";
const DELETE = "/api/admin/students/5/delete";

// The success reply of the delete (StatusOk)
const DELETED = reply.json({ status: "ok" });

const BLUR = "blur-[5px]";

const ACTIVE_TINT = "bg-[rgba(var(--mui-palette-primary-mainChannel)/0.20)]";

// The count tiles' explanations — their title attributes
const FULLY_CORRECT = "Klausimai kurie buvo visiškai teisingai atsakyti įskaitant ir pasirenkamas opcijas";
const IDENTIFIED = "Klausimai kurie buvo teisingai identifikuoti tačiau buvo bent viena klaidinga pasirenkama opcija";
const OPTIONS = "Teisingų opcijų skaičius teisingai identifikuotuose klausimuose";

// The documented refusals of the delete plus what the
// infrastructure adds
const FAILURES = [
  ["refused to a non-admin (403 'Error: Not Admin')", reply.text("Error: Not Admin", 403)],
  ["of a student who is gone already (404 'Error: Student not found')", reply.text("Error: Student not found", 404)],
  ["hit by a server error (500)", reply.status(500, "Internal Server Error")],
  ["lost on the network", reply.networkError()],
];


// Student `id`'s page with `record`; every GET of the answers —
// the review's on page load, the summary grid's, a remounted
// review's — answers `answers`. Resolves once the record is in
// (the blur is gone)
const renderStudent = async ({ id = 5, record = fx.studentDetail({ id }), answers = [], toaster = false } = {}) => {
  backend.on("GET", `/api/admin/students/${id}`, reply.json(record));
  backend.on("GET", `/api/admin/students/${id}/answers`, reply.json(answers));

  const result = renderPage(<StudentInformation />, {
    path: "/admin/students/:studentID",
    url: `/admin/students/${id}`,
    toaster,
  });
  await waitFor(() => expect(page()).not.toHaveClass(BLUR));

  return result;
};

// Student 5's page with `answers`, switched to "Testo
// Apibendrinimas"; resolves once the grid shows every answer
const openSummary = async (answers) => {
  const result = await renderStudent({ answers });
  await screen.findByText(`Klausimas #${answers[0].id}`);

  await result.user.click(tab("Testo Apibendrinimas"));
  await waitFor(() => expect(gridRowIds()).toEqual(answers.map((answer) => String(answer.id))));

  return result;
};


// The page body inside the layout — the element that blurs
const page = () => screen.getByText("Studento Informacija").closest(".p-5");

// A profile-card row's value, by its label ("ID:", ...)
const accountRow = (label) => screen.getByText(label).nextElementSibling.textContent;

const username = () => screen.getByRole("heading", { level: 1 });

// The grade tile — the one with the graduation cap: icon, label,
// the grade
const gradeTile = () => screen.getByTestId("SchoolIcon").parentElement.parentElement;

// A count tile by its title: icon, label, value, bar, percentage
const readTile = (title) => {
  const [, , value, bar, percent] = screen.getByTitle(title).children;
  return { value: value.textContent, percent: percent.textContent, bar: bar.firstElementChild.style.width };
};

const tab = (name) => screen.getByRole("tab", { name });

const deleteButton = () => screen.getByRole("button", { name: "Ištrinti Studentą" });

const retryButton = () => screen.findByRole("button", { name: "Bandyti dar kartą" });

// What a failed load of the record / the summary grid's answers
// says instead — and a record the backend no longer has (404)
const RECORD_FAILED = "Nepavyko įkelti studento duomenų";
const ANSWERS_FAILED = "Nepavyko įkelti atsakymų";
const STUDENT_GONE = "Studentas nerastas";

// A load lost on the way — the server's or the network's fault
const LOAD_FAILURES = [
  ["a server error", reply.status(500, "Internal Server Error")],
  ["a network failure", reply.networkError()],
];

// The summary grid (mounted on its tab only): the data rows in
// screen order — the header row carries no data-id — and cells
const gridRowIds = () => [...document.querySelectorAll('[role="row"][data-id]')].map((row) => row.getAttribute("data-id"));

const gridCell = (id, field) => document.querySelector(`[role="row"][data-id="${id}"] [role="gridcell"][data-field="${field}"]`);

const headerTitles = () =>
  [...document.querySelectorAll('[role="columnheader"] .MuiDataGrid-columnHeaderTitle')].map((title) => title.textContent);

// The verdict colors an element carries — exactly one is expected
const colorsOf = (element) => ["bg-green-600", "bg-amber-500", "bg-red-500"].filter((name) => element.classList.contains(name));

// `total` options that should all be ticked, the first `missed`
// left unticked
const optionsMissing = (total, missed) =>
  Array.from({ length: total }, (_, index) => fx.answeredOption({
    optiontext: `Požymis Nr. ${index + 1}`,
    rightansweroption: 1,
    selectedansweroption: index < missed ? 0 : 1,
  }));

// jsdom versions spell a CSS color differently (#ebecef or
// rgb(…)) — spell the expected one the way the page's is
const cssColor = (value) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = value;
  return probe.style.backgroundColor;
};







// -----------------------------------------------------------
// Loading the page
// -----------------------------------------------------------

describe("StudentInformation — loading the page", () => {

  it("asks GET /api/admin/students/5 and the review's GET .../answers, each once with the session cookie — nothing else", async () => {
    await renderStudent({ answers: [fx.studentAnswer({ id: 11 })] });
    await screen.findByText("Klausimas #11");
    await settle();

    expect(backend.requests()).toHaveLength(2);
    for (const url of [RECORD, ANSWERS]) {
      const requests = backend.requests("GET", url);
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url, withCredentials: true });
      expect(requests[0].body).toBeUndefined();
    }
  });


  it("renders blurred (blur-[5px]) until the record arrives — the route's ID already in place", async () => {
    const record = deferred();
    backend.on("GET", RECORD, () => record.promise);
    backend.on("GET", ANSWERS, reply.json([]));
    renderPage(<StudentInformation />, { path: "/admin/students/:studentID", url: "/admin/students/5" });
    await waitFor(() => expect(backend.requests("GET", RECORD)).toHaveLength(1));
    await settle();

    expect(page()).toHaveClass(BLUR);
    expect(accountRow("ID:")).toBe("5");
    expect(username()).toBeEmptyDOMElement();

    await act(async () => record.resolve(reply.json(fx.studentDetail({ username: "JONAS_JONAITIS" }))));

    await waitFor(() => expect(page()).not.toHaveClass(BLUR));
    expect(username().textContent).toBe("JONAS_JONAITIS");
  });


  it("sends an expired session (401 on the record) to /login with a full page load — the page stays blurred", async () => {
    backend.on("GET", RECORD, reply.status(401, "Unauthorized"));
    backend.on("GET", ANSWERS, reply.json([]));
    renderPage(<StudentInformation />, { path: "/admin/students/:studentID", url: "/admin/students/5" });

    // The target is pinned, not how often it is set
    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();

    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(page()).toHaveClass(BLUR);
  });


  it.each(LOAD_FAILURES)("a record lost to %s shows 'Nepavyko įkelti studento duomenų' with 'Bandyti dar kartą' in place of the profile card and the tiles", async (_, failure) => {
    backend.on("GET", RECORD, failure);
    backend.on("GET", ANSWERS, reply.json([]));
    renderPage(<StudentInformation />, { path: "/admin/students/:studentID", url: "/admin/students/5" });

    expect(await screen.findByText(RECORD_FAILED)).toBeInTheDocument();
    expect(await retryButton()).toBeInTheDocument();
    expect(page()).not.toHaveClass(BLUR);

    // No blank profile, no invented 0 grade or 0 / 0 tiles
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByText("ID:")).toBeNull();
    expect(screen.queryByTestId("SchoolIcon")).toBeNull();
    expect(screen.queryByTitle(FULLY_CORRECT)).toBeNull();

    // Unlike a 404, the delete button and the result tabs stay
    expect(deleteButton()).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });


  it("a record answered 404 — the student is gone (deleted, a stale link) — leaves the heading and 'Studentas nerastas': no retry, no delete, no tabs", async () => {
    backend.on("GET", RECORD, reply.text("Error: Student not found", 404));
    // The review asks on mount, before the 404 is in; the answers
    // of a student who is gone come back empty
    backend.on("GET", ANSWERS, reply.json([]));
    renderPage(<StudentInformation />, { path: "/admin/students/:studentID", url: "/admin/students/5" });

    expect(await screen.findByText(STUDENT_GONE)).toBeInTheDocument();
    await settle();

    expect(screen.getByRole("heading", { name: "Studento Informacija" })).toBeInTheDocument();
    expect(page()).not.toHaveClass(BLUR);
    expect(screen.queryByRole("button", { name: "Bandyti dar kartą" })).toBeNull();
    expect(screen.queryByText(RECORD_FAILED)).toBeNull();

    // Nothing left to show, delete or review
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByTestId("SchoolIcon")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ištrinti Studentą" })).toBeNull();
    expect(screen.queryAllByRole("tab")).toEqual([]);
    expect(backend.requests("GET", RECORD)).toHaveLength(1);
  });


  it("'Bandyti dar kartą' asks for the record again — and shows it once it arrives", async () => {
    backend.once("GET", RECORD, reply.status(500, "Internal Server Error"));
    backend.on("GET", RECORD, reply.json(fx.studentDetail({ username: "JONAS_JONAITIS", testgrade: "7.50" })));
    backend.on("GET", ANSWERS, reply.json([]));
    const { user } = renderPage(<StudentInformation />, { path: "/admin/students/:studentID", url: "/admin/students/5" });

    await user.click(await retryButton());

    await waitFor(() => expect(username().textContent).toBe("JONAS_JONAITIS"));
    expect(gradeTile().lastElementChild.textContent).toBe("7.50");
    expect(screen.queryByText(RECORD_FAILED)).toBeNull();

    const requests = backend.requests("GET", RECORD);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ client: "axios", method: "GET", url: RECORD, withCredentials: true });
  });


  it("sits in the admin layout: the navbar, the sidebar with 'Studentai' lit, the grey content area", async () => {
    await renderStudent();

    expect(screen.getByAltText("VU logotipas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Studentai" }).querySelector("li")).toHaveClass(ACTIVE_TINT);
    expect(page().parentElement.style.backgroundColor).toBe(cssColor("#EBECEF"));
    expect(screen.getByRole("heading", { name: "Studento Informacija" })).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// The profile card
// -----------------------------------------------------------

describe("StudentInformation — the profile card", () => {

  it("shows the username, the ID, the login code and both times in Vilnius time", async () => {
    await renderStudent({
      record: fx.studentDetail({
        id: 5,
        username: "JONAS_JONAITIS",
        passcode: "48291037",
        registrationtime: "2026-08-26T18:55:00+03:00",
        lastseen: "2026-08-26T19:09:07+03:00",
      }),
    });

    expect(username().textContent).toBe("JONAS_JONAITIS");
    expect(accountRow("ID:")).toBe("5");
    expect(accountRow("Prisijungimo kodas:")).toBe("48291037");
    expect(accountRow("Registracijos laikas:")).toBe("2026-08-26 18:55:00");
    expect(accountRow("Paskutinįkart pastebėtas:")).toBe("2026-08-26 19:09:07");
  });


  it("sets the login code apart in a monospace pill — an admin reads it out to a student who lost it", async () => {
    await renderStudent({ record: fx.studentDetail({ passcode: "00417302" }) });

    expect(screen.getByText("00417302")).toHaveClass("font-mono");
  });


  it("prints winter (+02:00) times as Vilnius wall time too", async () => {
    await renderStudent({
      record: fx.studentDetail({ registrationtime: "2026-01-15T10:00:00+02:00", lastseen: "2026-02-01T08:05:09+02:00" }),
    });

    expect(accountRow("Registracijos laikas:")).toBe("2026-01-15 10:00:00");
    expect(accountRow("Paskutinįkart pastebėtas:")).toBe("2026-02-01 08:05:09");
  });


  it("shows '—' for times the API reports as null", async () => {
    await renderStudent({ record: fx.studentDetail({ registrationtime: null, lastseen: null }) });

    expect(accountRow("Registracijos laikas:")).toBe("—");
    expect(accountRow("Paskutinįkart pastebėtas:")).toBe("—");
  });


  it("keeps Lithuanian letters in the username", async () => {
    await renderStudent({ record: fx.studentDetail({ username: "ŽYDRŪNAS_ČIURLIONIS" }) });

    expect(username().textContent).toBe("ŽYDRŪNAS_ČIURLIONIS");
  });


  it("takes the ID from the URL: /admin/students/37 asks for student 37 and shows 'ID: 37'", async () => {
    await renderStudent({ id: 37, record: fx.studentDetail({ id: 37, username: "KITAS_STUDENTAS" }) });

    expect(backend.requests("GET", "/api/admin/students/37")).toHaveLength(1);
    expect(backend.requests("GET", "/api/admin/students/37/answers")).toHaveLength(1);
    expect(accountRow("ID:")).toBe("37");
    expect(username().textContent).toBe("KITAS_STUDENTAS");
  });
});







// -----------------------------------------------------------
// The summary tiles
// -----------------------------------------------------------

describe("StudentInformation — the summary tiles", () => {

  it.each(["7.50", "10.00", "0.00"])("the grade tile shows testgrade '%s' as the API sends it", async (testgrade) => {
    await renderStudent({ record: fx.studentDetail({ testgrade }) });

    expect(gradeTile().lastElementChild.textContent).toBe(testgrade);
  });


  it("the grade tile shows 0 for a student without a dealt test (testgrade \"\")", async () => {
    await renderStudent({ record: fx.blankStudentDetail() });

    expect(gradeTile().lastElementChild.textContent).toBe("0");
  });


  it("labels the tiles on two lines: Testo Įvertinimas, Viskas Teisinga, Teisingai Identifikuota, Teisingos Opcijos", async () => {
    await renderStudent();

    expect(gradeTile().children[1].innerHTML).toBe("Testo<br>Įvertinimas");
    expect(screen.getByTitle(FULLY_CORRECT).children[1].innerHTML).toBe("Viskas<br>Teisinga");
    expect(screen.getByTitle(IDENTIFIED).children[1].innerHTML).toBe("Teisingai<br>Identifikuota");
    expect(screen.getByTitle(OPTIONS).children[1].innerHTML).toBe("Teisingos<br>Opcijos");
  });


  it("'Viskas Teisinga' = fully correct of the dealt questions: 8 / 12 → 66.67 %", async () => {
    await renderStudent({ record: fx.studentDetail({ fullycorrectcount: 8, questioncount: 12 }) });

    expect(readTile(FULLY_CORRECT)).toEqual({ value: "8 / 12", percent: "66.67 %", bar: "66.67%" });
  });


  it("'Teisingai Identifikuota' = correctly identified of the dealt questions: 10 / 12 → 83.33 %", async () => {
    await renderStudent({ record: fx.studentDetail({ totalidentifiedcorrectly: 10, questioncount: 12 }) });

    expect(readTile(IDENTIFIED)).toEqual({ value: "10 / 12", percent: "83.33 %", bar: "83.33%" });
  });


  it("'Teisingos Opcijos' = correct options of the options scored: 27 / 30 → 90.00 %", async () => {
    await renderStudent({ record: fx.studentDetail({ totalcorrectoptionscount: 27, totaloptionscount: 30 }) });

    expect(readTile(OPTIONS)).toEqual({ value: "27 / 30", percent: "90.00 %", bar: "90%" });
  });


  it("a perfect test fills every bar: 12 / 12, 12 / 12, 30 / 30 → 100.00 %", async () => {
    await renderStudent({
      record: fx.studentDetail({
        questioncount: 12,
        answeredquestioncount: 12,
        fullycorrectcount: 12,
        fullycorrectpercentage: 100,
        totalidentifiedcorrectly: 12,
        totaloptionscount: 30,
        totalcorrectoptionscount: 30,
        testgrade: "10.00",
      }),
    });

    expect(gradeTile().lastElementChild.textContent).toBe("10.00");
    expect(readTile(FULLY_CORRECT)).toEqual({ value: "12 / 12", percent: "100.00 %", bar: "100%" });
    expect(readTile(IDENTIFIED)).toEqual({ value: "12 / 12", percent: "100.00 %", bar: "100%" });
    expect(readTile(OPTIONS)).toEqual({ value: "30 / 30", percent: "100.00 %", bar: "100%" });
  });


  it("nothing identified: 0 / 12 reads 0.00 %, and 0 / 0 scored options 0.00 % too — no division by zero", async () => {
    await renderStudent({
      record: fx.studentDetail({
        questioncount: 12,
        answeredquestioncount: 12,
        fullycorrectcount: 0,
        fullycorrectpercentage: 0,
        totalidentifiedcorrectly: 0,
        totaloptionscount: 0,
        totalcorrectoptionscount: 0,
        testgrade: "0.00",
      }),
    });

    expect(readTile(FULLY_CORRECT)).toEqual({ value: "0 / 12", percent: "0.00 %", bar: "0%" });
    expect(readTile(IDENTIFIED)).toEqual({ value: "0 / 12", percent: "0.00 %", bar: "0%" });
    expect(readTile(OPTIONS)).toEqual({ value: "0 / 0", percent: "0.00 %", bar: "0%" });
  });


  it("a student without a dealt test (the blank-field contract, \"\") reads 0 / 0 and 0.00 % on every tile", async () => {
    await renderStudent({ record: fx.blankStudentDetail() });

    for (const title of [FULLY_CORRECT, IDENTIFIED, OPTIONS]) {
      expect(readTile(title)).toEqual({ value: "0 / 0", percent: "0.00 %", bar: "0%" });
    }
  });


  it("explains each count tile on hover — its title", async () => {
    await renderStudent();

    for (const title of [FULLY_CORRECT, IDENTIFIED, OPTIONS]) {
      expect(screen.getByTitle(title)).toHaveClass("cursor-help");
    }
  });
});







// -----------------------------------------------------------
// The result tabs
// -----------------------------------------------------------

describe("StudentInformation — the result tabs", () => {

  it("offers 'Atsakymai' — selected — and 'Testo Apibendrinimas'", async () => {
    await renderStudent();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((element) => element.textContent)).toEqual(["Atsakymai", "Testo Apibendrinimas"]);
    expect(tabs.map((element) => element.getAttribute("aria-selected"))).toEqual(["true", "false"]);
  });


  it("'Atsakymai' holds the answer review — a card per graded question — and no grid", async () => {
    await renderStudent({
      answers: [fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12, isphishinganswer: 0, answerpoints: "0.00" })],
    });

    expect(await screen.findByText("Klausimas #11")).toBeInTheDocument();
    expect(screen.getByText("Klausimas #12")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).toBeNull();
  });


  it("'Testo Apibendrinimas' mounts the summary grid — with its own GET of the answers — and unmounts the review", async () => {
    const { user } = await renderStudent({ answers: [fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12 })] });
    await screen.findByText("Klausimas #11");
    expect(backend.requests("GET", ANSWERS)).toHaveLength(1);

    await user.click(tab("Testo Apibendrinimas"));

    await waitFor(() => expect(gridRowIds()).toEqual(["11", "12"]));
    expect(tab("Testo Apibendrinimas")).toHaveAttribute("aria-selected", "true");
    expect(tab("Atsakymai")).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByText(/^Klausimas #/)).toBeNull();

    const requests = backend.requests("GET", ANSWERS);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ client: "axios", method: "GET", url: ANSWERS, withCredentials: true });
  });


  it("the summary grid shows a progress bar while its answers load", async () => {
    const gridAnswers = deferred();
    backend.on("GET", RECORD, reply.json(fx.studentDetail()));
    backend.once("GET", ANSWERS, reply.json([fx.studentAnswer({ id: 11 })]));
    backend.once("GET", ANSWERS, () => gridAnswers.promise);
    const { user } = renderPage(<StudentInformation />, { path: "/admin/students/:studentID", url: "/admin/students/5" });
    await screen.findByText("Klausimas #11");

    await user.click(tab("Testo Apibendrinimas"));
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(2));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(gridRowIds()).toEqual([]);

    await act(async () => gridAnswers.resolve(reply.json([fx.studentAnswer({ id: 11 })])));

    await waitFor(() => expect(gridRowIds()).toEqual(["11"]));
    expect(screen.queryByRole("progressbar")).toBeNull();
  });


  it("back on 'Atsakymai' the review returns — with a fresh GET — and the grid is gone", async () => {
    const { user } = await openSummary([fx.studentAnswer({ id: 11 })]);

    await user.click(tab("Atsakymai"));

    expect(await screen.findByText("Klausimas #11")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).toBeNull();
    expect(backend.requests("GET", ANSWERS)).toHaveLength(3);
  });
});







// -----------------------------------------------------------
// The summary grid
// -----------------------------------------------------------

describe("StudentInformation — the summary grid ('Testo Apibendrinimas')", () => {

  it("heads its columns ID, Laiškas, Identifikuota, Opcijos, Taškai", async () => {
    await openSummary([fx.studentAnswer({ id: 11 })]);

    expect(headerTitles()).toEqual(["ID", "Laiškas", "Identifikuota", "Opcijos", "Taškai"]);
  });


  it("prints each row's question id in the ID column — '#11', '#12'", async () => {
    await openSummary([fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12 })]);

    expect([11, 12].map((id) => gridCell(id, "id").textContent)).toEqual(["#11", "#12"]);
  });


  it("lists one row per answer in the API's order, each with its email as a thumbnail", async () => {
    await openSummary([18, 11, 13].map((id) => fx.studentAnswer({ id })));

    expect(gridRowIds()).toEqual(["18", "11", "13"]);
    expect([18, 11, 13].map((id) => gridCell(id, "phishingpicture").querySelector("img").getAttribute("src"))).toEqual([
      "/api/phishingpictures/18",
      "/api/phishingpictures/11",
      "/api/phishingpictures/13",
    ]);
  });


  it("'Teisingai' in green with a check when the verdict matches, 'Neteisingai' in red with a cross when it does not — or was never given", async () => {
    await openSummary([
      fx.studentAnswer({ id: 11, isphishing: 1, isphishinganswer: 1, answerpoints: "1.00" }),
      fx.studentAnswer({ id: 12, isphishing: 0, isphishinganswer: 0, answerpoints: "1.00" }),
      fx.studentAnswer({ id: 13, isphishing: 1, isphishinganswer: 0, answerpoints: "0.00" }),
      fx.studentAnswer({ id: 14, isphishing: 0, isphishinganswer: 1, answerpoints: "0.00" }),
      fx.studentAnswer({ id: 15, isphishing: 1, isphishinganswer: null, answerpoints: "0.00" }),
    ]);

    const verdicts = [11, 12, 13, 14, 15].map((id) => {
      const chip = gridCell(id, "identified").firstElementChild;
      const icon = ["CheckIcon", "CloseIcon"].filter((testId) => within(chip).queryByTestId(testId));
      return [chip.textContent, colorsOf(chip), icon];
    });
    expect(verdicts).toEqual([
      ["Teisingai", ["bg-green-600"], ["CheckIcon"]],
      ["Teisingai", ["bg-green-600"], ["CheckIcon"]],
      ["Neteisingai", ["bg-red-500"], ["CloseIcon"]],
      ["Neteisingai", ["bg-red-500"], ["CloseIcon"]],
      ["Neteisingai", ["bg-red-500"], ["CloseIcon"]],
    ]);
  });


  it("sums the options up in a mini bar 'correct / total' — green all right, amber some, red none", async () => {
    await openSummary([
      fx.studentAnswer({ id: 11, totaloptionscount: 2, correctoptionscount: 2, answerpoints: "1.00", answeredoptions: optionsMissing(2, 0) }),
      fx.studentAnswer({ id: 12, totaloptionscount: 2, correctoptionscount: 1, answerpoints: "0.90", answeredoptions: optionsMissing(2, 1) }),
      fx.studentAnswer({ id: 13, totaloptionscount: 2, correctoptionscount: 0, answerpoints: "0.80", answeredoptions: optionsMissing(2, 2) }),
    ]);

    const bars = [11, 12, 13].map((id) => {
      const optionsCell = gridCell(id, "correctoptionscount");
      const bar = optionsCell.querySelector("div[style]");
      return [optionsCell.textContent, colorsOf(bar), bar.style.width];
    });
    expect(bars).toEqual([
      ["2 / 2", ["bg-green-600"], "100%"],
      ["1 / 2", ["bg-amber-500"], "50%"],
      ["0 / 2", ["bg-red-500"], "0%"],
    ]);
  });


  it("shows the points as a '<points> tšk.' chip — green 1.00, amber partial, red 0.00", async () => {
    await openSummary([
      fx.studentAnswer({ id: 11, answerpoints: "1.00" }),
      fx.studentAnswer({ id: 12, answerpoints: "0.90", correctoptionscount: 1, answeredoptions: optionsMissing(2, 1) }),
      fx.studentAnswer({ id: 13, answerpoints: "0.10", totaloptionscount: 10, correctoptionscount: 1, answeredoptions: optionsMissing(10, 9) }),
      fx.studentAnswer({ id: 14, isphishinganswer: 0, answerpoints: "0.00" }),
    ]);

    const chips = [11, 12, 13, 14].map((id) => {
      const chip = gridCell(id, "answerpoints").firstElementChild;
      return [chip.textContent, colorsOf(chip)];
    });
    expect(chips).toEqual([
      ["1.00 tšk.", ["bg-green-600"]],
      ["0.90 tšk.", ["bg-amber-500"]],
      ["0.10 tšk.", ["bg-amber-500"]],
      ["0.00 tšk.", ["bg-red-500"]],
    ]);
  });


  it.each(LOAD_FAILURES)("answers lost to %s show 'Nepavyko įkelti atsakymų' with 'Bandyti dar kartą' instead of an empty grid", async (_, failure) => {
    const { user } = await renderStudent({ answers: [fx.studentAnswer({ id: 11 })] });
    await screen.findByText("Klausimas #11");
    backend.once("GET", ANSWERS, failure);

    await user.click(tab("Testo Apibendrinimas"));

    expect(await screen.findByText(ANSWERS_FAILED)).toBeInTheDocument();
    expect(await retryButton()).toBeInTheDocument();
    expect(screen.queryByRole("grid")).toBeNull();
  });


  it("'Bandyti dar kartą' asks for the answers again — and fills the grid", async () => {
    const { user } = await renderStudent({ answers: [fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12 })] });
    await screen.findByText("Klausimas #11");
    backend.once("GET", ANSWERS, reply.status(500, "Internal Server Error"));
    await user.click(tab("Testo Apibendrinimas"));

    await user.click(await retryButton());

    await waitFor(() => expect(gridRowIds()).toEqual(["11", "12"]));
    expect(screen.queryByText(ANSWERS_FAILED)).toBeNull();
    expect(backend.requests("GET", ANSWERS)).toHaveLength(3);
  });
});







// -----------------------------------------------------------
// Deleting the student
// -----------------------------------------------------------

describe("StudentInformation — deleting the student", () => {

  it("tells on hover that the button must be held", async () => {
    const { user } = await renderStudent();

    await user.hover(deleteButton());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Laikykite mygtuką, kad ištrintumėte studentą");
  });


  it("a 1.5 s hold POSTs /api/admin/students/5/delete — {} with the session cookie", async () => {
    backend.on("POST", DELETE, DELETED);
    const { location } = await renderStudent();

    longPress(deleteButton(), 1600);
    await waitFor(() => expect(location().pathname).toBe("/admin/students"));

    const requests = backend.requests("POST", DELETE);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "POST", url: DELETE, withCredentials: true });
    expect(requests[0].headers["content-type"]).toMatch(/^application\/json/);
    expect(requests[0].json).toEqual({});
  });


  it("then toasts 'Studentas ištrintas' and goes back to /admin/students without a page load", async () => {
    backend.on("POST", DELETE, DELETED);
    // The page's own <Toaster/> leaves together with the page; in
    // the app the students list's layout mounts the next one, which
    // shows the toast — renderPage's stands in for it here
    const { location } = await renderStudent({ toaster: true });

    longPress(deleteButton(), 1600);
    // The navigation (a router transition, started after the reply)
    // is on screen — and the page's <Toaster/> gone — once it has
    // committed; the router location is recorded while rendering
    await waitFor(() => expect(screen.getByTestId("other-route")).toBeInTheDocument());
    expect(location().pathname).toBe("/admin/students");

    await findToast("Studentas ištrintas");
    expect(toastTexts()).toEqual(["Studentas ištrintas"]);
    expect(hardNavigations()).toEqual([]);
  });


  it("toasts and leaves only once the backend has confirmed", async () => {
    const deletion = deferred();
    backend.once("POST", DELETE, () => deletion.promise);
    const { location } = await renderStudent({ toaster: true });

    longPress(deleteButton(), 1600);
    await waitFor(() => expect(backend.requests("POST", DELETE)).toHaveLength(1));
    await settle();

    expect(location().pathname).toBe("/admin/students/5");
    expect(toastTexts()).toEqual([]);

    await act(async () => deletion.resolve(DELETED));

    await waitFor(() => expect(location().pathname).toBe("/admin/students"));
    await findToast("Studentas ištrintas");
  });


  it("disables 'Ištrinti Studentą' while the delete is on its way — a failed delete frees it again", async () => {
    const deletion = deferred();
    backend.once("POST", DELETE, () => deletion.promise);
    await renderStudent();

    // Looked up once: while held, the label drops out of the
    // button's name
    const button = deleteButton();
    expect(button).toBeEnabled();

    longPress(button, 1600);
    await waitFor(() => expect(backend.requests("POST", DELETE)).toHaveLength(1));

    expect(button).toBeDisabled();

    await act(async () => deletion.resolve(reply.status(500, "Internal Server Error")));
    await findToast("Nepavyko ištrinti studento");

    expect(button).toBeEnabled();
  });


  it("a second hold while the delete is on its way sends nothing — only the success is reported", async () => {
    const firstDelete = deferred();
    backend.once("POST", DELETE, () => firstDelete.promise);
    // A second delete would find the student gone
    backend.once("POST", DELETE, reply.text("Error: Student not found", 404));
    const { location } = await renderStudent({ toaster: true });

    // Looked up once, held twice
    const button = deleteButton();
    longPress(button, 1600);
    await waitFor(() => expect(backend.requests("POST", DELETE)).toHaveLength(1));

    longPress(button, 1600);
    await settle();

    await act(async () => firstDelete.resolve(DELETED));
    await waitFor(() => expect(location().pathname).toBe("/admin/students"));
    await findToast("Studentas ištrintas");
    await settle();

    expect(backend.requests("POST", DELETE)).toHaveLength(1);
    expect(toastTexts()).toEqual(["Studentas ištrintas"]);
  });


  it("sends an expired session (401 on the delete) to /login with a full page load — no failure toast", async () => {
    backend.on("POST", DELETE, reply.status(401, "Unauthorized"));
    const { location } = await renderStudent();

    longPress(deleteButton(), 1600);
    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();

    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(toastTexts()).toEqual([]);
    expect(location().pathname).toBe("/admin/students/5");
  });


  it.each(FAILURES)("a delete %s toasts 'Nepavyko ištrinti studento' and the page stays as it is", async (_, failure) => {
    backend.on("POST", DELETE, failure);
    const { location } = await renderStudent();

    longPress(deleteButton(), 1600);
    await findToast("Nepavyko ištrinti studento");
    await settle();

    expect(toastTexts()).toEqual(["Nepavyko ištrinti studento"]);
    expect(location().pathname).toBe("/admin/students/5");
    expect(screen.getByText("Studento Informacija")).toBeInTheDocument();
    expect(backend.lastRequest("POST", DELETE).json).toEqual({});
    // Nothing is reloaded after a failure
    expect(backend.requests("GET", RECORD)).toHaveLength(1);
  });


  it("a failed delete can be tried again with another hold", async () => {
    backend.once("POST", DELETE, reply.status(500, "Internal Server Error"));
    backend.on("POST", DELETE, DELETED);
    const { location } = await renderStudent();

    longPress(deleteButton(), 1600);
    await findToast("Nepavyko ištrinti studento");
    expect(location().pathname).toBe("/admin/students/5");

    longPress(deleteButton(), 1600);

    await waitFor(() => expect(location().pathname).toBe("/admin/students"));
    expect(backend.requests("POST", DELETE)).toHaveLength(2);
  });


  it("an early release toasts 'Laikykite mygtuką ilgiau, kad ištrintumėte studentą' and deletes nothing", async () => {
    const { location } = await renderStudent();

    longPress(deleteButton(), 800);
    await findToast("Laikykite mygtuką ilgiau, kad ištrintumėte studentą");
    await settle();

    expect(backend.requests("POST")).toEqual([]);
    expect(toastTexts()).toEqual(["Laikykite mygtuką ilgiau, kad ištrintumėte studentą"]);
    expect(location().pathname).toBe("/admin/students/5");
  });


  it("deletes the student of the URL — /admin/students/37 posts .../37/delete", async () => {
    backend.on("POST", "/api/admin/students/37/delete", DELETED);
    const { location } = await renderStudent({ id: 37 });

    longPress(deleteButton(), 1600);
    await waitFor(() => expect(location().pathname).toBe("/admin/students"));

    expect(backend.requests("POST").map((request) => request.url)).toEqual(["/api/admin/students/37/delete"]);
    expect(backend.lastRequest("POST", "/api/admin/students/37/delete").json).toEqual({});
  });
});
