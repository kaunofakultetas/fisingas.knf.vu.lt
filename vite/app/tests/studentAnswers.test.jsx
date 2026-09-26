// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — StudentAnswers, the answer review
//
//  src/systemPages/AdminPages/StudentInformation/
//  StudentAnswers/StudentAnswers.jsx — one card per graded
//  question; admins see it on StudentInformation
//  ("Atsakymai"), the student on TestFinish:
//    - GET /api/admin/students/<studentID>/answers (axios,
//      withCredentials, once); no cards until it answers, none
//      for []; a failed load (5xx / no connection) is no empty
//      review: "Nepavyko įkelti atsakymų" with a "Bandyti dar
//      kartą" that asks again
//    - the header: "Klausimas #<id>" (StudentAnswer's `id` —
//      the payload has no `questionid`), the identified chip
//      (isphishing === isphishinganswer) and the
//      "<answerpoints> tšk." chip — green 1.00, amber partial,
//      red 0.00 — matched by the card's left edge
//    - the comparison table: the "Teisingas" key cell is
//      neutral grey (check / dash), never judged; the
//      "Atsakyta" cell is green when it equals the key, red
//      when not, and a missed row gets a faint red wash; a
//      verdict never given (null) reads "Neatsakė"; an option
//      whose key was never set (null) counts as missed whatever
//      was ticked — like the backend's grading, so the red rows
//      match the points; options with the same text (e.g. two
//      left blank) are rows of their own
//    - the email screenshot /api/phishingpictures/<id>; its
//      link areas (fetch GET .../links) only once it loaded,
//      hovering an area shows its URL; clicks stay in the card
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { consoleErrors } from "./support/setup";
import { hardNavigations } from "./support/navigation";
import { renderPage, settle } from "./support/render";
import { linkAreas } from "./support/interactions";
import * as fx from "./support/fixtures";

import StudentAnswers from "@/systemPages/AdminPages/StudentInformation/StudentAnswers/StudentAnswers";


const ANSWERS = "/api/admin/students/5/answers";

const EMAIL_ALT = "Fišingo El. Laiškas";

// The faint red wash of a missed row
const WASH = "bg-red-50/60";


// Student 5's review with `answers` as the reply; resolves once
// the first card is on screen
const renderReview = async (answers) => {
  backend.on("GET", ANSWERS, reply.json(answers));
  const result = renderPage(<StudentAnswers studentID={5} />);
  await screen.findByText(`Klausimas #${answers[0].id}`);
  return result;
};

// The card of question `id` — the element carrying the colored
// left edge
const card = (id) => screen.getByText(`Klausimas #${id}`).closest(".border-l-4");

// The comparison row labeled `label` ("Ar tai fišingas?" or an
// option text) in `answerCard`, with its "Teisingas" (key) and
// "Atsakyta" (answered) cells
const comparisonRow = (answerCard, label) => {
  const row = within(answerCard).getByText(label).closest("tr");
  const [, key, answered] = row.children;
  return { row, key, answered };
};


// What a comparison cell shows: "check", "dash" or a chip's text
const markOf = (cell) => {
  if (within(cell).queryByTestId("CheckIcon")) return "check";
  if (within(cell).queryByTestId("RemoveIcon")) return "dash";
  return cell.textContent;
};

// How it is drawn: "key" (neutral grey), "correct" (green) or
// "wrong" (red)
const styleOf = (cell) => {
  const badge = cell.firstElementChild;
  if (badge.classList.contains("bg-gray-100")) return "key";
  if (badge.classList.contains("bg-green-600")) return "correct";
  if (badge.classList.contains("bg-red-500")) return "wrong";
  return badge.className;
};

const readCell = (cell) => ({ mark: markOf(cell), style: styleOf(cell) });


// The verdict colors an element carries (`prefix` "bg-" or
// "border-l-") — exactly one is expected
const colorsOf = (element, prefix) =>
  ["green-600", "amber-500", "red-500"].map((color) => prefix + color).filter((name) => element.classList.contains(name));

// `total` options that should all be ticked, the first `missed`
// of them left unticked — texts kept distinct, so every row can
// be looked up by its text
const optionsMissing = (total, missed) =>
  Array.from({ length: total }, (_, index) => fx.answeredOption({
    optiontext: `Požymis Nr. ${index + 1}`,
    rightansweroption: 1,
    selectedansweroption: index < missed ? 0 : 1,
  }));







// -----------------------------------------------------------
// Loading the answers
// -----------------------------------------------------------

describe("StudentAnswers — loading the answers", () => {

  // A number from TestFinish (authData.userid), a string route
  // param from StudentInformation — the same path either way
  it.each([5, "5"])("asks GET /api/admin/students/5/answers once, with the session cookie (studentID %j)", async (studentID) => {
    backend.on("GET", ANSWERS, reply.json([fx.studentAnswer({ id: 11 })]));
    renderPage(<StudentAnswers studentID={studentID} />);
    await screen.findByText("Klausimas #11");
    await settle();

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: ANSWERS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("shows no cards until the answers arrive", async () => {
    const slowAnswers = deferred();
    backend.on("GET", ANSWERS, () => slowAnswers.promise);
    renderPage(<StudentAnswers studentID={5} />);
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(1));

    expect(screen.queryByText(/^Klausimas #/)).toBeNull();
    expect(screen.queryByAltText(EMAIL_ALT)).toBeNull();

    await act(async () => slowAnswers.resolve(reply.json([fx.studentAnswer({ id: 11 })])));
    expect(await screen.findByText("Klausimas #11")).toBeInTheDocument();
  });


  it("renders no cards for an empty list — no test dealt yet", async () => {
    backend.on("GET", ANSWERS, reply.json([]));
    const { container } = renderPage(<StudentAnswers studentID={5} />);
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(1));
    await settle();

    expect(screen.queryByText(/^Klausimas #/)).toBeNull();
    expect(screen.queryByAltText(EMAIL_ALT)).toBeNull();
    expect(container.querySelector("table")).toBeNull();
  });


  it("a 401 sends the browser to /login", async () => {
    backend.on("GET", ANSWERS, reply.status(401, "Unauthorized"));
    renderPage(<StudentAnswers studentID={5} />);

    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();

    // Only the target is pinned, not how often it is set
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(screen.queryByText(/^Klausimas #/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });


  // An empty review means "no test dealt" — a failed load must
  // not look like one
  it.each([
    ["a server error (500)", reply.status(500, "Internal Server Error")],
    ["a bad gateway during a deploy (502)", reply.status(502, "Bad Gateway")],
    ["no connection", reply.networkError()],
  ])("%s says 'Nepavyko įkelti atsakymų' and offers a retry — not an empty review", async (_, failure) => {
    backend.on("GET", ANSWERS, failure);
    renderPage(<StudentAnswers studentID={5} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nepavyko įkelti atsakymų");
    expect(within(alert).getByRole("button", { name: "Bandyti dar kartą" })).toBeInTheDocument();
    expect(screen.queryByText(/^Klausimas #/)).toBeNull();
    expect(hardNavigations()).toEqual([]);
  });


  it("'Bandyti dar kartą' asks for the answers again and shows the cards once they arrive", async () => {
    backend.once("GET", ANSWERS, reply.status(500, "Internal Server Error"));
    backend.on("GET", ANSWERS, reply.json([fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12 })]));
    const { user } = renderPage(<StudentAnswers studentID={5} />);

    await user.click(await screen.findByRole("button", { name: "Bandyti dar kartą" }));

    expect(await screen.findByText("Klausimas #11")).toBeInTheDocument();
    expect(screen.getByText("Klausimas #12")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    const requests = backend.requests("GET", ANSWERS);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ client: "axios", withCredentials: true });
  });
});







// -----------------------------------------------------------
// The card header
// -----------------------------------------------------------

describe("StudentAnswers — the card header", () => {

  it("heads each card with 'Klausimas #<id>' — the payload's `id`, there is no questionid", async () => {
    await renderReview([fx.studentAnswer({ id: 37 })]);

    expect(screen.getByText("Klausimas #37")).toBeInTheDocument();
    expect(within(card(37)).getByAltText(EMAIL_ALT)).toHaveAttribute("src", "/api/phishingpictures/37");
  });


  it.each([
    ["a phishing email called phishing", "Identifikuota teisingai", 1, 1, "1.00", "bg-green-600", "CheckIcon"],
    ["a real email called real", "Identifikuota teisingai", 0, 0, "1.00", "bg-green-600", "CheckIcon"],
    ["a phishing email called real", "Identifikuota neteisingai", 1, 0, "0.00", "bg-red-500", "CloseIcon"],
    ["a real email called phishing", "Identifikuota neteisingai", 0, 1, "0.00", "bg-red-500", "CloseIcon"],
    ["a phishing email never answered", "Identifikuota neteisingai", 1, null, "0.00", "bg-red-500", "CloseIcon"],
  ])("%s → the '%s' chip", async (_, text, isphishing, isphishinganswer, answerpoints, color, icon) => {
    await renderReview([fx.studentAnswer({ id: 11, isphishing, isphishinganswer, answerpoints })]);

    const chip = within(card(11)).getByText(text);
    expect(colorsOf(chip, "bg-")).toEqual([color]);
    expect(within(chip).getByTestId(icon)).toBeInTheDocument();
    expect(within(card(11)).getAllByText(/^Identifikuota /)).toHaveLength(1);
  });


  // Options consistent with the points: 1 − 0.1 per missed
  // option when the verdict is right, 0 when it is wrong
  it.each([
    ["full points", "1.00", "green-600", 1, 2, 0],
    ["one option missed", "0.90", "amber-500", 1, 2, 1],
    ["two options missed", "0.80", "amber-500", 1, 3, 2],
    ["the lowest partial score", "0.10", "amber-500", 1, 10, 9],
    ["a wrong verdict", "0.00", "red-500", 0, 2, 0],
  ])("%s — %s tšk. → %s chip and left edge", async (_, answerpoints, color, isphishinganswer, total, missed) => {
    await renderReview([fx.studentAnswer({
      id: 11,
      isphishinganswer,
      answerpoints,
      totaloptionscount: total,
      correctoptionscount: total - missed,
      answeredoptions: optionsMissing(total, missed),
    })]);

    expect(colorsOf(within(card(11)).getByText(`${answerpoints} tšk.`), "bg-")).toEqual([`bg-${color}`]);
    expect(colorsOf(card(11), "border-l-")).toEqual([`border-l-${color}`]);
  });


  it("a right verdict can still score 0.00 (ten options missed) — the identified chip stays green, the points turn red", async () => {
    await renderReview([fx.studentAnswer({
      id: 11,
      answerpoints: "0.00",
      totaloptionscount: 10,
      correctoptionscount: 0,
      answeredoptions: optionsMissing(10, 10),
    })]);

    expect(colorsOf(within(card(11)).getByText("Identifikuota teisingai"), "bg-")).toEqual(["bg-green-600"]);
    expect(colorsOf(within(card(11)).getByText("0.00 tšk."), "bg-")).toEqual(["bg-red-500"]);
    expect(colorsOf(card(11), "border-l-")).toEqual(["border-l-red-500"]);
  });
});







// -----------------------------------------------------------
// The "Ar tai fišingas?" row
// -----------------------------------------------------------

describe("StudentAnswers — the 'Ar tai fišingas?' row", () => {

  it("labels the comparison columns Klausimas / Teisingas / Atsakyta", async () => {
    await renderReview([fx.studentAnswer({ id: 11 })]);

    const labels = [...card(11).querySelectorAll("thead td")].map((cell) => cell.textContent);
    expect(labels).toEqual(["Klausimas", "Teisingas", "Atsakyta"]);
  });


  it("shows the question's extra text under the heading — nothing when there is none", async () => {
    const questiontext = "Papildomai: ar „VU IT pagalba“ tikrai rašo iš universiteto domeno?";
    await renderReview([fx.studentAnswer({ id: 11, questiontext }), fx.studentAnswer({ id: 12, questiontext: "" })]);

    expect(within(card(11)).getByText("Ar tai fišingas?").nextElementSibling.textContent).toBe(questiontext);
    expect(within(card(12)).getByText("Ar tai fišingas?").nextElementSibling.textContent).toBe("");
  });


  it.each([
    ["a phishing email called phishing", "check", "check", "correct", false, 1, 1, "1.00"],
    ["a real email called real", "dash", "dash", "correct", false, 0, 0, "1.00"],
    ["a phishing email called real", "check", "dash", "wrong", true, 1, 0, "0.00"],
    ["a real email called phishing", "dash", "check", "wrong", true, 0, 1, "0.00"],
  ])("%s → key %s, answered %s (%s)", async (_, keyMark, answeredMark, style, washed, isphishing, isphishinganswer, answerpoints) => {
    await renderReview([fx.studentAnswer({ id: 11, isphishing, isphishinganswer, answerpoints })]);

    const { row, key, answered } = comparisonRow(card(11), "Ar tai fišingas?");
    expect(readCell(key)).toEqual({ mark: keyMark, style: "key" });
    expect(readCell(answered)).toEqual({ mark: answeredMark, style });
    expect(row.classList.contains(WASH)).toBe(washed);
  });


  it.each([
    ["phishing", 1, "check"],
    ["real", 0, "dash"],
  ])("an unanswered %s email → its key as always, a red 'Neatsakė' chip, a washed row", async (_, isphishing, keyMark) => {
    await renderReview([fx.studentAnswer({ id: 11, isphishing, isphishinganswer: null, answerpoints: "0.00" })]);

    const { row, key, answered } = comparisonRow(card(11), "Ar tai fišingas?");
    expect(readCell(key)).toEqual({ mark: keyMark, style: "key" });
    expect(readCell(answered)).toEqual({ mark: "Neatsakė", style: "wrong" });
    expect(row).toHaveClass(WASH);
  });


  it("draws the key neutral grey and the verdict solid green or red", async () => {
    await renderReview([
      fx.studentAnswer({ id: 11 }),
      fx.studentAnswer({ id: 12, isphishinganswer: 0, answerpoints: "0.00" }),
    ]);

    const right = comparisonRow(card(11), "Ar tai fišingas?");
    const wrong = comparisonRow(card(12), "Ar tai fišingas?");
    expect(right.key.firstElementChild).toHaveClass("bg-gray-100", "text-gray-500");
    expect(wrong.key.firstElementChild).toHaveClass("bg-gray-100", "text-gray-500");
    expect(right.answered.firstElementChild).toHaveClass("bg-green-600", "text-white");
    expect(wrong.answered.firstElementChild).toHaveClass("bg-red-500", "text-white");
  });
});







// -----------------------------------------------------------
// The option rows
// -----------------------------------------------------------

describe("StudentAnswers — the option rows", () => {

  // The payload the backend's own test pins (django/fisingas/
  // tests/test_admin_questions.py, StudentAnswersTests): the
  // verdict right, one option right, one ticked though it
  // should not be, one whose key was never set
  const BACKEND_EXAMPLE = fx.studentAnswer({
    id: 5,
    questiontext: "Ar fišingas?",
    isphishinganswer: 1,
    isphishing: 1,
    totaloptionscount: 3,
    correctoptionscount: 1,
    answerpoints: "0.80",
    answeredoptions: [
      fx.answeredOption({ optiontext: "teisingas", rightansweroption: 1, selectedansweroption: 1 }),
      fx.answeredOption({ optiontext: "klaidingas", rightansweroption: 0, selectedansweroption: 1 }),
      fx.answeredOption({ optiontext: "nenustatytas", rightansweroption: null, selectedansweroption: 0 }),
    ],
  });


  it("lists every option in the API's order, one row each, under the verdict row", async () => {
    const texts = [
      "Siuntėjo adresas neatitinka įmonės domeno",
      "Nuoroda veda į svetimą svetainę",
      "Skubinama: „paskyra bus užblokuota per 24 val.“",
      "Prašoma įvesti slaptažodį",
    ];
    await renderReview([fx.studentAnswer({
      id: 11,
      totaloptionscount: 4,
      correctoptionscount: 4,
      answeredoptions: texts.map((optiontext) => fx.answeredOption({ optiontext })),
    })]);

    const rows = [...card(11).querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText("Ar tai fišingas?")).toBeInTheDocument();
    expect(rows.slice(1).map((row) => row.firstElementChild.textContent)).toEqual(texts);
  });


  it("a question without options shows only the verdict row", async () => {
    await renderReview([fx.studentAnswer({ id: 11, totaloptionscount: 0, correctoptionscount: 0, answeredoptions: [] })]);

    const rows = card(11).querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Ar tai fišingas?")).toBeInTheDocument();
  });


  // Option texts are not unique — typically two options left
  // blank ("")
  it("shows two options with the same text as two rows — without a duplicate-key error", async () => {
    await renderReview([fx.studentAnswer({
      id: 11,
      answeredoptions: [
        fx.answeredOption({ optiontext: "", rightansweroption: 1, selectedansweroption: 1 }),
        fx.answeredOption({ optiontext: "", rightansweroption: 0, selectedansweroption: 1 }),
      ],
    })]);

    const rows = [...card(11).querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(3);
    expect(rows.slice(1).map((row) => styleOf(row.children[2]))).toEqual(["correct", "wrong"]);
    expect(consoleErrors().filter((message) => /same key/.test(message))).toEqual([]);
  });


  // Counts and points as the backend grades a one-option
  // question (1.00 right, 0.90 missed). A key never set (null)
  // is never right there (grading.py, OptionResult.is_correct),
  // so those rows are missed whatever was ticked
  it.each([
    ["ticked, as it should be", "check", "check", "correct", false, 1, 1],
    ["left unticked, as it should be", "dash", "dash", "correct", false, 0, 0],
    ["left unticked, though it should be ticked", "check", "dash", "wrong", true, 1, 0],
    ["ticked, though it should not be", "dash", "check", "wrong", true, 0, 1],
    ["left unticked, its key never set (null)", "dash", "dash", "wrong", true, null, 0],
    ["ticked, its key never set (null)", "dash", "check", "wrong", true, null, 1],
  ])("an option %s → key %s, answered %s (%s)", async (_, keyMark, answeredMark, style, washed, rightansweroption, selectedansweroption) => {
    const right = style === "correct";
    await renderReview([fx.studentAnswer({
      id: 11,
      totaloptionscount: 1,
      correctoptionscount: right ? 1 : 0,
      answerpoints: right ? "1.00" : "0.90",
      answeredoptions: [fx.answeredOption({ optiontext: "Nuoroda veda į svetimą svetainę", rightansweroption, selectedansweroption })],
    })]);

    const { row, key, answered } = comparisonRow(card(11), "Nuoroda veda į svetimą svetainę");
    expect(readCell(key)).toEqual({ mark: keyMark, style: "key" });
    expect(readCell(answered)).toEqual({ mark: answeredMark, style });
    expect(row.classList.contains(WASH)).toBe(washed);
  });


  it("marks red exactly the two options the backend's 0.80 points took off for", async () => {
    await renderReview([BACKEND_EXAMPLE]);
    const review = card(5);

    expect(colorsOf(within(review).getByText("0.80 tšk."), "bg-")).toEqual(["bg-amber-500"]);
    expect(colorsOf(review, "border-l-")).toEqual(["border-l-amber-500"]);
    expect(within(review).getByText("Ar fišingas?")).toBeInTheDocument();

    const verdicts = ["teisingas", "klaidingas", "nenustatytas"].map((text) => {
      const { row, answered } = comparisonRow(review, text);
      return [text, styleOf(answered), row.classList.contains(WASH)];
    });
    expect(verdicts).toEqual([
      ["teisingas", "correct", false],
      ["klaidingas", "wrong", true],
      ["nenustatytas", "wrong", true],
    ]);
  });
});







// -----------------------------------------------------------
// Several answers
// -----------------------------------------------------------

describe("StudentAnswers — several answers", () => {

  it("renders a whole 12-question test — one card per answer, in the API's order", async () => {
    // Deliberately unsorted: the review keeps whatever order the
    // backend sends
    const ids = [18, 11, 22, 13, 17, 12, 21, 14, 20, 15, 19, 16];
    await renderReview(ids.map((id) => fx.studentAnswer({ id })));

    const headers = screen.getAllByText(/^Klausimas #\d+$/).map((header) => header.textContent);
    expect(headers).toEqual(ids.map((id) => `Klausimas #${id}`));

    const images = screen.getAllByAltText(EMAIL_ALT).map((image) => image.getAttribute("src"));
    expect(images).toEqual(ids.map((id) => `/api/phishingpictures/${id}`));
  });


  it("judges every card on its own answer", async () => {
    await renderReview([
      fx.studentAnswer({ id: 11 }),
      fx.studentAnswer({ id: 12, isphishing: 0, isphishinganswer: 1, answerpoints: "0.00" }),
    ]);

    expect(within(card(11)).getByText("Identifikuota teisingai")).toBeInTheDocument();
    expect(within(card(12)).getByText("Identifikuota neteisingai")).toBeInTheDocument();
    expect(colorsOf(card(11), "border-l-")).toEqual(["border-l-green-600"]);
    expect(colorsOf(card(12), "border-l-")).toEqual(["border-l-red-500"]);
    expect(comparisonRow(card(11), "Ar tai fišingas?").row).not.toHaveClass(WASH);
    expect(comparisonRow(card(12), "Ar tai fišingas?").row).toHaveClass(WASH);
  });
});







// -----------------------------------------------------------
// The email screenshot
// -----------------------------------------------------------

describe("StudentAnswers — the email screenshot", () => {

  it("fetches no link areas before an email image has loaded", async () => {
    await renderReview([fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12 })]);
    await settle();

    expect(backend.requests("GET", /\/links$/)).toHaveLength(0);
  });


  it("a loaded image fetches its own link areas; hovering one shows its URL", async () => {
    backend.on("GET", "/api/phishingpictures/12/links", reply.json([
      fx.questionLink({ id: 1, url: "https://vu-lt.prisijungimas.example/slaptazodis" }),
      fx.questionLink({ id: 2, url: "https://mif.vu.lt", y: "80%" }),
    ]));
    await renderReview([fx.studentAnswer({ id: 11 }), fx.studentAnswer({ id: 12 })]);
    const second = card(12);

    fireEvent.load(within(second).getByAltText(EMAIL_ALT));
    await waitFor(() => expect(linkAreas(second)).toHaveLength(2));

    const requests = backend.requests("GET", /\/links$/);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "fetch", method: "GET", url: "/api/phishingpictures/12/links" });
    expect(requests[0].credentials).toBeUndefined();
    expect(linkAreas(card(11))).toHaveLength(0);

    fireEvent.mouseEnter(linkAreas(second)[0]);
    expect(within(second).getByText("https://vu-lt.prisijungimas.example/slaptazodis")).toBeInTheDocument();
    expect(within(second).queryByText("https://mif.vu.lt")).toBeNull();
  });


  it("keeps a click on the email inside the card", async () => {
    backend.on("GET", ANSWERS, reply.json([fx.studentAnswer({ id: 11 })]));
    const pageClick = vi.fn();
    renderPage(<div onClick={pageClick}><StudentAnswers studentID={5} /></div>);

    fireEvent.click(await screen.findByAltText(EMAIL_ALT));
    expect(pageClick).not.toHaveBeenCalled();

    // Elsewhere on the card a click does reach the page
    fireEvent.click(screen.getByText("Klausimas #11"));
    expect(pageClick).toHaveBeenCalledTimes(1);
  });
});
