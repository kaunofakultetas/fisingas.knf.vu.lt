// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the question bank page
//
//  src/systemPages/AdminPages/Questions — /admin/questions and
//  the /admin/questions/:questionID shortcut:
//    - Questions — GET /api/admin/questions (axios,
//      withCredentials, once); renders NOTHING — not even the
//      admin frame — until the bank arrives; then the title
//      card, the summary tiles ("N / P%" shares of the bank,
//      "—" for the null counters of an EMPTY bank) and the
//      amber warning while fewer questions are enabled than
//      the saved test size (never while phishingtestsize is
//      still null)
//    - QuestionsList — one card per question in the API's
//      order (newest first); for a non-empty bank the filter
//      bar: quick search (question or option text in any case,
//      or an EXACT question ID), the status pills and
//      "Rodoma X iš Y". A filtered-out card is never unmounted
//      — its wrapper only gets the "hidden" class, so an edit
//      in progress survives. Tailwind is not loaded in the
//      tests: the class is what they check
//    - "Sukurti Naują Klausimą" → the AddQuestion dialog; a
//      successful upload refetches the bank (the upload request
//      itself is pinned in addQuestion.test.jsx)
//    - EditQuestion — one question's link editor inside the
//      admin layout
//
//  The cards (QuestionCard) have their own tests — here they
//  are only found by their "Klausimas #<id>" header. A failed
//  bank load is known bug KB-14 and deliberately not
//  exercised here.
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import * as fx from "./support/fixtures";

import Questions from "@/systemPages/AdminPages/Questions/Questions";
import EditQuestion from "@/systemPages/AdminPages/Questions/QuestionsList/EditQuestion/EditQuestion";


const QUESTIONS = "/api/admin/questions";
const UPLOAD = "/api/phishingpictures";
const SAVE_QUESTION = "/api/admin/questions/updatequestion";

const SEARCH_PLACEHOLDER = "Ieškoti pagal tekstą, opciją ar ID...";
const PROMPT = "Vilkite paveikslėlį čia arba spustelėkite norėdami pasirinkti";
const ACTIVE_PILL = "bg-[rgb(123,0,63)]";

// Per-test timeout of the describes that mount the whole bank
// page: every keystroke re-renders all the question cards, and
// typing a search through user-event takes seconds a test —
// more under parallel workers than vitest's default 5 s allows
const SLOW_UI_TIMEOUT = 15000;


// Four questions covering every filter, newest first as the API
// sends them. No text in it contains "21", so a search for 21 can
// only match by ID
const BANK = [
  fx.adminQuestion({ questionid: 210, isenabled: 1, isphishing: 1, questiontext: "Skubus mokėjimo prašymas", created: "2026-08-26T19:30:00+03:00" }),
  fx.adminQuestion({ questionid: 23, isenabled: 0, isphishing: 0, questiontext: "Universiteto naujienlaiškis", created: "2026-08-26T19:20:00+03:00" }),
  fx.adminQuestion({ questionid: 22, isenabled: 1, isphishing: 0, created: "2026-08-26T19:15:00+03:00" }),
  fx.adminQuestion({
    questionid: 21,
    isenabled: 0,
    isphishing: 1,
    created: "2026-08-26T19:09:07+03:00",
    questionoptions: [
      fx.adminOption({ optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: 1 }),
      fx.adminOption({ optionid: 212, optiontext: "Prašoma įvesti slaptažodį", rightoptionanswer: 1 }),
    ],
  }),
];


// Distinct counters, so each tile provably reads its own one:
// 4 questions — 2 enabled, 1 real, 3 phishing, 2+2+2+3 options
const TILE_BANK = [
  fx.adminQuestion({ questionid: 24, isenabled: 1, isphishing: 1 }),
  fx.adminQuestion({ questionid: 23, isenabled: 1, isphishing: 1 }),
  fx.adminQuestion({ questionid: 22, isenabled: 0, isphishing: 1 }),
  fx.adminQuestion({
    questionid: 21,
    isenabled: 0,
    isphishing: 0,
    questionoptions: [
      fx.adminOption({ optionid: 211, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: 0 }),
      fx.adminOption({ optionid: 212, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 0 }),
      fx.adminOption({ optionid: 213, optiontext: "Laiškas pasirašytas universiteto vardu", rightoptionanswer: 1 }),
    ],
  }),
];


// `total` questions (newest first), the first `enabled` of them on
const questionsWithEnabled = (total, enabled) =>
  Array.from({ length: total }, (_, index) =>
    fx.adminQuestion({ questionid: 20 + total - index, isenabled: index < enabled ? 1 : 0 }));


// Mounts the page with `bank` as the GET reply; resolves once the
// page — blank while loading — is on screen
const openBank = async (bank) => {
  backend.on("GET", QUESTIONS, reply.json(bank));
  const result = renderPage(<Questions />, { path: "/admin/questions" });
  await screen.findByRole("heading", { level: 1, name: "Testo Klausimai" });
  return result;
};


// A summary tile's value, found by its two-line label ("Viso"
// <br/> "Klausimų" reads as "VisoKlausimų")
const tile = (firstLine, secondLine) =>
  screen.getByText((content) => content === firstLine + secondLine).nextElementSibling.textContent;

// The amber test-size banner (the parent of its bold lead-in)
const warning = () => screen.queryByText("Įjungtų klausimų per mažai:")?.parentElement ?? null;


// Card IDs in DOM order, split by the filter's "hidden" class on
// the card's wrapper — no other ancestor of a card carries it
const cardIds = (hidden) =>
  screen.queryAllByText(/^Klausimas #\d+$/)
    .filter((header) => (header.closest(".hidden") !== null) === hidden)
    .map((header) => Number(header.textContent.slice("Klausimas #".length)));

const shownIds = () => cardIds(false);
const hiddenIds = () => cardIds(true);

// A question's card: its white root box
const card = (id) => screen.getByText(`Klausimas #${id}`).closest(".bg-white");

const searchField = () => screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
const pill = (name) => screen.getByRole("button", { name });
const createButton = () => screen.getByRole("button", { name: /Sukurti Naują Klausimą/ });







// -----------------------------------------------------------
// Loading the bank
// -----------------------------------------------------------

describe("Questions — loading the bank", () => {

  it("asks for the bank once, with the session cookie", async () => {
    await openBank(fx.questionBank());
    await settle();

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: QUESTIONS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("renders nothing — not even the admin frame — until the bank arrives", async () => {
    const bank = deferred();
    backend.on("GET", QUESTIONS, () => bank.promise);
    const { container } = renderPage(<Questions />, { path: "/admin/questions" });
    await settle();

    expect(backend.requests("GET", QUESTIONS)).toHaveLength(1);
    expect(container).toBeEmptyDOMElement();

    await act(async () => bank.resolve(reply.json(fx.questionBank())));

    expect(await screen.findByRole("heading", { level: 1, name: "Testo Klausimai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
  });


  it("shows the title card inside the admin layout", async () => {
    await openBank(fx.questionBank());

    expect(screen.getByText(
      "Klausimų bankas — čia sukuriami, redaguojami ir išjungiami testo klausimai. Studentams dalinami tik įjungti klausimai."
    )).toBeInTheDocument();

    // The admin frame around it — the navbar with its logout
    expect(screen.getByAltText("VU logotipas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The summary tiles
// -----------------------------------------------------------

describe("Questions — the summary tiles", () => {

  it("shows the total, the enabled / real / phishing shares and the option count", async () => {
    await openBank(fx.questionBank(TILE_BANK));

    expect(tile("Viso", "Klausimų")).toBe("4");
    expect(tile("Įjungtų", "Klausimų")).toBe("2 / 50%");
    expect(tile("Tikri", "Pavyzdžiai")).toBe("1 / 25%");
    expect(tile("Fišingo", "Pavyzdžiai")).toBe("3 / 75%");
    expect(tile("Opcijų", "Skaičius")).toBe("9");
  });


  it("rounds the shares to whole percent", async () => {
    // 2 of 3 = 66.7 %, 1 of 3 = 33.3 %
    await openBank(fx.questionBank([
      fx.adminQuestion({ questionid: 23, isenabled: 1, isphishing: 1 }),
      fx.adminQuestion({ questionid: 22, isenabled: 1, isphishing: 0 }),
      fx.adminQuestion({ questionid: 21, isenabled: 0, isphishing: 1 }),
    ]));

    expect(tile("Įjungtų", "Klausimų")).toBe("2 / 67%");
    expect(tile("Tikri", "Pavyzdžiai")).toBe("1 / 33%");
    expect(tile("Fišingo", "Pavyzdžiai")).toBe("2 / 67%");
  });


  it("shows a zero count as '0 / 0%', not as blank", async () => {
    // Nothing enabled and nothing real (the fixture's questions
    // are phishing) — both counters are 0, not null
    await openBank(fx.questionBank(questionsWithEnabled(2, 0)));

    expect(tile("Viso", "Klausimų")).toBe("2");
    expect(tile("Įjungtų", "Klausimų")).toBe("0 / 0%");
    expect(tile("Tikri", "Pavyzdžiai")).toBe("0 / 0%");
    expect(tile("Fišingo", "Pavyzdžiai")).toBe("2 / 100%");
    expect(tile("Opcijų", "Skaičius")).toBe("4");
  });


  it("shows '—' on every tile for an empty bank, whose counters are null", async () => {
    const bank = fx.questionBank([]);
    expect(bank).toMatchObject({ questioncount: 0, phishingcount: null, goodcount: null, enabledcount: null, optionscount: null });
    const { container } = await openBank(bank);

    expect(tile("Viso", "Klausimų")).toBe("—");
    expect(tile("Įjungtų", "Klausimų")).toBe("—");
    expect(tile("Tikri", "Pavyzdžiai")).toBe("—");
    expect(tile("Fišingo", "Pavyzdžiai")).toBe("—");
    expect(tile("Opcijų", "Skaičius")).toBe("—");
    expect(container.textContent).not.toMatch(/null|undefined|NaN/);
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The test-size warning
// -----------------------------------------------------------

describe("Questions — the test-size warning", () => {

  it("warns while fewer questions are enabled than the test size, naming both numbers", async () => {
    await openBank(fx.questionBank(questionsWithEnabled(3, 2), { phishingtestsize: 12 }));

    expect(warning()).toHaveTextContent(
      "Įjungtų klausimų per mažai: testo dydis yra 12, bet įjungti tik 2 klausimai — nauji testai gaus " +
      "mažiau klausimų nei numatyta. Įjunkite daugiau klausimų arba sumažinkite testo dydį pagrindiniame puslapyje."
    );
  });


  it("warns one question short of the test size", async () => {
    await openBank(fx.questionBank(questionsWithEnabled(3, 2), { phishingtestsize: 3 }));

    expect(warning()).toHaveTextContent("testo dydis yra 3, bet įjungti tik 2 klausimai");
  });


  it.each([
    [3, 3],
    [3, 2],
  ])("stays hidden with %i questions enabled for a test size of %i", async (enabled, size) => {
    await openBank(fx.questionBank(questionsWithEnabled(3, enabled), { phishingtestsize: size }));

    expect(warning()).toBeNull();
  });


  it.each([
    ["a bank with nothing enabled", questionsWithEnabled(3, 0)],
    ["an empty bank", []],
  ])("stays hidden while no test size was ever saved (null) — %s", async (_, questions) => {
    await openBank(fx.questionBank(questions, { phishingtestsize: null }));

    expect(warning()).toBeNull();
  });


  it("counts the null enabled count of an empty bank as 0", async () => {
    await openBank(fx.questionBank([], { phishingtestsize: 12 }));

    // Numbers only: after 0 the noun should read "klausimų", so
    // its ending is left open here
    expect(warning()).toHaveTextContent(/testo dydis yra 12, bet įjungti tik 0 klausim/);
    expect(warning()).not.toHaveTextContent("null");
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// QuestionsList — the cards and the filter bar
// -----------------------------------------------------------

describe("QuestionsList — the cards and the filter bar", () => {

  it("renders one card per question, in the API's order (newest first)", async () => {
    await openBank(fx.questionBank(BANK));

    expect(shownIds()).toEqual([210, 23, 22, 21]);
    expect(hiddenIds()).toEqual([]);
  });


  it("shows the empty-bank state and no filter bar for an empty bank — the create button stays", async () => {
    await openBank(fx.questionBank([]));

    expect(screen.getByText("Klausimų banke dar nieko nėra")).toBeInTheDocument();
    expect(screen.getByText("Sukurkite pirmą klausimą įkeldami el. laiško paveikslėlį.")).toBeInTheDocument();
    expect(shownIds()).toEqual([]);

    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull();
    expect(screen.queryByRole("button", { name: "Visi" })).toBeNull();
    expect(screen.queryByText(/^Rodoma/)).toBeNull();
    expect(screen.queryByText("Nieko nerasta")).toBeNull();

    expect(createButton()).toBeInTheDocument();
  });


  it("offers the search field, the five status pills and the counter for a non-empty bank", async () => {
    await openBank(fx.questionBank(BANK));

    expect(searchField()).toHaveValue("");
    expect([...pill("Visi").parentElement.children].map((button) => button.textContent))
      .toEqual(["Visi", "Įjungti", "Išjungti", "Fišingas", "Tikri"]);
    expect(screen.getByText("Rodoma 4 iš 4")).toBeInTheDocument();
    expect(screen.queryByText("Klausimų banke dar nieko nėra")).toBeNull();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// QuestionsList — quick search
// -----------------------------------------------------------

describe("QuestionsList — quick search", () => {

  it("finds a question by its text, in any case — Lithuanian letters included", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.type(searchField(), "MOKĖJIMO");

    expect(shownIds()).toEqual([210]);
    expect(hiddenIds()).toEqual([23, 22, 21]);
    expect(screen.getByText("Rodoma 1 iš 4")).toBeInTheDocument();
  });


  it("finds a question by the text of one of its options", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.type(searchField(), "SLAPTAŽODĮ");

    expect(shownIds()).toEqual([21]);
    expect(screen.getByText("Rodoma 1 iš 4")).toBeInTheDocument();
  });


  it("matches a question ID exactly — '21' finds #21 but not #210", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.type(searchField(), "21");
    expect(shownIds()).toEqual([21]);
    expect(hiddenIds()).toEqual([210, 23, 22]);

    await user.clear(searchField());
    await user.type(searchField(), "210");
    expect(shownIds()).toEqual([210]);
  });


  it("ignores spaces around the search text", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.type(searchField(), "  21  ");

    expect(shownIds()).toEqual([21]);
  });


  it("says 'Nieko nerasta' when nothing matches — the cards stay mounted, hidden", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.type(searchField(), "nėra tokio");

    expect(screen.getByText("Nieko nerasta")).toBeInTheDocument();
    expect(screen.getByText("Joks klausimas neatitinka paieškos ar filtro.")).toBeInTheDocument();
    expect(screen.getByText("Rodoma 0 iš 4")).toBeInTheDocument();
    expect(shownIds()).toEqual([]);
    expect(hiddenIds()).toEqual([210, 23, 22, 21]);
    expect(screen.queryByText("Klausimų banke dar nieko nėra")).toBeNull();
  });


  it("brings every card back when the search is cleared", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.type(searchField(), "nėra tokio");
    await user.clear(searchField());

    expect(shownIds()).toEqual([210, 23, 22, 21]);
    expect(screen.getByText("Rodoma 4 iš 4")).toBeInTheDocument();
    expect(screen.queryByText("Nieko nerasta")).toBeNull();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// QuestionsList — the status pills
// -----------------------------------------------------------

describe("QuestionsList — the status pills", () => {

  it("starts on 'Visi' — the active pill is burgundy, the others white", async () => {
    await openBank(fx.questionBank(BANK));

    expect(pill("Visi")).toHaveClass(ACTIVE_PILL, "text-white");
    for (const name of ["Įjungti", "Išjungti", "Fišingas", "Tikri"]) {
      expect(pill(name)).toHaveClass("bg-white", "text-gray-500");
      expect(pill(name)).not.toHaveClass(ACTIVE_PILL);
    }
  });


  it.each([
    ["Įjungti", [210, 22], [23, 21]],
    ["Išjungti", [23, 21], [210, 22]],
    ["Fišingas", [210, 21], [23, 22]],
    ["Tikri", [23, 22], [210, 21]],
  ])("'%s' shows only its questions and becomes the active pill", async (name, shown, hidden) => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.click(pill(name));

    expect(shownIds()).toEqual(shown);
    expect(hiddenIds()).toEqual(hidden);
    expect(screen.getByText("Rodoma 2 iš 4")).toBeInTheDocument();
    expect(pill(name)).toHaveClass(ACTIVE_PILL, "text-white");
    expect(pill("Visi")).not.toHaveClass(ACTIVE_PILL);
  });


  it("'Visi' shows every card again", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.click(pill("Tikri"));
    await user.click(pill("Visi"));

    expect(shownIds()).toEqual([210, 23, 22, 21]);
    expect(pill("Visi")).toHaveClass(ACTIVE_PILL);
    expect(pill("Tikri")).not.toHaveClass(ACTIVE_PILL);
  });


  it("combines with the search — a card must match both", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.click(pill("Išjungti"));
    await user.type(searchField(), "naujienlaiškis");
    expect(shownIds()).toEqual([23]);

    await user.click(pill("Įjungti"));
    expect(shownIds()).toEqual([]);
    expect(screen.getByText("Nieko nerasta")).toBeInTheDocument();
    expect(screen.getByText("Rodoma 0 iš 4")).toBeInTheDocument();
  });


  // The card saves 500 ms after the last change. On a fake
  // setTimeout the card is provably filtered out while that save
  // is still pending — on real timers a slow run could save first
  // and prove nothing. fireEvent drives it: user-event, waitFor and
  // settle() need the real setTimeout
  it("keeps a filtered-out card mounted — its edit survives and its pending save still goes out", async () => {
    backend.on("POST", SAVE_QUESTION, reply.json({ status: "ok" }));
    await openBank(fx.questionBank([
      fx.adminQuestion({ questionid: 22, isenabled: 1 }),
      fx.adminQuestion({ questionid: 21, isenabled: 0 }),
    ]));
    const field = within(card(22)).getByLabelText("Papildomai");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(field, { target: { value: "Atkreipkite dėmesį" } });
    await act(() => vi.advanceTimersByTimeAsync(200));

    fireEvent.click(pill("Išjungti"));
    expect(hiddenIds()).toEqual([22]);
    expect(backend.requests("POST", SAVE_QUESTION)).toHaveLength(0);

    // 500 ms after the edit the hidden card saves all the same
    await act(() => vi.advanceTimersByTimeAsync(300));
    const saves = backend.requests("POST", SAVE_QUESTION);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ client: "axios", withCredentials: true });
    expect(saves[0].json).toEqual({
      questionid: 22,
      isenabled: 1,
      isphishing: 1,
      questiontext: "Atkreipkite dėmesį",
      questionoptions: [
        { optionid: 221, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: 1 },
        { optionid: 222, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 0 },
      ],
    });

    // Shown again: the very same field, the text still in it
    fireEvent.click(pill("Visi"));
    expect(hiddenIds()).toEqual([]);
    expect(within(card(22)).getByLabelText("Papildomai")).toBe(field);
    expect(field).toHaveValue("Atkreipkite dėmesį");
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// QuestionsList — creating a question
// -----------------------------------------------------------

describe("QuestionsList — creating a question", () => {

  it("'Sukurti Naują Klausimą' opens the upload dialog; × closes it without a request", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    await user.click(createButton());

    expect(await screen.findByRole("heading", { name: "Įkelti Paveikslėlį" })).toBeInTheDocument();
    expect(screen.getByText(PROMPT)).toBeInTheDocument();

    await user.click(screen.getByTestId("CloseIcon").closest("button"));
    await settle();

    expect(screen.queryByRole("heading", { name: "Įkelti Paveikslėlį" })).toBeNull();
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(backend.requests()).toHaveLength(1);
  });


  it("reopens with a fresh, empty dialog", async () => {
    const { user } = await openBank(fx.questionBank(BANK));

    // An image picked and then abandoned with × must not come back
    await user.click(createButton());
    await user.upload(document.querySelector('input[type="file"]'), new File(["png"], "laiskas.png", { type: "image/png" }));
    await screen.findByAltText("Pasirinktas paveikslėlis");
    await user.click(screen.getByTestId("CloseIcon").closest("button"));

    // The list unmounts the dialog on close — nothing is carried over
    await user.click(await screen.findByRole("button", { name: /Sukurti Naują Klausimą/ }));

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(screen.queryByAltText("Pasirinktas paveikslėlis")).toBeNull();
    expect(screen.getByRole("button", { name: "Įkelti Paveikslėlį" })).toBeDisabled();
    expect(backend.requests()).toHaveLength(1);
  });


  it("after a successful upload refetches the bank, closes the dialog and shows the new question first", async () => {
    const { user } = await openBank(fx.questionBank(BANK));
    await user.click(createButton());
    await screen.findByRole("heading", { name: "Įkelti Paveikslėlį" });

    // The backend wraps the upload in a new question — enabled,
    // empty text, isphishing 0, no options yet — newest, so first
    const created = fx.adminQuestion({
      questionid: 211, isenabled: 1, isphishing: 0, questiontext: "", questionoptions: [], created: "2026-08-26T19:40:00+03:00",
    });
    backend.on("GET", QUESTIONS, reply.json(fx.questionBank([created, ...BANK])));
    backend.on("POST", UPLOAD, reply.json({ type: "ok", message: "Image uploaded successfully" }));

    await user.upload(document.querySelector('input[type="file"]'), new File(["png"], "laiskas.png", { type: "image/png" }));
    const uploadButton = screen.getByRole("button", { name: "Įkelti Paveikslėlį" });
    await waitFor(() => expect(uploadButton).toBeEnabled());
    await user.click(uploadButton);

    // The dialog's toast lands in the page's own (layout) Toaster
    await findToast("Paveikslėlis sėkmingai įkeltas");
    await waitFor(() => expect(shownIds()).toEqual([211, 210, 23, 22, 21]));
    expect(screen.queryByRole("heading", { name: "Įkelti Paveikslėlį" })).toBeNull();

    expect(backend.requests("POST", UPLOAD)).toHaveLength(1);
    const reloads = backend.requests("GET", QUESTIONS);
    expect(reloads).toHaveLength(2);
    expect(reloads[1]).toMatchObject({ client: "axios", withCredentials: true });

    // The counters come from the refetched bank too
    expect(tile("Viso", "Klausimų")).toBe("5");
    expect(screen.getByText("Rodoma 5 iš 5")).toBeInTheDocument();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// EditQuestion — /admin/questions/:questionID
// -----------------------------------------------------------

describe("EditQuestion — one question's link editor page", () => {

  const renderEditor = (id) =>
    renderPage(<EditQuestion />, { path: "/admin/questions/:questionID", url: `/admin/questions/${id}` });


  it("shows the admin frame at once, and 'Kraunasi...' until the link areas arrive", async () => {
    const areas = deferred();
    backend.on("GET", "/api/phishingpictures/21/links", () => areas.promise);
    renderEditor(21);

    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();

    await act(async () => areas.resolve(reply.json([fx.questionLink()])));

    expect(await screen.findByAltText("Redaguojamas fišingo laiškas")).toBeInTheDocument();
    expect(screen.queryByText("Kraunasi...")).toBeNull();
  });


  it.each([21, 210])("edits question %i — its areas fetched with the session cookie, its image shown", async (id) => {
    backend.on("GET", `/api/phishingpictures/${id}/links`, reply.json([fx.questionLink({ id: 7, url: "https://vu-prisijungimas.example" })]));
    renderEditor(id);

    expect(await screen.findByAltText("Redaguojamas fišingo laiškas")).toHaveAttribute("src", `/api/phishingpictures/${id}`);
    expect(screen.getByDisplayValue("https://vu-prisijungimas.example")).toBeInTheDocument();
    for (const chip of ["X: 15%", "Y: 42%", "Plotis: 20%", "Aukštis: 3%"]) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: `/api/phishingpictures/${id}/links`, withCredentials: true });
  });


  it("stays on the page after saving — there is no editor to close here", async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink()]));
    backend.on("POST", "/api/phishingpictures/21/links", reply.text("OK"));
    const { user, location } = renderEditor(21);

    await user.click(await screen.findByRole("button", { name: "Išsaugoti" }));
    await findToast("Nuorodos išsaugotos");

    // The stored percents go back as 0–1 fractions
    const save = backend.lastRequest("POST", "/api/phishingpictures/21/links");
    expect(save).toMatchObject({ client: "axios", withCredentials: true });
    expect(save.json).toEqual({ areas: [{ id: 1, url: "http://example.com", x: 0.15, y: 0.42, width: 0.2, height: 0.03 }] });

    expect(location().pathname).toBe("/admin/questions/21");
    expect(screen.getByAltText("Redaguojamas fišingo laiškas")).toBeInTheDocument();
  });


  it("toasts a failed load of the areas once, through the layout's Toaster", async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.status(500, "Internal Server Error"));
    renderEditor(21);

    await findToast("Nepavyko užkrauti nuorodų");

    expect(toastTexts()).toEqual(["Nepavyko užkrauti nuorodų"]);
  });
});
