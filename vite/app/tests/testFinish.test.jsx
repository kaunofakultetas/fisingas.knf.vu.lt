// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — TestFinish, the results page
//
//  src/systemPages/StudentPages/TestFinish/TestFinish.jsx —
//  /student/finish, where the test ends (and where every later
//  visit of a finished student lands):
//    - on mount, at once and only once: GET
//      /api/admin/students/<authData.userid> (the student's own
//      StudentDetail, through useFetchData) and GET
//      /api/student/finish (the state-changing GET that ends
//      the test) — both axios, withCredentials
//    - "Kraunasi..." until the record arrives; a 401 on it is a
//      full navigation to /login
//    - loaded: "Testas baigtas!", the credentials to write down
//      (Vardas / Kodas — from authData, not from the record),
//      the grade tile (the testgrade string as sent) and three
//      "x / y" count tiles; the blank-field contract ("" — no
//      test dealt) reads 0 and 0 / 0
//    - any failure of the finish call toasts "Nepavyko užbaigti
//      testo — perkraukite puslapį" through the page's own
//      <Toaster/>; the results stay
//    - under the summary, the StudentAnswers review: GET
//      /api/admin/students/<userid>/answers, sent once the
//      record has loaded (the review is not mounted before)
//
//  The review cards themselves are pinned in
//  studentAnswers.test.jsx. Pinned in knownBugs.test.jsx
//  instead: a failed record load (500 / no connection) showing
//  a 0 grade and "0 / 0" tiles (KB-19) and a failed review load
//  leaving the review blank (KB-20) — the failure tests here
//  assert only what stays on screen, never what a failed load
//  renders in its place.
// -----------------------------------------------------------

import "./support/setup";

import { useState } from "react";
import { describe, it, expect } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { hardNavigations } from "./support/navigation";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import * as fx from "./support/fixtures";

import TestFinish from "@/systemPages/StudentPages/TestFinish/TestFinish";


// The page's endpoints for fx.studentAuth() — user 5
const RECORD = "/api/admin/students/5";
const FINISH = "/api/student/finish";
const ANSWERS = "/api/admin/students/5/answers";

const FINISH_FAILED = "Nepavyko užbaigti testo — perkraukite puslapį";


// Answers the page's three GETs; a test overrides the ones it
// is about (with a reply, or a handler such as a deferred's)
const routes = ({ record = reply.json(fx.studentDetail()), finish = reply.json({}), answers = reply.json([]) } = {}) => {
  backend.on("GET", RECORD, record);
  backend.on("GET", FINISH, finish);
  backend.on("GET", ANSWERS, answers);
};

const renderFinish = (authData = fx.studentAuth()) =>
  renderPage(<TestFinish authData={authData} />, { path: "/student/finish" });

// Routed, mounted and past the spinner
const renderLoaded = async (options = {}) => {
  routes(options);
  const result = renderFinish(options.authData);
  await screen.findByRole("heading", { name: "Testas baigtas!" });
  return result;
};


// A summary tile's value — the grade tile and the count tiles
// both print it right above their label
const tileValue = (label) => screen.getByText(label).previousElementSibling.textContent;

// A credential pill's value — right after its label
const credential = (label) => screen.getByText(label).nextElementSibling.textContent;


// Re-renders the page on every click, each time with a new
// (equal) authData object — the way a parent re-render does
function RerenderingParent() {
  const [renders, setRenders] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setRenders(renders + 1)}>rerender ({renders})</button>
      <TestFinish authData={fx.studentAuth()} />
    </>
  );
}







// -----------------------------------------------------------
// Requests on mount
// -----------------------------------------------------------

describe("TestFinish — requests on mount", () => {

  it("loads the student's own record, ends the test and loads the review — one GET each, with the session cookie", async () => {
    // Not the fixtures' user 5 — every path must be built from
    // authData.userid
    backend.on("GET", "/api/admin/students/42", reply.json(fx.studentDetail({ id: 42 })));
    backend.on("GET", FINISH, reply.json({}));
    backend.on("GET", "/api/admin/students/42/answers", reply.json([]));

    renderFinish(fx.studentAuth({ userid: 42 }));
    await screen.findByRole("heading", { name: "Testas baigtas!" });
    await waitFor(() => expect(backend.requests("GET", "/api/admin/students/42/answers")).toHaveLength(1));
    await settle();

    const requests = backend.requests();
    expect(requests.map((request) => `${request.method} ${request.url}`).sort()).toEqual([
      "GET /api/admin/students/42",
      "GET /api/admin/students/42/answers",
      "GET /api/student/finish",
    ]);
    for (const request of requests) {
      expect(request).toMatchObject({ client: "axios", withCredentials: true });
      expect(request.body).toBeUndefined();
    }
  });


  it("sends the finish call at once — it does not wait for the record", async () => {
    const slowRecord = deferred();
    routes({ record: () => slowRecord.promise });
    renderFinish();

    await waitFor(() => expect(backend.requests("GET", FINISH)).toHaveLength(1));
    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();

    await act(async () => slowRecord.resolve(reply.json(fx.studentDetail())));
    await screen.findByRole("heading", { name: "Testas baigtas!" });
  });


  it("asks for the answers review only once the record has loaded", async () => {
    const slowRecord = deferred();
    routes({ record: () => slowRecord.promise });
    renderFinish();
    await waitFor(() => expect(backend.requests("GET", RECORD)).toHaveLength(1));
    await settle();

    expect(backend.requests("GET", ANSWERS)).toHaveLength(0);

    await act(async () => slowRecord.resolve(reply.json(fx.studentDetail())));
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(1));
  });


  it("does not repeat the finish call, nor any load, when the page re-renders", async () => {
    routes({ answers: reply.json([fx.studentAnswer({ id: 11 })]) });
    const { user } = renderPage(<RerenderingParent />, { path: "/student/finish" });
    await screen.findByText("Klausimas #11");

    for (let click = 0; click < 3; click += 1) {
      await user.click(screen.getByRole("button", { name: /^rerender/ }));
    }
    await settle();

    expect(screen.getByRole("button", { name: "rerender (3)" })).toBeInTheDocument();
    expect(backend.requests("GET", FINISH)).toHaveLength(1);
    expect(backend.requests("GET", RECORD)).toHaveLength(1);
    expect(backend.requests("GET", ANSWERS)).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// Loading
// -----------------------------------------------------------

describe("TestFinish — loading", () => {

  it("shows 'Kraunasi...' and no results until the record arrives", async () => {
    const slowRecord = deferred();
    routes({ record: () => slowRecord.promise });
    renderFinish();

    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Testas baigtas!" })).toBeNull();
    expect(screen.queryByText("Testo Įvertinimas")).toBeNull();

    await act(async () => slowRecord.resolve(reply.json(fx.studentDetail())));

    expect(await screen.findByRole("heading", { name: "Testas baigtas!" })).toBeInTheDocument();
    expect(screen.queryByText("Kraunasi...")).toBeNull();
  });


  it("a 401 on the record sends the browser to /login and shows no results", async () => {
    // The session is gone — the finish call is refused the same
    // way. Whether that call redirects too is left open (the 401
    // interceptor KB-21 / KB-36 suggest would add a second
    // "/login"), so only the target is pinned, not the count
    routes({ record: reply.status(401, "Unauthorized"), finish: reply.status(401, "Unauthorized") });
    renderFinish();

    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();

    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Testas baigtas!" })).toBeNull();
    expect(backend.requests("GET", ANSWERS)).toHaveLength(0);
  });


  it("shows the results without waiting for the finish call", async () => {
    const slowFinish = deferred();
    routes({ finish: () => slowFinish.promise });
    renderFinish();

    expect(await screen.findByRole("heading", { name: "Testas baigtas!" })).toBeInTheDocument();
    expect(tileValue("Testo Įvertinimas")).toBe("7.50");

    await act(async () => slowFinish.resolve(reply.json({})));
    await settle();
    expect(toastTexts()).toEqual([]);
  });
});







// -----------------------------------------------------------
// The summary
// -----------------------------------------------------------

describe("TestFinish — the summary", () => {

  it("congratulates and shows the login credentials to write down", async () => {
    await renderLoaded();

    expect(screen.getByText("Užsirašykite prisijungimo duomenis — su jais galėsite peržiūrėti rezultatus vėliau.")).toBeInTheDocument();
    expect(credential("Vardas")).toBe("JONAS_JONAITIS");
    expect(credential("Kodas")).toBe("48291037");
  });


  it("takes the credentials from authData, not from the record", async () => {
    // Values the student's own record never carries — only to
    // tell the two sources apart
    await renderLoaded({ record: reply.json(fx.studentDetail({ username: "KITAS_STUDENTAS", passcode: "11112222" })) });

    expect(credential("Vardas")).toBe("JONAS_JONAITIS");
    expect(credential("Kodas")).toBe("48291037");
    expect(screen.queryByText("KITAS_STUDENTAS")).toBeNull();
    expect(screen.queryByText("11112222")).toBeNull();
  });


  it("keeps Lithuanian letters and a leading zero in the credentials", async () => {
    await renderLoaded({
      authData: fx.studentAuth({ id: "ŽYDRŪNĖ_ČEPUKAITĖ", passcode: "04829103" }),
      record: reply.json(fx.studentDetail({ username: "ŽYDRŪNĖ_ČEPUKAITĖ", passcode: "04829103" })),
    });

    expect(credential("Vardas")).toBe("ŽYDRŪNĖ_ČEPUKAITĖ");
    expect(credential("Kodas")).toBe("04829103");
  });


  it("shows the grade string as sent and the record's three counts", async () => {
    // fx.studentDetail(): 7.50; 8 of 12 fully correct, 10 of 12
    // identified, 27 of 30 options
    await renderLoaded();

    expect(tileValue("Testo Įvertinimas")).toBe("7.50");
    expect(tileValue("Teisingai Identifikuota bei Teisingos Opcijos")).toBe("8 / 12");
    expect(tileValue("Teisingai Identifikuota")).toBe("10 / 12");
    expect(tileValue("Teisingos Opcijos")).toBe("27 / 30");
  });


  it("a perfect test reads 10.00 and full counts", async () => {
    await renderLoaded({
      record: reply.json(fx.studentDetail({
        testgrade: "10.00",
        fullycorrectcount: 12,
        fullycorrectpercentage: 100,
        totalidentifiedcorrectly: 12,
        totaloptionscount: 30,
        totalcorrectoptionscount: 30,
      })),
    });

    expect(tileValue("Testo Įvertinimas")).toBe("10.00");
    expect(tileValue("Teisingai Identifikuota bei Teisingos Opcijos")).toBe("12 / 12");
    expect(tileValue("Teisingai Identifikuota")).toBe("12 / 12");
    expect(tileValue("Teisingos Opcijos")).toBe("30 / 30");
  });


  it("nothing right: the grade 0.00 as sent, the zero counts as 0", async () => {
    // Nothing identified → no options scored either: the options
    // total only covers the correctly identified questions
    await renderLoaded({
      record: reply.json(fx.studentDetail({
        testgrade: "0.00",
        fullycorrectcount: 0,
        fullycorrectpercentage: 0,
        totalidentifiedcorrectly: 0,
        totaloptionscount: 0,
        totalcorrectoptionscount: 0,
      })),
    });

    expect(tileValue("Testo Įvertinimas")).toBe("0.00");
    expect(tileValue("Teisingai Identifikuota bei Teisingos Opcijos")).toBe("0 / 12");
    expect(tileValue("Teisingai Identifikuota")).toBe("0 / 12");
    expect(tileValue("Teisingos Opcijos")).toBe("0 / 0");
  });


  it("a student without a dealt test (the blank-field contract): grade 0 and 0 / 0 everywhere", async () => {
    await renderLoaded({ record: reply.json(fx.blankStudentDetail()) });

    expect(tileValue("Testo Įvertinimas")).toBe("0");
    expect(tileValue("Teisingai Identifikuota bei Teisingos Opcijos")).toBe("0 / 0");
    expect(tileValue("Teisingai Identifikuota")).toBe("0 / 0");
    expect(tileValue("Teisingos Opcijos")).toBe("0 / 0");
  });


  it("frames the results with the navbar — its logout works here — and the footer", async () => {
    const { user } = await renderLoaded();

    expect(screen.getByText("Copyright © | All Rights Reserved | VUKnF")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atsijungti" }));
    expect(hardNavigations()).toEqual(["/login"]);
  });
});







// -----------------------------------------------------------
// The finish call failing
// -----------------------------------------------------------

describe("TestFinish — the finish call failing", () => {

  it.each([
    ["a server error (500)", reply.status(500, "Internal Server Error")],
    ["a bad gateway (502)", reply.status(502, "Bad Gateway")],
    ["no connection", reply.networkError()],
  ])("%s toasts the reload hint once and keeps the results on screen", async (_, failure) => {
    await renderLoaded({ finish: failure });

    await findToast(FINISH_FAILED);
    expect(toastTexts()).toEqual([FINISH_FAILED]);
    expect(screen.getByRole("heading", { name: "Testas baigtas!" })).toBeInTheDocument();
    expect(tileValue("Testo Įvertinimas")).toBe("7.50");
    expect(hardNavigations()).toEqual([]);
  });


  it("a failure while the record still loads is shown once the results appear", async () => {
    const slowRecord = deferred();
    routes({ record: () => slowRecord.promise, finish: reply.status(500, "Internal Server Error") });
    renderFinish();
    await waitFor(() => expect(backend.requests("GET", FINISH)).toHaveLength(1));
    await settle();
    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();

    await act(async () => slowRecord.resolve(reply.json(fx.studentDetail())));

    await findToast(FINISH_FAILED);
    expect(screen.getByRole("heading", { name: "Testas baigtas!" })).toBeInTheDocument();
  });


  it("a successful finish ({}) shows no toast", async () => {
    await renderLoaded();
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(1));
    await settle();

    expect(toastTexts()).toEqual([]);
  });
});







// -----------------------------------------------------------
// The answers review
// -----------------------------------------------------------

describe("TestFinish — the answers review", () => {

  it("shows the review under the summary — a card per answer", async () => {
    await renderLoaded({
      answers: reply.json([
        fx.studentAnswer({ id: 11 }),
        fx.studentAnswer({ id: 12, isphishinganswer: 0, answerpoints: "0.00" }),
      ]),
    });

    const headers = await screen.findAllByText(/^Klausimas #\d+$/);
    expect(headers.map((header) => header.textContent)).toEqual(["Klausimas #11", "Klausimas #12"]);
    expect(screen.getAllByAltText("Fišingo El. Laiškas")).toHaveLength(2);

    // After the last summary tile, in document order
    const lastTile = screen.getByText("Teisingos Opcijos");
    for (const header of headers) {
      expect(lastTile.compareDocumentPosition(header)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });


  it("shows the summary before the review has arrived", async () => {
    const slowReview = deferred();
    await renderLoaded({ answers: () => slowReview.promise });
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(1));

    expect(tileValue("Testo Įvertinimas")).toBe("7.50");
    expect(screen.queryByText(/^Klausimas #/)).toBeNull();

    await act(async () => slowReview.resolve(reply.json([fx.studentAnswer({ id: 11 })])));
    expect(await screen.findByText("Klausimas #11")).toBeInTheDocument();
  });


  it("a failed review load leaves the summary in place", async () => {
    await renderLoaded({ answers: reply.status(500, "Internal Server Error") });
    await waitFor(() => expect(backend.requests("GET", ANSWERS)).toHaveLength(1));
    await settle();

    expect(screen.getByRole("heading", { name: "Testas baigtas!" })).toBeInTheDocument();
    expect(tileValue("Testo Įvertinimas")).toBe("7.50");
    expect(hardNavigations()).toEqual([]);
  });
});
