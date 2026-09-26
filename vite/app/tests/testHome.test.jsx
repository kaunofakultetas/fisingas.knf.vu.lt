// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — TestHome, the phishing test itself
//
//  src/systemPages/StudentPages/TestHome/TestHome.jsx mounted
//  whole — with the real Sidebar, InteractiveImage, Navbar,
//  Footer and LongPressButton:
//    - loading: exactly ONE GET /api/student/questions
//      (withCredentials), "Kraunasi..." until it answers; a 401
//      is a full navigation to /login; any other failure (5xx,
//      no connection) → "Nepavyko įkelti klausimų" with a
//      "Bandyti dar kartą" that asks again. Under StrictMode's
//      double mount only the newest load counts
//    - `{}` (a finished test or an admin session, per swagger)
//      and [] → "Testas dar neparuoštas" + a reload button
//    - the open question: "Klausimas n / N", the email
//      /api/phishingpictures/{questionid}, "Papildomai:" only
//      for a non-empty `question`, the follow-up checkboxes
//      (isselected 1 = ticked; 0 and null = not), each named
//      after its option text
//    - "Tikras" = selectedanswer 0, "Fišingas" = 1; an option
//      row toggles isselected null → 1 → 0 → 1
//    - AUTOSAVE: every change POSTs the WHOLE StudentQuestion
//      array (withCredentials) — the GET reply with the change
//      applied; nothing is sent before the student clicks.
//      Every change builds a new state: what a save was handed
//      never changes afterwards
//    - saves are SERIALISED: one POST on the wire at a time;
//      clicks made meanwhile are coalesced into ONE follow-up
//      carrying the newest state
//    - only a save answered "OK" is saved. A failed one (5xx,
//      no connection, "Error: …" for a refused body) toasts;
//      the next click sends again. A save refused with 401
//      (the session ended) is a full navigation to /login, one
//      answered `{}` (a locked test, not a student's session)
//      to "/" — no toast, and nothing is sent after either
//    - finishing ("Užbaigti testą", held 1.5 s) waits for the
//      running save, re-sends a failed one once, and only then
//      loads /student/finish; still failing → a toast and the
//      student stays. After a save that sent the browser away
//      (/login, "/") finishing sends and claims nothing
//    - a page restored from the back-forward cache (Back after
//      finishing) reloads
//    - the fullscreen email (Atgal / backdrop / Escape) and the
//      link-area URL tooltips in both views
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import { backend, deferred, reply } from "./support/backend";
import { hardNavigations, reloadCount } from "./support/navigation";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { linkAreas, longPress } from "./support/interactions";
import * as fx from "./support/fixtures";

import TestHome from "@/systemPages/StudentPages/TestHome/TestHome";


const QUESTIONS = "/api/student/questions";
const EMAIL = "Fišingo El. Laiškas";

const linksOf = (questionid) => `/api/phishingpictures/${questionid}/links`;

const SAVE_FAILED = "Nepavyko išsaugoti atsakymo — patikrinkite ryšį";
const NOT_SAVED = "Paskutiniai atsakymai neišsaugoti — patikrinkite ryšį ir bandykite dar kartą";

// The filled burgundy of a chosen verdict — and of an answered
// question's jump button
const BURGUNDY = "bg-[rgb(123,0,63)]";

// The two follow-up options of every fx.studentQuestion
const SENDER_OPTION = "Siuntėjo adresas neatitinka įmonės domeno";
const LINK_OPTION = "Nuoroda veda į svetimą svetainę";

// fx.dealtTest repeats those two texts in every question — these
// tell a second question's options apart
const URGENT_OPTION = "Prašoma skubiai atnaujinti slaptažodį";
const TYPOS_OPTION = "Laiške daug gramatikos klaidų";

const twoQuestions = () => [
  fx.studentQuestion({ questionid: 11, question: "Laiškas atėjo į universiteto pašto dėžutę." }),
  fx.studentQuestion({
    questionid: 12,
    questionoptions: [
      fx.studentOption({ answeroptionid: 121, answeroption: URGENT_OPTION }),
      fx.studentOption({ answeroptionid: 122, answeroption: TYPOS_OPTION }),
    ],
  }),
];


// The card heading "Klausimas N / M" — its " / M" sits in a
// <span>, and jsdom's accessible name trims that span's leading
// space ("Klausimas 1/ 3"), so the spacing around the slash is
// left open
const questionTitle = (number, count) => new RegExp(`^Klausimas ${number}\\s*/\\s*${count}$`);


// Mounts the page with the GET answering `questions`; resolves
// once the first question is on screen
async function openTest(questions) {
  backend.on("GET", QUESTIONS, reply.json(questions));
  const page = renderPage(<TestHome />, { path: "/student" });
  await screen.findByRole("heading", { name: questionTitle(1, questions.length) });
  return page;
}

const heading = (number, count) => screen.getByRole("heading", { name: questionTitle(number, count) });

const verdict = (label) => screen.getByRole("button", { name: label });

const jumpButton = (number) => screen.getByRole("button", { name: String(number) });

// The open question's option rows, in order, as [text, ticked]
const optionRows = () =>
  screen.queryAllByRole("checkbox").map((checkbox) => [checkbox.closest("div").textContent, checkbox.checked]);

const saves = () => backend.requests("POST", QUESTIONS);

// Holds "Užbaigti testą" past its 1.5 s
const finish = () => longPress(screen.getByRole("button", { name: "Užbaigti testą" }), 1600);

// The fullscreen overlay: the dark backdrop around "Atgal"
const fullscreen = () => screen.getByRole("button", { name: "Atgal" }).parentElement;

// A color the way jsdom's CSS parser writes it back — how an
// inline style set by React reads on the element
const parsedColor = (color) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = color;
  return probe.style.backgroundColor;
};







// -----------------------------------------------------------
// Loading the dealt test
// -----------------------------------------------------------

describe("TestHome — loading the dealt test", () => {

  it("shows the spinner until the questions arrive", async () => {
    const load = deferred();
    backend.on("GET", QUESTIONS, () => load.promise);
    renderPage(<TestHome />, { path: "/student" });

    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fišingas" })).toBeNull();

    await act(async () => load.resolve(reply.json(fx.dealtTest(3))));

    expect(await screen.findByRole("heading", { name: questionTitle(1, 3) })).toBeInTheDocument();
    expect(screen.queryByText("Kraunasi...")).toBeNull();
  });


  it("asks for the questions exactly once, with the session cookie", async () => {
    await openTest(fx.dealtTest(3));
    await settle();

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: QUESTIONS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("sends a 401 to /login with a full page load", async () => {
    backend.on("GET", QUESTIONS, reply.status(401, "Unauthorized"));
    renderPage(<TestHome />, { path: "/student" });

    // The target is pinned, not how often it is set
    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);

    // Not mistaken for an empty test — nor for a failed load —
    // while the browser leaves
    expect(screen.queryByText("Testas dar neparuoštas")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(backend.requests()).toHaveLength(1);
  });


  it.each([
    ["a server error (500)", reply.status(500, "Internal Server Error")],
    ["a bad gateway during a deploy (502)", reply.status(502, "Bad Gateway")],
    ["no connection", reply.networkError()],
  ])("%s replaces the spinner with 'Nepavyko įkelti klausimų' and a retry", async (_, failure) => {
    backend.on("GET", QUESTIONS, failure);
    renderPage(<TestHome />, { path: "/student" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nepavyko įkelti klausimų");
    expect(within(alert).getByRole("button", { name: "Bandyti dar kartą" })).toBeInTheDocument();
    expect(screen.queryByText("Kraunasi...")).toBeNull();

    // Not an empty test either; the navbar stays, so the student
    // can still log out
    expect(screen.queryByText("Testas dar neparuoštas")).toBeNull();
    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
    expect(hardNavigations()).toEqual([]);
  });


  it("'Bandyti dar kartą' after a failed load asks again — the spinner, then the test", async () => {
    const retry = deferred();
    backend.once("GET", QUESTIONS, reply.status(500, "Internal Server Error"));
    backend.once("GET", QUESTIONS, () => retry.promise);
    const { user } = renderPage(<TestHome />, { path: "/student" });

    await user.click(await screen.findByRole("button", { name: "Bandyti dar kartą" }));

    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => retry.resolve(reply.json(fx.dealtTest(3))));

    expect(await screen.findByRole("heading", { name: questionTitle(1, 3) })).toBeInTheDocument();
    const requests = backend.requests();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ client: "axios", method: "GET", url: QUESTIONS, withCredentials: true });
    expect(reloadCount()).toBe(0);
  });


  // Development builds mount every component twice (the app
  // renders in StrictMode) — two loads race, and only the newest
  // may count. StrictMode must wrap the WHOLE tree to replay the
  // effects, so the page is rendered bare, inside a router only
  it("under StrictMode's double mount only the newest load counts — a failed first one hides nothing", async () => {
    backend.once("GET", QUESTIONS, reply.status(500, "Internal Server Error"));
    backend.once("GET", QUESTIONS, reply.json(fx.dealtTest(3)));
    render(<TestHome />, {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/student"]}>{children}</MemoryRouter>,
      reactStrictMode: true,
    });

    expect(await screen.findByRole("heading", { name: questionTitle(1, 3) })).toBeInTheDocument();
    await settle();

    expect(backend.requests("GET", QUESTIONS)).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});







// -----------------------------------------------------------
// Nothing to answer
// -----------------------------------------------------------

describe("TestHome — nothing to answer", () => {

  it.each([
    ["{} (a finished test or an admin session)", {}],
    ["[] (no enabled question in the bank)", []],
  ])("%s shows 'Testas dar neparuoštas' instead of a question", async (_, payload) => {
    backend.on("GET", QUESTIONS, reply.json(payload));
    renderPage(<TestHome />, { path: "/student" });

    expect(await screen.findByText("Testas dar neparuoštas")).toBeInTheDocument();
    expect(screen.getByText("Šiuo metu nėra nė vieno klausimo. Bandykite dar kartą vėliau.")).toBeInTheDocument();
    expect(screen.queryByText("Kraunasi...")).toBeNull();
    expect(screen.queryByAltText(EMAIL)).toBeNull();
    expect(screen.queryByRole("button", { name: "Užbaigti testą" })).toBeNull();
  });


  it("'Bandyti dar kartą' reloads the page", async () => {
    backend.on("GET", QUESTIONS, reply.json([]));
    const { user } = renderPage(<TestHome />, { path: "/student" });

    await user.click(await screen.findByRole("button", { name: "Bandyti dar kartą" }));

    expect(reloadCount()).toBe(1);
    expect(hardNavigations()).toEqual([]);
  });


  it("keeps the navbar, so the student can still log out, and sends nothing", async () => {
    backend.on("GET", QUESTIONS, reply.json({}));
    renderPage(<TestHome />, { path: "/student" });
    await screen.findByText("Testas dar neparuoštas");
    await settle();

    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
    expect(backend.requests()).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// The open question
// -----------------------------------------------------------

describe("TestHome — the open question", () => {

  it("heads the card 'Klausimas 1 / N' with the zoom hint, between navbar and footer", async () => {
    await openTest(fx.dealtTest(3));

    expect(heading(1, 3)).toBeInTheDocument();
    expect(screen.getByText("Spustelėkite paveikslėlį, kad padidintumėte")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
    expect(screen.getByText("Copyright © | All Rights Reserved | VUKnF")).toBeInTheDocument();
  });


  it("shows the email picture by the question's own ID", async () => {
    await openTest([fx.studentQuestion({ questionid: 57 }), fx.studentQuestion({ questionid: 23 })]);

    expect(screen.getByAltText(EMAIL)).toHaveAttribute("src", "/api/phishingpictures/57");
  });


  it("lists the follow-up options in the order sent, unticked in a fresh test", async () => {
    await openTest(fx.dealtTest(2));

    expect(screen.getByRole("heading", { name: "Klausimai", level: 3 })).toBeInTheDocument();
    expect(optionRows()).toEqual([[SENDER_OPTION, false], [LINK_OPTION, false]]);
  });


  it("ticks exactly the options saved with isselected 1 — 0 and null stay unticked", async () => {
    await openTest([
      fx.studentQuestion({
        questionid: 11,
        questionoptions: [
          fx.studentOption({ answeroptionid: 111, answeroption: SENDER_OPTION, isselected: 0 }),
          fx.studentOption({ answeroptionid: 112, answeroption: LINK_OPTION, isselected: 1 }),
          fx.studentOption({ answeroptionid: 113, answeroption: URGENT_OPTION, isselected: null }),
        ],
      }),
    ]);

    expect(optionRows()).toEqual([[SENDER_OPTION, false], [LINK_OPTION, true], [URGENT_OPTION, false]]);
  });


  // The option text sits next to the checkbox, not in a label —
  // without a name of its own a screen reader says just "checkbox"
  it("names each follow-up checkbox after its option text", async () => {
    const { user } = await openTest(twoQuestions());

    expect(screen.getByRole("checkbox", { name: SENDER_OPTION })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: LINK_OPTION })).not.toBeChecked();

    await user.click(jumpButton(2));

    expect(screen.getByRole("checkbox", { name: URGENT_OPTION })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: TYPOS_OPTION })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: SENDER_OPTION })).toBeNull();
  });


  it("shows the question's extra text under 'Papildomai:'", async () => {
    await openTest([fx.studentQuestion({ questionid: 11, question: "Atkreipkite dėmesį į „Banko“ logotipą ir siuntėjo adresą." })]);

    const extra = screen.getByText("Atkreipkite dėmesį į „Banko“ logotipą ir siuntėjo adresą.");
    expect(within(extra).getByText("Papildomai:")).toBeInTheDocument();
  });


  it("shows no 'Papildomai:' block when `question` is empty", async () => {
    await openTest(fx.dealtTest(2));

    expect(screen.queryByText("Papildomai:")).toBeNull();
  });


  it("offers both verdicts with neither chosen for an unanswered question", async () => {
    await openTest(fx.dealtTest(2));

    expect(verdict("Tikras")).not.toHaveClass(BURGUNDY);
    expect(verdict("Fišingas")).not.toHaveClass(BURGUNDY);
  });


  it("resumes a half-done test as the server saved it — without saving anything", async () => {
    const saved = fx.dealtTest(3);
    saved[0].selectedanswer = 1;
    saved[0].questionoptions[0].isselected = 1;
    saved[0].questionoptions[1].isselected = 0;
    saved[1].selectedanswer = 0;
    await openTest(saved);
    await settle();

    expect(verdict("Fišingas")).toHaveClass(BURGUNDY);
    expect(verdict("Tikras")).not.toHaveClass(BURGUNDY);
    expect(optionRows()).toEqual([[SENDER_OPTION, true], [LINK_OPTION, false]]);
    expect(screen.getByText("Atsakyta: 2 / 3")).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });


  it("shows a saved 'Tikras' (0) as chosen — 0 is an answer, not a blank", async () => {
    const saved = fx.dealtTest(1);
    saved[0].selectedanswer = 0;
    await openTest(saved);

    expect(verdict("Tikras")).toHaveClass(BURGUNDY);
    expect(verdict("Fišingas")).not.toHaveClass(BURGUNDY);
    expect(screen.getByText("Atsakyta: 1 / 1")).toBeInTheDocument();
  });


  it("shows no checkboxes for a question without follow-up options", async () => {
    await openTest([fx.studentQuestion({ questionid: 11, questionoptions: [] })]);

    expect(optionRows()).toEqual([]);
    expect(verdict("Fišingas")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// The "Tikras" / "Fišingas" verdict
// -----------------------------------------------------------

describe("TestHome — the 'Tikras' / 'Fišingas' verdict", () => {

  it("'Fišingas' fills its button burgundy and saves selectedanswer 1", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));

    expect(verdict("Fišingas")).toHaveClass(BURGUNDY);
    expect(verdict("Tikras")).not.toHaveClass(BURGUNDY);
    expect(verdict("Tikras")).toHaveClass("bg-white");

    await waitFor(() => expect(saves()).toHaveLength(1));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expect(saves()[0].json).toEqual(expected);
  });


  it("'Tikras' fills its button burgundy and saves selectedanswer 0", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Tikras"));

    expect(verdict("Tikras")).toHaveClass(BURGUNDY);
    expect(verdict("Fišingas")).not.toHaveClass(BURGUNDY);
    expect(verdict("Fišingas")).toHaveClass("bg-white");

    await waitFor(() => expect(saves()).toHaveLength(1));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 0;
    expect(saves()[0].json).toEqual(expected);
  });


  it("switching the verdict moves the highlight and saves the new one", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Tikras"));
    await waitFor(() => expect(saves()).toHaveLength(1));
    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(saves()).toHaveLength(2));

    expect(verdict("Fišingas")).toHaveClass(BURGUNDY);
    expect(verdict("Tikras")).not.toHaveClass(BURGUNDY);

    const real = fx.dealtTest(2);
    real[0].selectedanswer = 0;
    const phishing = fx.dealtTest(2);
    phishing[0].selectedanswer = 1;
    expect(saves().map((save) => save.json)).toEqual([real, phishing]);
  });


  it("scrolls the page down to the follow-up options", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));
    expect(window.scrollTo).not.toHaveBeenCalled();

    await user.click(verdict("Fišingas"));

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: document.body.scrollHeight, behavior: "smooth" });
  });


  it("counts the question as answered in the sidebar at once", async () => {
    const { user } = await openTest(fx.dealtTest(3));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Tikras"));

    expect(screen.getByText("Atsakyta: 1 / 3")).toBeInTheDocument();
    expect(jumpButton(1)).toHaveClass(BURGUNDY);
    expect(jumpButton(2)).not.toHaveClass(BURGUNDY);
  });
});







// -----------------------------------------------------------
// Autosave
// -----------------------------------------------------------

describe("TestHome — autosave: every change POSTs the whole test", () => {

  it("sends nothing before the student answers — browsing and zooming included", async () => {
    const { user } = await openTest(fx.dealtTest(3));

    await user.click(jumpButton(2));
    await user.click(screen.getByAltText(EMAIL));
    await user.click(screen.getByRole("button", { name: "Atgal" }));
    await user.click(jumpButton(1));
    await settle();

    expect(backend.requests("POST")).toHaveLength(0);
    expect(backend.requests()).toHaveLength(1);
  });


  it("POSTs every question back as received, with the change applied and the session cookie", async () => {
    const { user } = await openTest(fx.dealtTest(3));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(saves()).toHaveLength(1));

    expect(saves()[0]).toMatchObject({ client: "axios", method: "POST", url: QUESTIONS, withCredentials: true });

    // Every question with every field — questionid,
    // selectedanswer, question, questionoptions (answeroptionid,
    // answeroption, isselected) — the untouched ones included
    const expected = fx.dealtTest(3);
    expected[0].selectedanswer = 1;
    expect(saves()[0].json).toEqual(expected);
  });


  it("saves every option toggle: isselected null → 1 → 0 → 1", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(screen.getByText(SENDER_OPTION));
    await waitFor(() => expect(saves()).toHaveLength(1));
    expect(optionRows()).toEqual([[SENDER_OPTION, true], [LINK_OPTION, false]]);

    await user.click(screen.getByText(SENDER_OPTION));
    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(optionRows()).toEqual([[SENDER_OPTION, false], [LINK_OPTION, false]]);

    await user.click(screen.getByText(SENDER_OPTION));
    await waitFor(() => expect(saves()).toHaveLength(3));
    expect(optionRows()).toEqual([[SENDER_OPTION, true], [LINK_OPTION, false]]);

    const expected = [1, 0, 1].map((isselected) => {
      const state = fx.dealtTest(2);
      state[0].questionoptions[0].isselected = isselected;
      return state;
    });
    expect(saves().map((save) => save.json)).toEqual(expected);

    // Only a verdict scrolls the page
    expect(window.scrollTo).not.toHaveBeenCalled();
  });


  it("a click on the checkbox itself toggles its option too — once", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(screen.getAllByRole("checkbox")[1]);
    await waitFor(() => expect(saves()).toHaveLength(1));
    await settle();

    expect(saves()).toHaveLength(1);
    expect(optionRows()).toEqual([[SENDER_OPTION, false], [LINK_OPTION, true]]);
    const expected = fx.dealtTest(2);
    expected[0].questionoptions[1].isselected = 1;
    expect(saves()[0].json).toEqual(expected);
  });


  it("carries the answers saved earlier along with each new change", async () => {
    const saved = fx.dealtTest(3);
    saved[0].selectedanswer = 1;
    saved[0].questionoptions[1].isselected = 1;
    const { user } = await openTest(saved);
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(jumpButton(3));
    await user.click(verdict("Tikras"));
    await waitFor(() => expect(saves()).toHaveLength(1));

    const expected = fx.dealtTest(3);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[1].isselected = 1;
    expected[2].selectedanswer = 0;
    expect(saves()[0].json).toEqual(expected);
  });


  it("sends every text back exactly as received", async () => {
    const question = () => fx.studentQuestion({
      questionid: 11,
      question: "Ar „Bankas“ tikrai rašytų: „Jūsų sąskaita užblokuota“?",
      questionoptions: [
        fx.studentOption({ answeroptionid: 111, answeroption: "Raginama skubėti — „per 24 valandas“" }),
        fx.studentOption({ answeroptionid: 112, answeroption: "Pasirašyta „ŠVIETIMO ĮSTAIGŲ ŽINYNAS“" }),
      ],
    });
    const { user } = await openTest([question()]);
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(saves()).toHaveLength(1));

    const expected = [question()];
    expected[0].selectedanswer = 1;
    expect(saves()[0].json).toEqual(expected);
  });


  // What the page hands axios is read again later (a follow-up
  // save sends the newest state) — so a state, once built, is
  // never edited: the next click builds a new one
  it("hands every save a state of its own — later clicks never change it", async () => {
    const post = vi.spyOn(axios, "post");
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(saves()).toHaveLength(1));
    const firstState = post.mock.calls[0][1];

    await user.click(screen.getByText(SENDER_OPTION));
    await user.click(verdict("Tikras"));
    await waitFor(() => expect(saves()).toHaveLength(3));

    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expect(JSON.parse(JSON.stringify(firstState))).toEqual(expected);
    expect(saves()[0].json).toEqual(expected);
  });
});







// -----------------------------------------------------------
// One save at a time
// -----------------------------------------------------------
//
// The page's core guarantee: a POST leaves only once the one
// before it has landed, and the clicks made meanwhile are
// coalesced into ONE follow-up carrying the newest state — an
// older state can never overtake (and overwrite) a newer one.
// -----------------------------------------------------------

describe("TestHome — one save at a time", () => {

  it("holds the clicks made during a save, then sends ONE follow-up with the newest state", async () => {
    const { user } = await openTest(fx.dealtTest(3));
    const first = deferred();
    backend.once("POST", QUESTIONS, () => first.promise);
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));
    await user.click(screen.getByText(LINK_OPTION));
    await user.click(verdict("Tikras"));
    await settle();
    expect(saves()).toHaveLength(1);

    await act(async () => first.resolve(reply.text("OK")));
    await waitFor(() => expect(saves()).toHaveLength(2));
    await settle();
    expect(saves()).toHaveLength(2);

    const firstClick = fx.dealtTest(3);
    firstClick[0].selectedanswer = 1;
    expect(saves()[0].json).toEqual(firstClick);

    const allClicks = fx.dealtTest(3);
    allClicks[0].selectedanswer = 0;
    allClicks[0].questionoptions[0].isselected = 1;
    allClicks[0].questionoptions[1].isselected = 1;
    expect(saves()[1].json).toEqual(allClicks);
    expect(saves()[1].withCredentials).toBe(true);
  });


  it("never has two saves on the wire at once", async () => {
    const { user } = await openTest(fx.dealtTest(2));

    // Every save is held until the test lets it land; the
    // counter drops before the page can see the reply
    const held = [];
    let onTheWire = 0;
    let mostOnTheWire = 0;
    backend.on("POST", QUESTIONS, () => {
      onTheWire += 1;
      mostOnTheWire = Math.max(mostOnTheWire, onTheWire);
      const save = deferred();
      held.push(save);
      return save.promise.finally(() => {
        onTheWire -= 1;
      });
    });

    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));
    await user.click(verdict("Tikras"));
    expect(held).toHaveLength(1);

    await act(async () => held[0].resolve(reply.text("OK")));
    await waitFor(() => expect(held).toHaveLength(2));
    await user.click(screen.getByText(LINK_OPTION));
    await user.click(screen.getByText(LINK_OPTION));
    expect(held).toHaveLength(2);

    await act(async () => held[1].resolve(reply.text("OK")));
    await waitFor(() => expect(held).toHaveLength(3));
    await act(async () => held[2].resolve(reply.text("OK")));
    await settle();

    expect(held).toHaveLength(3);
    expect(mostOnTheWire).toBe(1);
    expect(onTheWire).toBe(0);

    const second = fx.dealtTest(2);
    second[0].selectedanswer = 0;
    second[0].questionoptions[0].isselected = 1;
    const third = fx.dealtTest(2);
    third[0].selectedanswer = 0;
    third[0].questionoptions[0].isselected = 1;
    third[0].questionoptions[1].isselected = 0;
    expect(saves().slice(1).map((save) => save.json)).toEqual([second, third]);
  });


  it("sends the next click at once after the queue has drained", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const first = deferred();
    backend.once("POST", QUESTIONS, () => first.promise);
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));
    await act(async () => first.resolve(reply.text("OK")));
    await waitFor(() => expect(saves()).toHaveLength(2));
    await settle();

    await user.click(screen.getByText(LINK_OPTION));

    await waitFor(() => expect(saves()).toHaveLength(3));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[0].isselected = 1;
    expected[0].questionoptions[1].isselected = 1;
    expect(saves()[2].json).toEqual(expected);
  });
});







// -----------------------------------------------------------
// A failed save
// -----------------------------------------------------------

describe("TestHome — a failed save", () => {

  it.each([
    ["a server error (500)", reply.status(500, "Internal Server Error")],
    ["no connection", reply.networkError()],
  ])("%s toasts 'Nepavyko išsaugoti atsakymo — patikrinkite ryšį'", async (_, failure) => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, failure);

    await user.click(verdict("Fišingas"));

    await findToast(SAVE_FAILED);
    expect(saves()).toHaveLength(1);
    expect(hardNavigations()).toEqual([]);
  });


  it("keeps the student's answer on screen", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.status(500, "Internal Server Error"));

    await user.click(verdict("Fišingas"));
    await findToast(SAVE_FAILED);

    expect(verdict("Fišingas")).toHaveClass(BURGUNDY);
    expect(screen.getByText("Atsakyta: 1 / 2")).toBeInTheDocument();
  });


  it("the next click sends the newest state again", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.once("POST", QUESTIONS, reply.status(500, "Internal Server Error"));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await findToast(SAVE_FAILED);
    await user.click(screen.getByText(LINK_OPTION));

    await waitFor(() => expect(saves()).toHaveLength(2));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[1].isselected = 1;
    expect(saves()[1].json).toEqual(expected);
  });


  it("still sends the clicks queued behind the failed one", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const first = deferred();
    backend.once("POST", QUESTIONS, () => first.promise);
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));
    await act(async () => first.resolve(reply.status(502, "Bad Gateway")));

    await findToast(SAVE_FAILED);
    await waitFor(() => expect(saves()).toHaveLength(2));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[0].isselected = 1;
    expect(saves()[1].json).toEqual(expected);
  });


  // The session ended — e.g. the student opened /login in another
  // tab of the same browser, which logs out. The connection is
  // fine, and every further save would be refused as well
  it("a save refused with 401 sends the browser to /login — no connection toast, and nothing is sent after it", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.status(401, "Unauthorized"));

    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/login"]));

    // A click while the browser leaves
    await user.click(screen.getByText(LINK_OPTION));
    await settle();

    expect(saves()).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
    expect(hardNavigations()).toEqual(["/login"]);
  });


  it("a save refused with 401 drops the clicks queued behind it", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const first = deferred();
    backend.once("POST", QUESTIONS, () => first.promise);
    backend.on("POST", QUESTIONS, reply.status(401, "Unauthorized"));

    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));
    await act(async () => first.resolve(reply.status(401, "Unauthorized")));
    await settle();

    expect(hardNavigations()).toEqual(["/login"]);
    expect(saves()).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
  });


  // `{}` — the test is locked (finished, e.g. on another device)
  // or the session is not a student's. "/" routes the browser by
  // the real state: the results, or the admin pages
  it("a save answered `{}` sends the browser to '/' — no toast, and nothing is sent after it", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.json({}));

    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    // A click while the browser leaves
    await user.click(screen.getByText(LINK_OPTION));
    await settle();

    expect(saves()).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
    expect(hardNavigations()).toEqual(["/"]);
  });


  // The backend refuses a body it cannot take with HTTP 200 all
  // the same — only "OK" means stored
  it("a save answered 'Error: …' (a refused body) is a failed save — the toast, and the next click sends again", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.once("POST", QUESTIONS, reply.text("Error: This is not questions state object"));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await findToast(SAVE_FAILED);

    await user.click(screen.getByText(LINK_OPTION));
    await waitFor(() => expect(saves()).toHaveLength(2));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[1].isselected = 1;
    expect(saves()[1].json).toEqual(expected);
    expect(hardNavigations()).toEqual([]);
  });
});







// -----------------------------------------------------------
// Moving between questions
// -----------------------------------------------------------

describe("TestHome — moving between questions", () => {

  it("the sidebar buttons open another question", async () => {
    const { user } = await openTest(fx.dealtTest(3));

    await user.click(jumpButton(2));

    expect(heading(2, 3)).toBeInTheDocument();
    expect(screen.getByAltText(EMAIL)).toHaveAttribute("src", "/api/phishingpictures/12");
    expect(jumpButton(2)).toHaveClass("ring-2");
    expect(jumpButton(1)).not.toHaveClass("ring-2");

    await user.click(jumpButton(3));

    expect(heading(3, 3)).toBeInTheDocument();
    expect(screen.getByAltText(EMAIL)).toHaveAttribute("src", "/api/phishingpictures/13");
  });


  it("shows each question's own options and extra text", async () => {
    const { user } = await openTest(twoQuestions());

    expect(optionRows()).toEqual([[SENDER_OPTION, false], [LINK_OPTION, false]]);
    expect(screen.getByText("Laiškas atėjo į universiteto pašto dėžutę.")).toBeInTheDocument();

    await user.click(jumpButton(2));

    expect(optionRows()).toEqual([[URGENT_OPTION, false], [TYPOS_OPTION, false]]);
    expect(screen.queryByText("Papildomai:")).toBeNull();
  });


  it("keeps each question's answers when moving back and forth", async () => {
    const { user } = await openTest(twoQuestions());
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(LINK_OPTION));

    await user.click(jumpButton(2));
    expect(verdict("Fišingas")).not.toHaveClass(BURGUNDY);
    expect(verdict("Tikras")).not.toHaveClass(BURGUNDY);
    expect(optionRows()).toEqual([[URGENT_OPTION, false], [TYPOS_OPTION, false]]);

    await user.click(verdict("Tikras"));
    await user.click(screen.getByText(TYPOS_OPTION));

    await user.click(jumpButton(1));
    expect(heading(1, 2)).toBeInTheDocument();
    expect(verdict("Fišingas")).toHaveClass(BURGUNDY);
    expect(verdict("Tikras")).not.toHaveClass(BURGUNDY);
    expect(optionRows()).toEqual([[SENDER_OPTION, false], [LINK_OPTION, true]]);

    await user.click(jumpButton(2));
    expect(verdict("Tikras")).toHaveClass(BURGUNDY);
    expect(optionRows()).toEqual([[URGENT_OPTION, false], [TYPOS_OPTION, true]]);

    await settle();
    const expected = twoQuestions();
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[1].isselected = 1;
    expected[1].selectedanswer = 0;
    expected[1].questionoptions[1].isselected = 1;
    expect(backend.lastRequest("POST", QUESTIONS).json).toEqual(expected);
  });


  it("every save carries all the questions, whichever one is open", async () => {
    const { user } = await openTest(fx.dealtTest(3));
    backend.on("POST", QUESTIONS, reply.text("OK"));

    await user.click(jumpButton(2));
    await user.click(screen.getByText(LINK_OPTION));
    await waitFor(() => expect(saves()).toHaveLength(1));

    const expected = fx.dealtTest(3);
    expected[1].questionoptions[1].isselected = 1;
    expect(saves()[0].json).toEqual(expected);

    // A ticked option alone is no verdict — still unanswered
    expect(screen.getByText("Atsakyta: 0 / 3")).toBeInTheDocument();
  });


  it("handles a full-size test of 30 questions", async () => {
    const { user } = await openTest(fx.dealtTest(30));
    backend.on("POST", QUESTIONS, reply.text("OK"));
    expect(screen.getByText("Atsakyta: 0 / 30")).toBeInTheDocument();

    await user.click(jumpButton(30));

    expect(heading(30, 30)).toBeInTheDocument();
    expect(screen.getByAltText(EMAIL)).toHaveAttribute("src", "/api/phishingpictures/40");

    await user.click(verdict("Tikras"));
    await waitFor(() => expect(saves()).toHaveLength(1));

    const expected = fx.dealtTest(30);
    expected[29].selectedanswer = 0;
    expect(saves()[0].json).toEqual(expected);
    expect(screen.getByText("Atsakyta: 1 / 30")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Finishing the test
// -----------------------------------------------------------
//
// Finishing is a full page load of /student/finish, which
// aborts whatever request is still running — so it may only
// happen once the newest answers are safely on the server.
// -----------------------------------------------------------

describe("TestHome — finishing the test", () => {

  it("with nothing to save, loads /student/finish at once (a full page load)", async () => {
    await openTest(fx.dealtTest(2));

    finish();

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(0);
  });


  it("after the last save has landed, leaves at once and sends nothing more", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.text("OK"));
    await user.click(verdict("Fišingas"));
    await settle();

    finish();

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(1);
  });


  it("waits for a save in flight and leaves only once it has landed", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const running = deferred();
    backend.once("POST", QUESTIONS, () => running.promise);
    await user.click(verdict("Fišingas"));

    finish();
    await settle();
    expect(hardNavigations()).toEqual([]);

    await act(async () => running.resolve(reply.text("OK")));

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(1);
  });


  it("also waits for the clicks queued behind the running save", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const first = deferred();
    const followUp = deferred();
    backend.once("POST", QUESTIONS, () => first.promise);
    backend.once("POST", QUESTIONS, () => followUp.promise);
    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));

    finish();
    await act(async () => first.resolve(reply.text("OK")));
    await waitFor(() => expect(saves()).toHaveLength(2));
    await settle();
    expect(hardNavigations()).toEqual([]);

    await act(async () => followUp.resolve(reply.text("OK")));

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[0].isselected = 1;
    expect(saves()[1].json).toEqual(expected);
  });


  it("after a failed save, re-sends the newest state once and then leaves", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.status(500, "Internal Server Error"));
    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(LINK_OPTION));
    await waitFor(() => expect(saves()).toHaveLength(2));
    await settle();

    backend.on("POST", QUESTIONS, reply.text("OK"));
    finish();

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(3);
    expect(saves()[2]).toMatchObject({ client: "axios", method: "POST", url: QUESTIONS, withCredentials: true });
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expected[0].questionoptions[1].isselected = 1;
    expect(saves()[2].json).toEqual(expected);
  });


  it("re-sends once when the save it waited for fails, then leaves", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const running = deferred();
    backend.once("POST", QUESTIONS, () => running.promise);
    backend.on("POST", QUESTIONS, reply.text("OK"));
    await user.click(verdict("Fišingas"));

    finish();
    await act(async () => running.resolve(reply.networkError()));

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(2);
    const expected = fx.dealtTest(2);
    expected[0].selectedanswer = 1;
    expect(saves()[1].json).toEqual(expected);
  });


  it("needs no re-send when a follow-up landed after a failed save", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const first = deferred();
    backend.once("POST", QUESTIONS, () => first.promise);
    backend.on("POST", QUESTIONS, reply.text("OK"));
    await user.click(verdict("Fišingas"));
    await user.click(screen.getByText(SENDER_OPTION));
    await act(async () => first.resolve(reply.status(500, "Internal Server Error")));
    await waitFor(() => expect(saves()).toHaveLength(2));
    await settle();

    finish();

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(2);
  });


  it.each([
    ["no connection", reply.networkError()],
    ["a refused body, 'Error: …'", reply.text("Error: This is not questions state object")],
  ])("still failing (%s): says the last answers are not saved and stays on the test", async (_, failure) => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, failure);
    await user.click(verdict("Fišingas"));
    await findToast(SAVE_FAILED);

    finish();

    await findToast(NOT_SAVED);
    await settle();
    expect(hardNavigations()).toEqual([]);
    // The failed save plus exactly ONE retry
    expect(saves()).toHaveLength(2);
    expect(heading(1, 2)).toBeInTheDocument();
  });


  it("finishes on a later try once the connection is back", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.networkError());
    await user.click(verdict("Fišingas"));
    finish();
    await findToast(NOT_SAVED);

    backend.on("POST", QUESTIONS, reply.text("OK"));
    finish();

    await waitFor(() => expect(hardNavigations()).toEqual(["/student/finish"]));
    expect(saves()).toHaveLength(3);
  });


  // The test was locked meanwhile (e.g. finished on another
  // device) — "/" knows where a finished student belongs
  it("a save answered `{}` while finishing sends the browser to '/' — not to the results, and without a toast", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    const running = deferred();
    backend.once("POST", QUESTIONS, () => running.promise);
    await user.click(verdict("Fišingas"));

    finish();
    await act(async () => running.resolve(reply.json({})));

    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
    await settle();
    expect(hardNavigations()).toEqual(["/"]);
    expect(saves()).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
  });


  it("after a save refused with 401, finishing re-sends nothing and claims no connection problem — the browser is on its way to /login", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.on("POST", QUESTIONS, reply.status(401, "Unauthorized"));
    await user.click(verdict("Fišingas"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/login"]));

    finish();
    await settle();

    expect(hardNavigations()).toEqual(["/login"]);
    expect(toastTexts()).toEqual([]);
    expect(saves()).toHaveLength(1);
  });


  it("a re-send refused with 401 while finishing goes to /login — not to the results, and with no 'not saved' toast", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    backend.once("POST", QUESTIONS, reply.status(500, "Internal Server Error"));
    backend.on("POST", QUESTIONS, reply.status(401, "Unauthorized"));
    await user.click(verdict("Fišingas"));
    await findToast(SAVE_FAILED);

    finish();

    await waitFor(() => expect(hardNavigations()).toEqual(["/login"]));
    await settle();
    expect(hardNavigations()).toEqual(["/login"]);
    expect(saves()).toHaveLength(2);
    expect(toastTexts()).toEqual([SAVE_FAILED]);
  });


  // Back after finishing can bring the test page back from the
  // browser's back-forward cache — the locked test clickable
  it("reloads when the browser restores the page from its back-forward cache", async () => {
    const { unmount } = await openTest(fx.dealtTest(2));

    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: false }));
    expect(reloadCount()).toBe(0);

    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(reloadCount()).toBe(1);

    // The listener leaves with the page
    unmount();
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(reloadCount()).toBe(1);
  });


  it("an early release does not finish — the page's toaster asks to hold longer", async () => {
    await openTest(fx.dealtTest(2));

    longPress(screen.getByRole("button", { name: "Užbaigti testą" }), 800);

    await findToast("Laikykite mygtuką ilgiau, kad užbaigtumėte testą");
    await settle();
    expect(hardNavigations()).toEqual([]);
  });
});







// -----------------------------------------------------------
// The fullscreen email
// -----------------------------------------------------------

describe("TestHome — the fullscreen email", () => {

  it("clicking the email opens it fullscreen, with an 'Atgal' button", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    expect(screen.queryByRole("button", { name: "Atgal" })).toBeNull();

    await user.click(screen.getByAltText(EMAIL));

    expect(within(fullscreen()).getByAltText(EMAIL)).toHaveAttribute("src", "/api/phishingpictures/11");
    // The card's email stays underneath
    expect(screen.getAllByAltText(EMAIL)).toHaveLength(2);
  });


  it("shows the email of the question that is open", async () => {
    const { user } = await openTest(fx.dealtTest(3));
    await user.click(jumpButton(3));

    await user.click(screen.getByAltText(EMAIL));

    expect(within(fullscreen()).getByAltText(EMAIL)).toHaveAttribute("src", "/api/phishingpictures/13");
  });


  it("'Atgal' closes it", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    await user.click(screen.getByAltText(EMAIL));

    await user.click(screen.getByRole("button", { name: "Atgal" }));

    expect(screen.queryByRole("button", { name: "Atgal" })).toBeNull();
    expect(screen.getAllByAltText(EMAIL)).toHaveLength(1);
  });


  it("a click on the dark backdrop closes it", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    await user.click(screen.getByAltText(EMAIL));

    await user.click(fullscreen());

    expect(screen.queryByRole("button", { name: "Atgal" })).toBeNull();
  });


  it("a click on the zoomed email closes it as well", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    await user.click(screen.getByAltText(EMAIL));

    await user.click(within(fullscreen()).getByAltText(EMAIL));

    expect(screen.queryByRole("button", { name: "Atgal" })).toBeNull();
  });


  it("Escape closes it; other keys do not", async () => {
    const { user } = await openTest(fx.dealtTest(2));
    await user.click(screen.getByAltText(EMAIL));

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Atgal" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Atgal" })).toBeNull();
  });
});







// -----------------------------------------------------------
// Link areas and their URLs
// -----------------------------------------------------------

describe("TestHome — link areas and their URLs", () => {

  it("fetches the email's link areas once its picture has loaded — a plain fetch", async () => {
    backend.on("GET", linksOf(11), reply.json([fx.questionLink()]));
    const { container } = await openTest(fx.dealtTest(2));
    await settle();
    expect(backend.requests("GET", linksOf(11))).toHaveLength(0);

    fireEvent.load(screen.getByAltText(EMAIL));

    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));
    const requests = backend.requests("GET", linksOf(11));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "fetch", method: "GET", url: linksOf(11) });
    expect(requests[0].credentials).toBeUndefined();
    expect(requests[0].headers).toEqual({});
    expect(requests[0].body).toBeUndefined();
  });


  it("hovering an area shows its URL; moving off hides it again", async () => {
    backend.on("GET", linksOf(11), reply.json([
      fx.questionLink({ id: 1, url: "https://bankas-saugumas.example/prisijungti" }),
      fx.questionLink({ id: 2, url: "https://www.bankas.example", y: "80%" }),
    ]));
    const { container } = await openTest(fx.dealtTest(2));
    fireEvent.load(screen.getByAltText(EMAIL));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(2));
    expect(screen.queryByText("https://bankas-saugumas.example/prisijungti")).toBeNull();

    fireEvent.mouseEnter(linkAreas(container)[0]);

    expect(screen.getByText("https://bankas-saugumas.example/prisijungti")).toBeInTheDocument();
    expect(screen.queryByText("https://www.bankas.example")).toBeNull();

    fireEvent.mouseLeave(linkAreas(container)[0]);

    expect(screen.queryByText("https://bankas-saugumas.example/prisijungti")).toBeNull();
  });


  it("draws the areas invisibly — the student has to hover to find the links", async () => {
    backend.on("GET", linksOf(11), reply.json([fx.questionLink()]));
    const { container } = await openTest(fx.dealtTest(1));
    fireEvent.load(screen.getByAltText(EMAIL));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    const [area] = linkAreas(container);
    // A color the style engine kept — two dropped ("") values
    // would compare equal too
    expect(area.style.backgroundColor).not.toBe("");
    expect(area.style.backgroundColor).toBe(parsedColor("rgba(0, 0, 0, 0.0)"));
    // …not InteractiveImage's default yellow highlight
    expect(area.style.backgroundColor).not.toBe(parsedColor("rgba(255, 255, 0, 0.5)"));
  });


  it("the fullscreen email fetches its own areas and shows the URLs as well", async () => {
    backend.on("GET", linksOf(11), reply.json([fx.questionLink({ id: 1, url: "https://bankas-saugumas.example/prisijungti" })]));
    const { user } = await openTest(fx.dealtTest(2));
    await user.click(screen.getByAltText(EMAIL));

    const overlay = fullscreen();
    fireEvent.load(within(overlay).getByAltText(EMAIL));
    await waitFor(() => expect(linkAreas(overlay)).toHaveLength(1));
    expect(backend.requests("GET", linksOf(11))).toHaveLength(1);

    fireEvent.mouseEnter(linkAreas(overlay)[0]);

    expect(within(overlay).getByText("https://bankas-saugumas.example/prisijungti")).toBeInTheDocument();
  });


  it("the next question's email fetches its own areas once it has loaded", async () => {
    backend.on("GET", linksOf(11), reply.json([fx.questionLink({ id: 1, url: "https://pirmas.example" })]));
    backend.on("GET", linksOf(12), reply.json([
      fx.questionLink({ id: 2, url: "https://antras.example" }),
      fx.questionLink({ id: 3, url: "https://trecias.example", y: "70%" }),
    ]));
    const { user, container } = await openTest(fx.dealtTest(2));
    fireEvent.load(screen.getByAltText(EMAIL));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    await user.click(jumpButton(2));

    // Nothing is drawn over an email that has not loaded yet
    expect(linkAreas(container)).toHaveLength(0);

    fireEvent.load(screen.getByAltText(EMAIL));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(2));
    expect(backend.requests("GET", linksOf(11))).toHaveLength(1);
    expect(backend.requests("GET", linksOf(12))).toHaveLength(1);

    fireEvent.mouseEnter(linkAreas(container)[0]);

    expect(screen.getByText("https://antras.example")).toBeInTheDocument();
  });
});
