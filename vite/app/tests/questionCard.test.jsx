// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — QuestionCard, the self-saving
//      question editor
//
//  src/systemPages/AdminPages/Questions/QuestionsList/
//  QuestionCard/QuestionCard.jsx — one question of the bank:
//    - header: "Klausimas #<id>", "Sukurtas: <Vilnius time>"
//      ("—" for a null `created`), the enabled switch
//      ("Įjungtas" / "Išjungtas"), a disabled question's badge
//      and dimmed (opacity-70) card
//    - editor: "Papildomai" text, the is-phishing checkbox, one
//      row per option ("Opcija Nr.: <optionid>" + right-answer
//      checkbox — ticked only for 1, never for 0 / null)
//    - AUTOSAVE, no save button: nothing on mount; an edit shows
//      "Saugoma…" at once, and 500 ms after the LAST edit ONE
//      POST /api/admin/questions/updatequestion (withCredentials)
//        {questionid, isenabled, isphishing, questiontext,
//         questionoptions: [{optionid, optiontext,
//         rightoptionanswer}]}             (never `created`)
//      → "Išsaugota"; a failure toasts "Nepavyko išsaugoti
//      klausimo #<id>" and clears the status (no retry)
//    - POST .../createnewoption {questionid} → {new_option_id}
//      → an empty, unticked row that joins the autosave
//    - hold-to-delete (1.5 s): POST .../deleteoption {optionid}
//      (the row leaves, autosave) and POST .../deletequestion
//      {questionid} (→ list reload) — success is announced only
//      after the backend confirmed
//    - "Redaguoti Nuorodas" → the fullscreen link editor,
//      portalled onto <body>; "Atgal" or a save closes it and
//      reloads the list
//    - the card keeps its OWN copy of the question: a list
//      reload (new prop) changes nothing, unsaved edits survive
//    - the preview fetches its link areas once its image loads
//
//  The autosave tests fake only setTimeout / clearTimeout and
//  drive the debounce by hand (fireEvent + synchronous queries
//  while faked); the hold-to-delete tests run on real timers,
//  except where the autosave after a deletion is timed — those
//  share one fake clock (setTimeout + Date +
//  requestAnimationFrame) with longPress().
//
//  The card's known defects are pinned in knownBugs.test.jsx —
//  not here: KB-08 (the preview keeps its old areas after the
//  editor closes), KB-25 (an edit still in the debounce is
//  dropped when the card unmounts), KB-26 / KB-27 (overlapping
//  saves — "Išsaugota" too early, an older state winning) and
//  KB-36 (a 401 only toasts). So no test here lets a save
//  overlap a newer edit or answers one with 401, and every test
//  that ends with an edit still in the debounce declares the
//  save route — a KB-25 fix sends that save on unmount.
// -----------------------------------------------------------

import "./support/setup";

import { useState } from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { linkAreas, longPress } from "./support/interactions";
import * as fx from "./support/fixtures";

import QuestionCard from "@/systemPages/AdminPages/Questions/QuestionsList/QuestionCard/QuestionCard";


const UPDATE = "/api/admin/questions/updatequestion";
const CREATE_OPTION = "/api/admin/questions/createnewoption";
const DELETE_OPTION = "/api/admin/questions/deleteoption";
const DELETE_QUESTION = "/api/admin/questions/deletequestion";
const QUESTION_LINKS = "/api/phishingpictures/21/links";


// fx.adminQuestion()'s two options (question 21) as the save
// payload carries them
const OPTION_211 = { optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: 1 };
const OPTION_212 = { optionid: 212, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 0 };


// The documented refusals of the admin mutations (a malformed
// body, a non-admin session) plus what the infrastructure adds
const FAILURES = [
  ["HTTP 400 (malformed body)", reply.text("Error: Invalid request body", 400)],
  ["HTTP 403 (not an admin)", reply.text("Error: Not Admin", 403)],
  ["HTTP 500", reply.status(500, "Internal Server Error")],
  ["a network error", reply.networkError()],
];


// A card for fx.adminQuestion(overrides); the list-reload
// callback is a spy
const renderCard = (overrides = {}) => {
  const triggerQuestionListUpdate = vi.fn();
  const result = renderPage(
    <QuestionCard fetchedQuestionData={fx.adminQuestion(overrides)} triggerQuestionListUpdate={triggerQuestionListUpdate} />,
    { toaster: true }
  );
  return { ...result, triggerQuestionListUpdate };
};

const savesSucceed = () => backend.on("POST", UPDATE, reply.json({ status: "ok" }));

const savePayload = () => backend.lastRequest("POST", UPDATE)?.json;


// Only the debounce's setTimeout / clearTimeout are faked — the
// fake backend answers on promises, which keep resolving. While
// faked: fireEvent + synchronous queries only (findBy, waitFor
// and user-event would wait on the frozen setTimeout)
const useFakeDebounce = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

// The same plus Date + requestAnimationFrame: ONE fake clock for
// a hold-to-delete (longPress() reuses it) and the autosave
// debounce that follows the deletion
const useFakeClock = () =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });

const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));


// The card's root — the white panel a disabled question dims
// (the header strip above it has its own grey background)
const card = () => screen.getByText(/^Klausimas #/).closest(".bg-white");

const enabledSwitch = () => screen.getByRole("switch");

const questionDeleteButton = () => screen.getByRole("button", { name: "Ištrinti" });

const descriptionField = () => screen.getByLabelText("Papildomai");

// The headline row holds the "Papildomai" field and the big
// is-phishing checkbox
const isPhishingCheckbox = () =>
  within(screen.getByText("Ar tai fišingas?").parentElement.parentElement).getByRole("checkbox");

const optionField = (optionid) => screen.getByLabelText(`Opcija Nr.: ${optionid}`);

const optionLabels = () => screen.queryAllByText(/^Opcija Nr\.: /).map((label) => label.textContent);

// One option row: its text field, its hold-to-delete button
// (icon only, so no name) and its right-answer checkbox
const optionRow = (optionid) => optionField(optionid).closest(".MuiTextField-root").parentElement;

const rightAnswerCheckbox = (optionid) => within(optionRow(optionid)).getByRole("checkbox");

const optionDeleteButton = (optionid) => within(optionRow(optionid)).getByRole("button");

const addOptionButton = () => screen.getByRole("button", { name: "Sukurti naują opciją" });

const linkEditorButton = () => screen.getByRole("button", { name: "Redaguoti Nuorodas" });

const linkEditorOverlay = () => screen.getByText("Nuorodų Redagavimas").closest(".fixed");


// Stands in for QuestionsList across a reload: the SAME card
// (same position in the tree) handed a NEW question object.
// The <output> shows what the list itself holds by then
let reloadList;

function ReloadableCard({ initial }) {
  const [question, setQuestion] = useState(initial);
  reloadList = setQuestion;

  return (
    <>
      <output data-testid="list-copy">{question.questiontext}</output>
      <QuestionCard fetchedQuestionData={question} triggerQuestionListUpdate={() => {}} />
    </>
  );
}

const reloadListWith = (question) => act(() => {
  reloadList(question);
});







// -----------------------------------------------------------
// Header
// -----------------------------------------------------------

describe("QuestionCard — header", () => {

  it("shows the question ID and its creation time in Vilnius time", () => {
    renderCard({ questionid: 37, created: "2026-08-26T19:09:07+03:00" });

    expect(screen.getByText("Klausimas #37")).toBeInTheDocument();
    expect(screen.getByText("Sukurtas: 2026-08-26 19:09:07")).toBeInTheDocument();
  });


  it("prints a winter (+02:00) creation time as Vilnius wall time too", () => {
    renderCard({ created: "2026-01-15T10:00:00+02:00" });

    expect(screen.getByText("Sukurtas: 2026-01-15 10:00:00")).toBeInTheDocument();
  });


  it("shows 'Sukurtas: —' for a question older than the created column (null)", () => {
    renderCard({ created: null });

    expect(screen.getByText("Sukurtas: —")).toBeInTheDocument();
  });


  it("an enabled question: switch on, 'Įjungtas', no badge, card not dimmed", () => {
    renderCard({ isenabled: 1 });

    expect(enabledSwitch()).toBeChecked();
    expect(screen.getByText("Įjungtas")).toBeInTheDocument();
    expect(screen.queryByText("Išjungtas — studentams nerodomas")).toBeNull();
    expect(card()).not.toHaveClass("opacity-70");
  });


  it("a disabled question: switch off, 'Išjungtas', the not-shown-to-students badge and a dimmed card", () => {
    renderCard({ isenabled: 0 });

    expect(enabledSwitch()).not.toBeChecked();
    expect(screen.getByText("Išjungtas")).toBeInTheDocument();
    expect(screen.getByText("Išjungtas — studentams nerodomas")).toBeInTheDocument();
    expect(card()).toHaveClass("opacity-70");
  });


  it("explains the switch as 'Ar klausimas dalinamas studentams' (label and hover tooltip)", async () => {
    const { user } = renderCard();

    expect(screen.getByLabelText("Ar klausimas dalinamas studentams")).toContainElement(enabledSwitch());

    await user.hover(screen.getByText("Įjungtas"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ar klausimas dalinamas studentams");
  });


  it("tells on hover that the delete button must be held", async () => {
    const { user } = renderCard();

    await user.hover(questionDeleteButton());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Laikykite mygtuką, kad ištrintumėte klausimą");
  });
});







// -----------------------------------------------------------
// The editor fields
// -----------------------------------------------------------

describe("QuestionCard — the editor fields", () => {

  it("prefills 'Papildomai' with the question text", () => {
    renderCard({ questiontext: "Atkreipkite dėmesį į siuntėjo adresą" });

    expect(descriptionField()).toHaveValue("Atkreipkite dėmesį į siuntėjo adresą");
  });


  it("leaves 'Papildomai' empty for a question without extra text (\"\")", () => {
    renderCard({ questiontext: "" });

    expect(descriptionField()).toHaveValue("");
  });


  it.each([
    [1, "ticked", true],
    [0, "unticked", false],
  ])("shows isphishing %i as a %s is-phishing checkbox", (isphishing, _, ticked) => {
    renderCard({ isphishing });

    expect(isPhishingCheckbox().checked).toBe(ticked);
  });


  it("shows one row per option in API order, labelled 'Opcija Nr.: <optionid>' and prefilled with its text", () => {
    renderCard({
      questionoptions: [
        fx.adminOption({ optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno" }),
        fx.adminOption({ optionid: 212, optiontext: "Nuoroda veda į svetimą svetainę" }),
        fx.adminOption({ optionid: 213, optiontext: "Raginama „skubiai“ patvirtinti slaptažodį" }),
      ],
    });

    expect(optionLabels()).toEqual(["Opcija Nr.: 211", "Opcija Nr.: 212", "Opcija Nr.: 213"]);
    expect(optionField(211)).toHaveValue("Siuntėjo adresas neatitinka įmonės domeno");
    expect(optionField(212)).toHaveValue("Nuoroda veda į svetimą svetainę");
    expect(optionField(213)).toHaveValue("Raginama „skubiai“ patvirtinti slaptažodį");
  });


  it("ticks the right-answer checkbox only for rightoptionanswer 1 — 0 and null (never set) stay unticked", () => {
    renderCard({
      questionoptions: [
        fx.adminOption({ optionid: 211, rightoptionanswer: 1 }),
        fx.adminOption({ optionid: 212, rightoptionanswer: 0 }),
        fx.adminOption({ optionid: 213, rightoptionanswer: null }),
      ],
    });

    expect(rightAnswerCheckbox(211)).toBeChecked();
    expect(rightAnswerCheckbox(212)).not.toBeChecked();
    expect(rightAnswerCheckbox(213)).not.toBeChecked();
  });


  it("shows no option rows for a question without options — only the add button", () => {
    renderCard({ questionoptions: [] });

    expect(optionLabels()).toEqual([]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(addOptionButton()).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Autosave — timing and status
// -----------------------------------------------------------

describe("QuestionCard — autosave timing and status", () => {

  beforeEach(() => {
    useFakeDebounce();
  });


  it("sends nothing on mount and shows no status, however long it stays open", async () => {
    renderCard();

    await advance(10000);

    expect(backend.requests()).toEqual([]);
    expect(screen.queryByText("Saugoma…")).toBeNull();
    expect(screen.queryByText("Išsaugota")).toBeNull();
  });


  it("shows 'Saugoma…' right after an edit, before anything is sent", () => {
    // Nothing is sent during the test, but the edit is still in
    // the debounce when it ends (a KB-25 fix sends it on unmount)
    savesSucceed();
    renderCard();

    fireEvent.change(descriptionField(), { target: { value: "Naujas tekstas" } });

    expect(screen.getByText("Saugoma…")).toBeInTheDocument();
    expect(backend.requests()).toEqual([]);
  });


  it("POSTs 500 ms after the edit — not a moment earlier", async () => {
    savesSucceed();
    renderCard();

    fireEvent.change(descriptionField(), { target: { value: "Naujas tekstas" } });
    await advance(499);
    expect(backend.requests("POST", UPDATE)).toHaveLength(0);

    await advance(1);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
  });


  it("coalesces rapid edits into ONE POST, 500 ms after the last one, carrying the last state", async () => {
    savesSucceed();
    renderCard();

    fireEvent.change(descriptionField(), { target: { value: "P" } });
    await advance(300);
    fireEvent.change(descriptionField(), { target: { value: "Pa" } });
    await advance(300);
    fireEvent.change(descriptionField(), { target: { value: "Pakeistas tekstas" } });

    // 1.1 s after the first edit, but only 499 ms after the last
    await advance(499);
    expect(backend.requests("POST", UPDATE)).toHaveLength(0);

    await advance(1);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload().questiontext).toBe("Pakeistas tekstas");

    await advance(5000);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
  });


  it("POSTs exactly the question's own fields with the session cookie — `created` is not sent", async () => {
    savesSucceed();
    const { triggerQuestionListUpdate } = renderCard({
      isenabled: 1,
      isphishing: 1,
      questiontext: "",
      questionoptions: [
        fx.adminOption({ optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: 1 }),
        fx.adminOption({ optionid: 212, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 0 }),
        fx.adminOption({ optionid: 213, optiontext: "", rightoptionanswer: null }),
      ],
      created: "2026-08-26T19:09:07+03:00",
    });

    fireEvent.change(descriptionField(), { target: { value: "Atkreipkite dėmesį į siuntėją" } });
    await advance(500);

    const request = backend.lastRequest("POST", UPDATE);
    expect(request).toMatchObject({ client: "axios", method: "POST", url: UPDATE, withCredentials: true });
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.json).toEqual({
      questionid: 21,
      isenabled: 1,
      isphishing: 1,
      questiontext: "Atkreipkite dėmesį į siuntėją",
      questionoptions: [
        OPTION_211,
        OPTION_212,
        // An untouched never-set answer goes back as null, not 0
        { optionid: 213, optiontext: "", rightoptionanswer: null },
      ],
    });
    expect(request.json).not.toHaveProperty("created");

    // The card is the source of truth — a save never reloads the list
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
  });


  it("shows 'Išsaugota' once the save landed", async () => {
    savesSucceed();
    renderCard();

    fireEvent.change(descriptionField(), { target: { value: "Naujas tekstas" } });
    await advance(500);

    expect(screen.getByText("Išsaugota")).toBeInTheDocument();
    expect(screen.queryByText("Saugoma…")).toBeNull();
  });


  it("goes back to 'Saugoma…' on the next edit and saves the newest state again", async () => {
    savesSucceed();
    renderCard();

    fireEvent.change(descriptionField(), { target: { value: "Pirmas" } });
    await advance(500);
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();

    fireEvent.change(descriptionField(), { target: { value: "Antras" } });
    expect(screen.getByText("Saugoma…")).toBeInTheDocument();
    expect(screen.queryByText("Išsaugota")).toBeNull();

    await advance(500);
    expect(backend.requests("POST", UPDATE).map((request) => request.json.questiontext)).toEqual(["Pirmas", "Antras"]);
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();
  });


  it.each(FAILURES)("a save failing with %s toasts 'Nepavyko išsaugoti klausimo #<id>' and clears the status", async (_, failure) => {
    backend.on("POST", UPDATE, failure);
    renderCard({ questionid: 37 });

    fireEvent.change(descriptionField(), { target: { value: "Naujas tekstas" } });
    expect(screen.getByText("Saugoma…")).toBeInTheDocument();
    await advance(500);

    expect(toastTexts()).toEqual(["Nepavyko išsaugoti klausimo #37"]);
    expect(screen.queryByText("Saugoma…")).toBeNull();
    expect(screen.queryByText("Išsaugota")).toBeNull();
  });


  it("does not retry a failed save on its own — the next edit saves the whole question again", async () => {
    backend.once("POST", UPDATE, reply.status(500, "Internal Server Error"));
    savesSucceed();
    renderCard({ isphishing: 1 });

    fireEvent.click(isPhishingCheckbox());
    await advance(500);
    expect(toastTexts()).toEqual(["Nepavyko išsaugoti klausimo #21"]);

    await advance(10000);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);

    // Every save carries the whole question, so the failed verdict
    // change rides along with the next edit
    fireEvent.change(descriptionField(), { target: { value: "Antras bandymas" } });
    await advance(500);

    expect(backend.requests("POST", UPDATE)).toHaveLength(2);
    expect(savePayload()).toMatchObject({ isphishing: 0, questiontext: "Antras bandymas" });
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Autosave — what each edit saves
// -----------------------------------------------------------

describe("QuestionCard — what each edit saves", () => {

  beforeEach(() => {
    useFakeDebounce();
    savesSucceed();
  });


  it("'Papildomai' → questiontext, Lithuanian characters intact", async () => {
    renderCard({ questiontext: "" });

    fireEvent.change(descriptionField(), { target: { value: "Ar tikrai rašo „VU“? Žiūrėkite į ąčęėįšųūž" } });
    await advance(500);

    expect(savePayload()).toEqual({
      questionid: 21,
      isenabled: 1,
      isphishing: 1,
      questiontext: "Ar tikrai rašo „VU“? Žiūrėkite į ąčęėįšųūž",
      questionoptions: [OPTION_211, OPTION_212],
    });
  });


  it("clearing 'Papildomai' saves an empty questiontext (\"\")", async () => {
    renderCard({ questiontext: "Senas tekstas" });

    fireEvent.change(descriptionField(), { target: { value: "" } });
    await advance(500);

    expect(savePayload().questiontext).toBe("");
  });


  it.each([
    [1, 0],
    [0, 1],
  ])("the is-phishing checkbox turns isphishing %i into %i", async (before, after) => {
    renderCard({ isphishing: before });

    fireEvent.click(isPhishingCheckbox());
    expect(isPhishingCheckbox().checked).toBe(after === 1);
    await advance(500);

    expect(savePayload()).toEqual({
      questionid: 21,
      isenabled: 1,
      isphishing: after,
      questiontext: "",
      questionoptions: [OPTION_211, OPTION_212],
    });
  });


  it.each([
    [1, 0, "Išjungtas"],
    [0, 1, "Įjungtas"],
  ])("the enabled switch turns isenabled %i into %i ('%s')", async (before, after, label) => {
    renderCard({ isenabled: before });

    fireEvent.click(enabledSwitch());
    expect(screen.getByText(label)).toBeInTheDocument();
    await advance(500);

    expect(savePayload()).toEqual({
      questionid: 21,
      isenabled: after,
      isphishing: 1,
      questiontext: "",
      questionoptions: [OPTION_211, OPTION_212],
    });
  });


  it("switching a question off dims the card and shows the badge at once, before the save", () => {
    renderCard({ isenabled: 1 });

    fireEvent.click(enabledSwitch());

    expect(enabledSwitch()).not.toBeChecked();
    expect(screen.getByText("Išjungtas — studentams nerodomas")).toBeInTheDocument();
    expect(card()).toHaveClass("opacity-70");
    expect(backend.requests()).toEqual([]);
  });


  it("an option's text → that option's optiontext; the other options go along unchanged", async () => {
    renderCard();

    fireEvent.change(optionField(212), { target: { value: "Nuoroda veda į „vu-lt.example“" } });
    await advance(500);

    expect(savePayload().questionoptions).toEqual([
      OPTION_211,
      { optionid: 212, optiontext: "Nuoroda veda į „vu-lt.example“", rightoptionanswer: 0 },
    ]);
  });


  it.each([
    [1, 0],
    [0, 1],
    [null, 1],
  ])("an option's right-answer checkbox turns rightoptionanswer %s into %i", async (before, after) => {
    renderCard({
      questionoptions: [
        fx.adminOption({ optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: before }),
        fx.adminOption({ optionid: 212, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 0 }),
      ],
    });

    fireEvent.click(rightAnswerCheckbox(211));
    expect(rightAnswerCheckbox(211).checked).toBe(after === 1);
    await advance(500);

    expect(savePayload().questionoptions).toEqual([
      { optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: after },
      OPTION_212,
    ]);
  });


  it("different edits within the debounce go out together in one POST", async () => {
    renderCard({ isenabled: 1, isphishing: 1, questiontext: "" });

    fireEvent.change(descriptionField(), { target: { value: "Keli pakeitimai" } });
    fireEvent.click(isPhishingCheckbox());
    fireEvent.click(enabledSwitch());
    fireEvent.change(optionField(211), { target: { value: "Pakeista opcija" } });
    fireEvent.click(rightAnswerCheckbox(212));
    await advance(500);

    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload()).toEqual({
      questionid: 21,
      isenabled: 0,
      isphishing: 0,
      questiontext: "Keli pakeitimai",
      questionoptions: [
        { optionid: 211, optiontext: "Pakeista opcija", rightoptionanswer: 1 },
        { optionid: 212, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 1 },
      ],
    });
  });
});







// -----------------------------------------------------------
// Adding an option
// -----------------------------------------------------------

describe("QuestionCard — adding an option", () => {

  // A created option joins the autosave, and some tests end while
  // its save still waits in the debounce — the save is always
  // routed (a KB-25 fix sends a pending save on unmount)
  beforeEach(() => {
    useFakeDebounce();
    savesSucceed();
  });


  it("POSTs createnewoption with the question ID and the session cookie", async () => {
    backend.on("POST", CREATE_OPTION, reply.json({ new_option_id: 373 }));
    renderCard({ questionid: 37 });

    fireEvent.click(addOptionButton());
    await advance(0);

    const requests = backend.requests("POST", CREATE_OPTION);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: CREATE_OPTION, withCredentials: true });
    expect(requests[0].json).toEqual({ questionid: 37 });
  });


  it("adds the backend's new option as an empty, unticked last row", async () => {
    backend.on("POST", CREATE_OPTION, reply.json({ new_option_id: 213 }));
    renderCard();

    fireEvent.click(addOptionButton());
    await advance(0);

    expect(optionLabels()).toEqual(["Opcija Nr.: 211", "Opcija Nr.: 212", "Opcija Nr.: 213"]);
    expect(optionField(213)).toHaveValue("");
    expect(rightAnswerCheckbox(213)).not.toBeChecked();
  });


  it("autosaves the question including the new option {optionid, optiontext: \"\", rightoptionanswer: 0}", async () => {
    backend.on("POST", CREATE_OPTION, reply.json({ new_option_id: 213 }));
    const { triggerQuestionListUpdate } = renderCard();

    fireEvent.click(addOptionButton());
    await advance(0);
    expect(screen.getByText("Saugoma…")).toBeInTheDocument();

    await advance(500);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload().questionoptions).toEqual([
      OPTION_211,
      OPTION_212,
      { optionid: 213, optiontext: "", rightoptionanswer: 0 },
    ]);
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();

    // The option joins the card's own state — no list reload
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
  });


  it("the new option's text and right answer are editable and saved with it", async () => {
    backend.on("POST", CREATE_OPTION, reply.json({ new_option_id: 213 }));
    renderCard();

    fireEvent.click(addOptionButton());
    await advance(0);
    fireEvent.change(optionField(213), { target: { value: "Prašoma skubiai atsiųsti kodą" } });
    fireEvent.click(rightAnswerCheckbox(213));
    await advance(500);

    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload().questionoptions).toEqual([
      OPTION_211,
      OPTION_212,
      { optionid: 213, optiontext: "Prašoma skubiai atsiųsti kodą", rightoptionanswer: 1 },
    ]);
  });


  it("two quick clicks create two options, saved together in one autosave", async () => {
    backend.once("POST", CREATE_OPTION, reply.json({ new_option_id: 213 }));
    backend.once("POST", CREATE_OPTION, reply.json({ new_option_id: 214 }));
    renderCard();

    fireEvent.click(addOptionButton());
    fireEvent.click(addOptionButton());
    await advance(0);

    expect(backend.requests("POST", CREATE_OPTION)).toHaveLength(2);
    expect(optionLabels()).toEqual(["Opcija Nr.: 211", "Opcija Nr.: 212", "Opcija Nr.: 213", "Opcija Nr.: 214"]);

    await advance(500);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload().questionoptions.map((option) => option.optionid)).toEqual([211, 212, 213, 214]);
  });


  it.each([
    ["HTTP 404 (the question was deleted meanwhile)", reply.text("Error: Question no longer exists", 404)],
    ["HTTP 403 (not an admin)", reply.text("Error: Not Admin", 403)],
    ["HTTP 500", reply.status(500, "Internal Server Error")],
    ["a network error", reply.networkError()],
  ])("a create failing with %s toasts 'Nepavyko sukurti opcijos' — no new row, no autosave", async (_, failure) => {
    backend.on("POST", CREATE_OPTION, failure);
    renderCard();

    fireEvent.click(addOptionButton());
    await advance(0);

    expect(toastTexts()).toEqual(["Nepavyko sukurti opcijos"]);
    expect(optionLabels()).toEqual(["Opcija Nr.: 211", "Opcija Nr.: 212"]);
    expect(screen.queryByText("Saugoma…")).toBeNull();

    await advance(5000);
    expect(backend.requests("POST", UPDATE)).toHaveLength(0);
  });
});







// -----------------------------------------------------------
// Deleting an option
// -----------------------------------------------------------

describe("QuestionCard — deleting an option", () => {

  it("a 1.5 s hold POSTs deleteoption with the option ID and the session cookie", async () => {
    backend.on("POST", DELETE_OPTION, reply.json({ status: "ok" }));
    savesSucceed();
    renderCard();

    longPress(optionDeleteButton(212), 1600);
    await findToast("Opcija ištrinta");

    const requests = backend.requests("POST", DELETE_OPTION);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: DELETE_OPTION, withCredentials: true });
    expect(requests[0].json).toEqual({ optionid: 212 });
  });


  it("removes the row and toasts 'Opcija ištrinta' only once the backend confirmed", async () => {
    const deletion = deferred();
    backend.once("POST", DELETE_OPTION, () => deletion.promise);
    savesSucceed();
    renderCard();

    longPress(optionDeleteButton(212), 1600);
    await settle();
    expect(optionField(212)).toBeInTheDocument();
    expect(toastTexts()).toEqual([]);

    await act(async () => deletion.resolve(reply.json({ status: "ok" })));
    await findToast("Opcija ištrinta");

    expect(screen.queryByLabelText("Opcija Nr.: 212")).toBeNull();
    expect(optionField(211)).toHaveValue("Siuntėjo adresas neatitinka įmonės domeno");
  });


  it("autosaves the question without the deleted option, 500 ms after the deletion", async () => {
    useFakeClock();
    backend.on("POST", DELETE_OPTION, reply.json({ status: "ok" }));
    savesSucceed();
    const { triggerQuestionListUpdate } = renderCard();

    longPress(optionDeleteButton(211), 1600);
    await advance(0);
    expect(toastTexts()).toEqual(["Opcija ištrinta"]);
    expect(screen.getByText("Saugoma…")).toBeInTheDocument();

    await advance(499);
    expect(backend.requests("POST", UPDATE)).toHaveLength(0);

    await advance(1);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload()).toEqual({
      questionid: 21,
      isenabled: 1,
      isphishing: 1,
      questiontext: "",
      questionoptions: [OPTION_212],
    });
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();

    // The row leaves the card's own state — no list reload
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
  });


  it("after a deletion, edits of a remaining row are saved for THAT option", async () => {
    useFakeClock();
    backend.on("POST", DELETE_OPTION, reply.json({ status: "ok" }));
    savesSucceed();
    renderCard();

    longPress(optionDeleteButton(211), 1600);
    await advance(0);
    expect(screen.queryByLabelText("Opcija Nr.: 211")).toBeNull();

    // 212 moved up to the first position — its handlers must follow
    fireEvent.change(optionField(212), { target: { value: "Pakeista po trynimo" } });
    fireEvent.click(rightAnswerCheckbox(212));
    await advance(500);

    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload().questionoptions).toEqual([
      { optionid: 212, optiontext: "Pakeista po trynimo", rightoptionanswer: 1 },
    ]);
  });


  it.each(FAILURES)("a delete failing with %s toasts 'Nepavyko ištrinti opcijos' and keeps the row", async (_, failure) => {
    backend.on("POST", DELETE_OPTION, failure);
    renderCard();

    longPress(optionDeleteButton(212), 1600);
    await findToast("Nepavyko ištrinti opcijos");
    await settle();

    expect(optionField(212)).toHaveValue("Nuoroda veda į svetimą svetainę");
    expect(toastTexts()).not.toContain("Opcija ištrinta");

    // Nothing changed, so nothing is queued for saving
    expect(screen.queryByText("Saugoma…")).toBeNull();
  });


  it("an early release toasts 'Laikykite mygtuką ilgiau, kad ištrintumėte' and sends nothing", async () => {
    renderCard();

    longPress(optionDeleteButton(212), 800);
    await findToast("Laikykite mygtuką ilgiau, kad ištrintumėte");
    await settle();

    expect(backend.requests()).toEqual([]);
    expect(optionField(212)).toBeInTheDocument();
  });


  it("tells on hover that the button must be held", async () => {
    const { user } = renderCard();

    await user.hover(optionDeleteButton(212));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Laikykite mygtuką, kad ištrintumėte opciją");
  });
});







// -----------------------------------------------------------
// Deleting the question
// -----------------------------------------------------------

describe("QuestionCard — deleting the question", () => {

  it("a 1.5 s hold on 'Ištrinti' POSTs deletequestion with the question ID and the session cookie", async () => {
    backend.on("POST", DELETE_QUESTION, reply.json({ status: "ok" }));
    renderCard({ questionid: 37 });

    longPress(questionDeleteButton(), 1600);
    await findToast("Klausimas ištrintas");

    const requests = backend.requests("POST", DELETE_QUESTION);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: DELETE_QUESTION, withCredentials: true });
    expect(requests[0].json).toEqual({ questionid: 37 });
  });


  it("toasts 'Klausimas ištrintas' and reloads the list only once the backend confirmed", async () => {
    const deletion = deferred();
    backend.once("POST", DELETE_QUESTION, () => deletion.promise);
    const { triggerQuestionListUpdate } = renderCard();

    longPress(questionDeleteButton(), 1600);
    await settle();
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);

    await act(async () => deletion.resolve(reply.json({ status: "ok" })));
    await findToast("Klausimas ištrintas");

    expect(triggerQuestionListUpdate).toHaveBeenCalledTimes(1);
    expect(backend.requests("POST", UPDATE)).toHaveLength(0);
  });


  it.each(FAILURES)("a delete failing with %s toasts 'Nepavyko ištrinti klausimo' and does not reload the list", async (_, failure) => {
    backend.on("POST", DELETE_QUESTION, failure);
    const { triggerQuestionListUpdate } = renderCard();

    longPress(questionDeleteButton(), 1600);
    await findToast("Nepavyko ištrinti klausimo");
    await settle();

    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
    expect(toastTexts()).not.toContain("Klausimas ištrintas");
  });


  it("an early release toasts 'Laikykite mygtuką ilgiau, kad ištrintumėte' and deletes nothing", async () => {
    const { triggerQuestionListUpdate } = renderCard();

    longPress(questionDeleteButton(), 800);
    await findToast("Laikykite mygtuką ilgiau, kad ištrintumėte");
    await settle();

    expect(backend.requests()).toEqual([]);
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
  });
});







// -----------------------------------------------------------
// The link editor
// -----------------------------------------------------------

describe("QuestionCard — the link editor", () => {

  // Resolves with the editor's "Išsaugoti" button — it shows
  // once the areas have loaded
  const openLinkEditor = async (user) => {
    await user.click(linkEditorButton());
    return screen.findByRole("button", { name: "Išsaugoti" });
  };


  it("'Redaguoti Nuorodas' opens the fullscreen 'Nuorodų Redagavimas' overlay, portalled onto <body>", async () => {
    backend.on("GET", QUESTION_LINKS, reply.json([fx.questionLink()]));
    const { user, container } = renderCard();
    expect(screen.queryByText("Nuorodų Redagavimas")).toBeNull();

    await openLinkEditor(user);

    expect(linkEditorOverlay().parentElement).toBe(document.body);
    expect(container).not.toContainElement(linkEditorOverlay());
  });


  it("keeps the overlay outside a disabled question's dimmed card", async () => {
    backend.on("GET", QUESTION_LINKS, reply.json([fx.questionLink()]));
    const { user } = renderCard({ isenabled: 0 });

    await openLinkEditor(user);

    // An opacity ancestor would trap (and dim) the "fullscreen" overlay
    expect(card()).toHaveClass("opacity-70");
    expect(card()).not.toContainElement(linkEditorOverlay());
  });


  it("the editor loads the areas with GET .../links (axios, session cookie) for the question's image", async () => {
    backend.on("GET", QUESTION_LINKS, reply.json([fx.questionLink({ url: "https://vu-lt.example/prisijungti" })]));
    const { user } = renderCard();

    await openLinkEditor(user);

    const requests = backend.requests("GET", QUESTION_LINKS);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: QUESTION_LINKS, withCredentials: true });
    expect(screen.getByAltText("Redaguojamas fišingo laiškas")).toHaveAttribute("src", "/api/phishingpictures/21");
    expect(screen.getByDisplayValue("https://vu-lt.example/prisijungti")).toBeInTheDocument();
  });


  it("'Atgal' closes the overlay and reloads the list", async () => {
    backend.on("GET", QUESTION_LINKS, reply.json([fx.questionLink()]));
    const { user, triggerQuestionListUpdate } = renderCard();

    await openLinkEditor(user);
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Atgal" }));

    expect(screen.queryByText("Nuorodų Redagavimas")).toBeNull();
    expect(triggerQuestionListUpdate).toHaveBeenCalledTimes(1);
  });


  it("saving the areas (answered 'OK') closes the overlay and reloads the list", async () => {
    backend.on("GET", QUESTION_LINKS, reply.json([fx.questionLink()]));
    backend.on("POST", QUESTION_LINKS, reply.text("OK"));
    const { user, triggerQuestionListUpdate } = renderCard();

    await user.click(await openLinkEditor(user));
    await findToast("Nuorodos išsaugotos");

    expect(screen.queryByText("Nuorodų Redagavimas")).toBeNull();
    expect(triggerQuestionListUpdate).toHaveBeenCalledTimes(1);

    const save = backend.lastRequest("POST", QUESTION_LINKS);
    expect(save.withCredentials).toBe(true);
    expect(save.json).toEqual({ areas: [{ id: 1, url: "http://example.com", x: 0.15, y: 0.42, width: 0.2, height: 0.03 }] });
  });


  it("a failed save keeps the overlay open and the list as it is", async () => {
    backend.on("GET", QUESTION_LINKS, reply.json([fx.questionLink()]));
    backend.on("POST", QUESTION_LINKS, reply.status(500, "Internal Server Error"));
    const { user, triggerQuestionListUpdate } = renderCard();

    await user.click(await openLinkEditor(user));
    await findToast("Nepavyko išsaugoti nuorodų");

    expect(screen.getByText("Nuorodų Redagavimas")).toBeInTheDocument();
    expect(triggerQuestionListUpdate).not.toHaveBeenCalled();
  });


  it("a failed areas load toasts 'Nepavyko užkrauti nuorodų' — 'Atgal' still leaves", async () => {
    backend.on("GET", QUESTION_LINKS, reply.status(500, "Internal Server Error"));
    const { user, triggerQuestionListUpdate } = renderCard();

    await user.click(linkEditorButton());
    await findToast("Nepavyko užkrauti nuorodų");

    await user.click(screen.getByRole("button", { name: "Atgal" }));

    expect(screen.queryByText("Nuorodų Redagavimas")).toBeNull();
    expect(triggerQuestionListUpdate).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// The card's own copy of the question
// -----------------------------------------------------------

describe("QuestionCard — the card keeps its own copy of the question", () => {

  it("a list reload handing in changed data changes nothing on the card", () => {
    renderPage(<ReloadableCard initial={fx.adminQuestion({ questiontext: "Pradinis tekstas" })} />, { toaster: true });

    reloadListWith(fx.adminQuestion({
      questiontext: "Serverio tekstas",
      isphishing: 0,
      isenabled: 0,
      questionoptions: [fx.adminOption({ optionid: 211, optiontext: "Kitas tekstas", rightoptionanswer: 0 })],
      created: null,
    }));

    // The list really holds the new object by now
    expect(screen.getByTestId("list-copy")).toHaveTextContent("Serverio tekstas");

    expect(descriptionField()).toHaveValue("Pradinis tekstas");
    expect(isPhishingCheckbox()).toBeChecked();
    expect(enabledSwitch()).toBeChecked();
    expect(screen.queryByText("Išjungtas — studentams nerodomas")).toBeNull();
    expect(optionLabels()).toEqual(["Opcija Nr.: 211", "Opcija Nr.: 212"]);
    expect(optionField(211)).toHaveValue("Siuntėjo adresas neatitinka įmonės domeno");
    expect(rightAnswerCheckbox(211)).toBeChecked();
    expect(screen.getByText("Sukurtas: 2026-08-26 19:09:07")).toBeInTheDocument();
  });


  it("unsaved edits survive a list reload and are saved as edited", async () => {
    useFakeDebounce();
    savesSucceed();
    renderPage(<ReloadableCard initial={fx.adminQuestion()} />, { toaster: true });

    fireEvent.change(descriptionField(), { target: { value: "Neišsaugotas pakeitimas" } });
    reloadListWith(fx.adminQuestion({ questiontext: "Serverio tekstas", isphishing: 0 }));
    expect(descriptionField()).toHaveValue("Neišsaugotas pakeitimas");

    await advance(500);
    expect(backend.requests("POST", UPDATE)).toHaveLength(1);
    expect(savePayload()).toMatchObject({ questiontext: "Neišsaugotas pakeitimas", isphishing: 1 });
  });


  it("a list reload alone saves nothing", async () => {
    useFakeDebounce();
    renderPage(<ReloadableCard initial={fx.adminQuestion()} />, { toaster: true });

    reloadListWith(fx.adminQuestion({ questiontext: "Serverio tekstas" }));
    await advance(5000);

    expect(backend.requests()).toEqual([]);
    expect(screen.queryByText("Saugoma…")).toBeNull();
  });
});







// -----------------------------------------------------------
// The preview image
// -----------------------------------------------------------

describe("QuestionCard — the preview image", () => {

  it("shows the question's screenshot and asks for no areas before it has loaded", async () => {
    renderCard({ questionid: 37 });

    expect(screen.getByAltText("Fišingo El. Laiškas")).toHaveAttribute("src", "/api/phishingpictures/37");
    await settle();

    expect(backend.requests()).toEqual([]);
  });


  it("fetches the link areas once the image loaded — a plain fetch GET — and draws them", async () => {
    backend.on("GET", "/api/phishingpictures/37/links", reply.json([
      fx.questionLink({ id: 1, url: "https://vu-lt.example/prisijungti" }),
      fx.questionLink({ id: 2, url: "http://banko-patvirtinimas.example", x: "40%", y: "70%" }),
    ]));
    const { container } = renderCard({ questionid: 37 });

    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(2));

    const requests = backend.requests("GET", "/api/phishingpictures/37/links");
    expect(requests).toHaveLength(1);
    expect(requests[0].client).toBe("fetch");
    expect(requests[0].credentials).toBeUndefined();

    fireEvent.mouseEnter(linkAreas(container)[1]);
    expect(screen.getByText("http://banko-patvirtinimas.example")).toBeInTheDocument();
  });
});
