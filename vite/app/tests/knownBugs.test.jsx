// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Known bugs — pinned as EXPECTED FAILURES
//
//  The frontend's ledger of defects that are known but not
//  fixed yet (the counterpart of the backend's
//  test_known_bugs.py). Every entry holds one or more PAIRS of
//  tests — one pair per way the defect shows:
//
//    - "reproduces: …" — a plain test asserting the CURRENT,
//      wrong behavior. It proves the scenario really triggers
//      in this environment, so the expected failure next to
//      it cannot be a broken test in disguise
//    - it.fails(…)     — asserts the CORRECT behavior and is
//      expected to fail, so the suite stays green while the
//      defect stays documented and executable
//
//  When a bug gets fixed, BOTH tests of each of its pairs fail
//  the suite: the reproduction no longer reproduces and the
//  expected failure unexpectedly passes. The fix is completed
//  by deleting the reproductions and moving the other tests
//  (as plain `it`s) into their topic files.
//
//  One numbered describe per bug (KB-01 …); each banner
//  states WHERE the defect lives, the TRIGGER, the IMPACT and
//  a SUGGESTED FIX.
// -----------------------------------------------------------

import "./support/setup";

import { beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { allowConsoleError, consoleErrors, resizeObserved } from "./support/setup";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { linkAreas, longPress } from "./support/interactions";
import { hardNavigations } from "./support/navigation";
import * as fx from "./support/fixtures";

import useFetchData from "@/hooks/useFetchData";
import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";
import InteractiveImageEditor from "@/components/Other/InteractiveImage/InteractiveImageEditor";
import Login from "@/systemPages/PublicPages/Login/Login";
import LeaderboardTable from "@/systemPages/PublicPages/Leaderboard/LeaderboardTable/LeaderboardTable";
import TestHome from "@/systemPages/StudentPages/TestHome/TestHome";
import TestFinish from "@/systemPages/StudentPages/TestFinish/TestFinish";
import StudentSidebar from "@/components/Student/Sidebar/Sidebar";
import Home from "@/systemPages/AdminPages/Home/Home";
import Questions from "@/systemPages/AdminPages/Questions/Questions";
import QuestionCard from "@/systemPages/AdminPages/Questions/QuestionsList/QuestionCard/QuestionCard";
import AddQuestion from "@/systemPages/AdminPages/Questions/QuestionsList/AddQuestion/AddQuestion";
import AddEditAdministrator from "@/systemPages/AdminPages/AdministratorsList/AddEditAdministrator/AddEditAdministrator";
import StudentAnswers from "@/systemPages/AdminPages/StudentInformation/StudentAnswers/StudentAnswers";
import StudentTestSummaryTable from "@/systemPages/AdminPages/StudentInformation/StudentTestSummaryTable/StudentTestSummaryTable";
import StudentInformation from "@/systemPages/AdminPages/StudentInformation/StudentInformation";
import StudentsListTable from "@/systemPages/AdminPages/StudentsList/StudentsListTable/StudentsListTable";
import AdministratorsList from "@/systemPages/AdminPages/AdministratorsList/AdministratorsList";
import SlidesPage from "@/systemPages/PublicPages/Slides/Slides";


// The login page's canvas background — jsdom has no canvas
vi.mock("@/systemPages/PublicPages/Login/components/Particles/Particles", () => ({
  default: () => null,
}));


// react-rnd drags and resizes with pointer geometry jsdom does
// not have. The double renders each box of the link editor as a
// plain div showing what the editor handed it — size / position
// in px and the bounds as data-*, the style as its style, the
// click handler — and keeps its latest props on the element
// (`rndProps`), so a test can finish a drag with chosen values.
// Boxes only exist once the editor measured its image, so the
// entries that never do (KB-05, KB-08, KB-31, KB-32) never
// render it
vi.mock("react-rnd", async () => {
  const { createElement } = await import("react");

  return {
    Rnd: function RndDouble(props) {
      return createElement("div", {
        "data-testid": "rnd-box",
        "data-x": props.position?.x,
        "data-y": props.position?.y,
        "data-width": props.size?.width,
        "data-height": props.size?.height,
        "data-bounds": typeof props.bounds === "string" ? props.bounds : undefined,
        style: props.style,
        onClick: props.onClick,
        ref: (element) => {
          if (element) {
            element.rndProps = props;
          }
        },
      });
    },
  };
});


// Shows what useFetchData hands to its consumer (polling when
// given a refreshInterval, in seconds)
function DataProbe({ endpoint, refreshInterval = null }) {
  const { data } = useFetchData(endpoint, refreshInterval);
  return <output data-testid="data">{JSON.stringify(data)}</output>;
}


// The login page mounts with its logout POST answered
const renderLogin = () => {
  backend.on("POST", "/api/logout", reply.text("OK"));
  return renderPage(<Login />, { path: "/login", theme: false });
};


// jsdom has no layout: give an element the box a browser would
// measure (getBoundingClientRect)
const placeBox = (element, { left, top, width, height }) => {
  element.getBoundingClientRect = () => ({ left, top, width, height, x: left, y: top, right: left + width, bottom: top + height });
};


// An overlay's inline px box as numbers, rounded to 1/1000 px —
// percent × size leaves float noise (60.00000000000001)
const pxBox = (element) => {
  const px = (value) => Math.round(parseFloat(value) * 1000) / 1000;
  return { left: px(element.style.left), top: px(element.style.top), width: px(element.style.width), height: px(element.style.height) };
};


// A failure message or a retry offer, in whatever words a fix
// picks ("Nepavyko …", "Klaida", "Bandyti dar kartą", "Bandoma
// iš naujo …", "Perkraukite …", "Pakartoti", "Nėra ryšio …",
// "nepasiekiamas") — what the failed-load entries' expected
// failures look for: a reworded empty state alone is no fix
const EXPLAINS = /nepavyko|klaid|bandy|bando|perkrau|pakartot|ryš|nepasiek/i;







// -----------------------------------------------------------
// KB-01 — the leaderboard prints "null / " for a student
//         without a dealt test
// -----------------------------------------------------------
//
// WHERE:   LeaderboardTable.jsx — ProgressBar, the running-
//          test text `${row.answeredquestioncount} /
//          ${row.questioncount}`
// TRIGGER: a student registered (so seen within the last day)
//          but not dealt a test yet — the API's blank-field
//          contract sends answeredquestioncount null and
//          questioncount ""
// IMPACT:  the projector shows "null / " in that student's bar
// SUGGESTED FIX: `${row.answeredquestioncount ?? 0} /
//          ${row.questioncount || 0}`
// -----------------------------------------------------------

describe("KB-01 — leaderboard shows 'null / ' for a student without a dealt test", () => {

  const renderBoard = () => {
    backend.on("GET", "/api/leaderboard", reply.json([
      fx.blankLeaderboardEntry({ id: 9, username: "NAUJOKAS", lastseen: fx.minutesAgo(5) }),
    ]));
    renderPage(<LeaderboardTable />, { path: "/leaderboard" });
  };


  it("reproduces: the progress bar reads 'null /'", async () => {
    renderBoard();
    await screen.findByText("NAUJOKAS");

    expect(screen.getByText("null /")).toBeInTheDocument();
  });


  it.fails("a student without a dealt test shows no 'null' in the bar", async () => {
    renderBoard();
    await screen.findByText("NAUJOKAS");

    expect(screen.queryByText(/null/)).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-02 — a rejected upload hides the backend's reason
// -----------------------------------------------------------
//
// WHERE:   AddQuestion.jsx — handleUpload's catch branch
// TRIGGER: POST /api/phishingpictures refused — the backend
//          answers HTTP 400 with {type: "error", reason} (not
//          an image, too large, wrong type, empty)
// IMPACT:  the admin reads "Serverio klaida." instead of the
//          actual reason (e.g. "File is not an image"); the
//          `type === 'error'` branch only runs for 2xx replies
// SUGGESTED FIX: in the catch, show
//          error.response?.data?.reason when present
// -----------------------------------------------------------

describe("KB-02 — a rejected upload hides the backend's reason", () => {

  const uploadRejected = async () => {
    backend.on("POST", "/api/phishingpictures", reply.json({ type: "error", reason: "File is not an image" }, 400));

    const { user } = renderPage(<AddQuestion setOpen={vi.fn()} getData={vi.fn()} />, { toaster: true });

    await user.upload(document.querySelector('input[type="file"]'), new File(["\x89PNG fake"], "laiskas.png", { type: "image/png" }));
    const uploadButton = screen.getByRole("button", { name: /Įkelti Paveikslėlį/ });
    await waitFor(() => expect(uploadButton).toBeEnabled());
    await user.click(uploadButton);
  };


  it("reproduces: the toast only says 'Serverio klaida.'", async () => {
    await uploadRejected();
    await findToast("Serverio klaida.");

    expect(toastTexts().join(" ")).not.toContain("File is not an image");
  });


  it.fails("the toast carries the backend's reason", async () => {
    await uploadRejected();

    await findToast("File is not an image");
  });
});







// -----------------------------------------------------------
// KB-03 — a refused administrator save hides the backend's
//         reason
// -----------------------------------------------------------
//
// WHERE:   AddEditAdministrator.jsx — sendData's catch branch
// TRIGGER: POST /api/admin/administrators refused with HTTP
//          400 and {type: "error", reason} (the shape checks:
//          invalid email / password / id / enabled flag) —
//          from this form e.g. "Invalid email" for an email
//          over 255 characters (the field sets no limit)
// IMPACT:  "Nepavyko: Serverio klaida." instead of the reason
// SUGGESTED FIX: in the catch, show
//          error.response?.data?.reason when present
// -----------------------------------------------------------

describe("KB-03 — a refused administrator save hides the backend's reason", () => {

  const createRejected = async () => {
    backend.on("POST", "/api/admin/administrators", reply.json({ type: "error", reason: "Invalid email" }, 400));

    const { user } = renderPage(<AddEditAdministrator rowData={undefined} setOpen={vi.fn()} getData={vi.fn()} />, { toaster: true });

    await user.type(screen.getByLabelText(/El\. Paštas/), "naujas@knf.vu.lt");
    await user.type(screen.getByLabelText(/^Slaptažodis/), "ilgas-slaptazodis");
    await user.type(screen.getByLabelText(/^Pakartoti Slaptažodį/), "ilgas-slaptazodis");
    await user.click(screen.getByRole("button", { name: /Įterpti/ }));
  };


  it("reproduces: the toast only says 'Serverio klaida.'", async () => {
    await createRejected();
    await findToast("Serverio klaida.");

    expect(toastTexts().join(" ")).not.toContain("Invalid email");
  });


  it.fails("the toast carries the backend's reason", async () => {
    await createRejected();

    await findToast("Invalid email");
  });
});







// -----------------------------------------------------------
// KB-04 — deleting an administrator announces success before
//         the backend answers
// -----------------------------------------------------------
//
// WHERE:   AddEditAdministrator.jsx — ActionButtons: the
//          LongPressDeleteButton's completedToastMessage
//          "Įrašas ištrintas"
// TRIGGER: completing the hold-to-delete when the backend then
//          refuses (e.g. "You cannot delete your own account")
// IMPACT:  "Įrašas ištrintas" and the refusal show side by
//          side — the admin is told the record is gone when it
//          is not (and a successful delete toasts twice)
// SUGGESTED FIX: drop completedToastMessage; toast the success
//          in sendData once the reply is {type: "ok"}
// -----------------------------------------------------------

describe("KB-04 — deleting an administrator announces success before the backend answers", () => {

  // The signed-in admin (fx.adminAuth: userid 1) holds Delete
  // on their own row — the backend's self-lockout guard
  // refuses with HTTP 200 {type: "error", reason}
  const holdDeleteRefused = () => {
    backend.on("POST", "/api/admin/administrators", reply.json({ type: "error", reason: "You cannot delete your own account" }));

    renderPage(
      <AddEditAdministrator rowData={{ id: 1, row: fx.administrator() }} setOpen={vi.fn()} getData={vi.fn()} />,
      { toaster: true }
    );

    longPress(screen.getByRole("button", { name: /Ištrinti/ }), 1600);
  };


  it("reproduces: a refused delete still toasts 'Įrašas ištrintas'", async () => {
    holdDeleteRefused();
    await findToast("You cannot delete your own account");

    expect(toastTexts().some((text) => text.includes("Įrašas ištrintas"))).toBe(true);
  });


  it.fails("a refused delete shows only the refusal", async () => {
    holdDeleteRefused();
    await findToast("You cannot delete your own account");

    expect(toastTexts().some((text) => text.includes("Įrašas ištrintas"))).toBe(false);
  });
});







// -----------------------------------------------------------
// KB-05 — the link editor reports the role-gate reply as
//         saved
// -----------------------------------------------------------
//
// WHERE:   InteractiveImageEditor.jsx — handleSave
// TRIGGER: POST /api/phishingpictures/{id}/links answered
//          HTTP 200 "Error: Not Admin" — the documented role
//          gate of this endpoint (e.g. a student logged in from
//          another tab of the same browser)
// IMPACT:  "Nuorodos išsaugotos" + the editor closes, while
//          nothing was saved
// SUGGESTED FIX: treat any body other than "OK" as a failure
// -----------------------------------------------------------

describe("KB-05 — the link editor reports the role-gate reply as saved", () => {

  const saveRefused = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink()]));
    backend.on("POST", "/api/phishingpictures/21/links", reply.text("Error: Not Admin"));
    const onSaved = vi.fn();

    const { user } = renderPage(
      <InteractiveImageEditor src="/api/phishingpictures/21" initialAreasUrl="/api/phishingpictures/21/links" onSaveButtonClick={onSaved} />,
      { toaster: true }
    );
    await user.click(await screen.findByRole("button", { name: /Išsaugoti/ }));

    return onSaved;
  };


  it("reproduces: 'Nuorodos išsaugotos' and the editor closes", async () => {
    const onSaved = await saveRefused();
    await findToast("Nuorodos išsaugotos");

    expect(onSaved).toHaveBeenCalledTimes(1);
  });


  // Reported in whatever words the fix picks (or by sending the
  // admin to sign in again) — only never as saved
  it.fails("the refusal is reported and the editor stays open", async () => {
    const onSaved = await saveRefused();

    await waitFor(() => expect(toastTexts().length + hardNavigations().length).toBeGreaterThan(0));
    expect(toastTexts().join(" ")).not.toContain("Nuorodos išsaugotos");
    expect(onSaved).not.toHaveBeenCalled();
  });
});







// -----------------------------------------------------------
// KB-06 — Enter on a focused login-page link-button runs the
//         form's action instead of the button's
// -----------------------------------------------------------
//
// WHERE:   Login.jsx — the document-level Enter listeners of
//          RegisterForm and LoginForm
// TRIGGER: a keyboard user focuses "Jau turiu paskyrą —
//          prisijungti" (register form) or "Neturiu paskyros —
//          registruotis" (sign-in form) and presses Enter
// IMPACT:  register form — the typed name is REGISTERED (an
//          account is created) and the forms do not switch
//          (the listener's preventDefault swallows the click);
//          sign-in form — a login request is sent with
//          whatever was typed, then the forms switch
// SUGGESTED FIX: let the listeners ignore Enter whose target
//          is (inside) a <button> — the button's own click
//          handles it
// -----------------------------------------------------------

describe("KB-06 — Enter on a focused login-page link-button runs the form's action", () => {

  const enterOnHaveAccount = async () => {
    backend.on("POST", "/api/student/register", reply.json({ status: "OK", username: "JONAS", accessCode: "48291037" }));
    const { user } = renderLogin();

    await user.type(screen.getByLabelText(/Prisijungimo Vardas/), "jonas");
    screen.getByRole("button", { name: "Jau turiu paskyrą — prisijungti" }).focus();
    await user.keyboard("{Enter}");
    await settle();
  };

  const enterOnNoAccount = async () => {
    backend.on("POST", "/api/login", reply.text("Įveskite Slaptažodį."));
    const { user } = renderLogin();

    await user.click(screen.getByRole("button", { name: "Jau turiu paskyrą — prisijungti" }));
    await user.type(screen.getByLabelText(/Vardas \/ El\. Paštas/), "JONAS");
    screen.getByRole("button", { name: "Neturiu paskyros — registruotis" }).focus();
    await user.keyboard("{Enter}");
    await settle();
  };


  it("reproduces: Enter on 'Jau turiu paskyrą' registers the typed name", async () => {
    await enterOnHaveAccount();

    expect(backend.requests("POST", "/api/student/register")).toHaveLength(1);
  });


  it.fails("Enter on 'Jau turiu paskyrą' switches to sign-in without registering", async () => {
    await enterOnHaveAccount();

    expect(backend.requests("POST", "/api/student/register")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "PRISIJUNGTI" }).closest(".hidden")).toBeNull();
  });


  it("reproduces: Enter on 'Neturiu paskyros' sends a login request", async () => {
    await enterOnNoAccount();

    expect(backend.requests("POST", "/api/login")).toHaveLength(1);
  });


  it.fails("Enter on 'Neturiu paskyros' only switches back to registration", async () => {
    await enterOnNoAccount();

    expect(backend.requests("POST", "/api/login")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "REGISTRUOTIS" }).closest(".hidden")).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-07 — a login / register request can be sent again while
//         it runs
// -----------------------------------------------------------
//
// WHERE:   Login.jsx — RegisterForm.handleRegister and
//          LoginForm.submit (the Enter listeners call them
//          without checking the running request; the button is
//          disabled meanwhile, Enter is not); and registration
//          step 2 — PRADĖTI TESTĄ's onClick (like the Enter
//          listener's step-2 branch) calls Login.handleLogin
//          directly, and that BrandButton gets no `loading`,
//          so it never disables nor shows PALAUKITE
// TRIGGER: Enter twice in the name / code field before the
//          first reply arrives; a double-click on PRADĖTI TESTĄ
//          (or a click and then an Enter)
// IMPACT:  duplicate POSTs — the second registration of the
//          same name is refused server-side (usernames are
//          unique), a second login replaces the first session;
//          step 2 gives no PALAUKITE feedback on a slow server
// SUGGESTED FIX: an in-flight ref guard in both handlers and in
//          Login.handleLogin itself, which serves both forms (a
//          ref, because the listeners hold stale closures), and
//          a loading flag for step 2's BrandButton
// -----------------------------------------------------------

describe("KB-07 — a login / register request can be sent again while it runs", () => {

  const registerWithTwoEnters = async () => {
    const pending = deferred();
    backend.on("POST", "/api/student/register", () => pending.promise);
    const { user } = renderLogin();

    await user.type(screen.getByLabelText(/Prisijungimo Vardas/), "jonas{Enter}");
    await user.keyboard("{Enter}");
    const requests = backend.requests("POST", "/api/student/register").length;

    await act(async () => pending.resolve(reply.json({ status: "OK", username: "JONAS", accessCode: "48291037" })));
    await settle();
    return requests;
  };

  const loginWithTwoEnters = async () => {
    const pending = deferred();
    backend.on("POST", "/api/login", () => pending.promise);
    const { user } = renderLogin();

    await user.click(screen.getByRole("button", { name: "Jau turiu paskyrą — prisijungti" }));
    await user.type(screen.getByLabelText(/Vardas \/ El\. Paštas/), "JONAS");
    await user.type(screen.getByLabelText(/Kodas \/ Slaptažodis/), "48291037{Enter}");
    await user.keyboard("{Enter}");
    const requests = backend.requests("POST", "/api/login").length;

    await act(async () => pending.resolve(reply.text("Vardas ir/arba Slaptažodis neteisingas.")));
    await settle();
    return requests;
  };

  // Registers, then double-clicks PRADĖTI TESTĄ while the
  // login is held in flight; resolves with the logins sent
  const startTestWithTwoClicks = async () => {
    const pending = deferred();
    backend.on("POST", "/api/student/register", reply.json({ status: "OK", username: "JONAS", accessCode: "48291037" }));
    backend.on("POST", "/api/login", () => pending.promise);
    const { user } = renderLogin();

    await user.type(screen.getByLabelText(/Prisijungimo Vardas/), "jonas");
    await user.click(screen.getByRole("button", { name: "REGISTRUOTIS" }));
    await user.dblClick(await screen.findByRole("button", { name: "PRADĖTI TESTĄ" }));
    const requests = backend.requests("POST", "/api/login").length;

    await act(async () => pending.resolve(reply.text("OK")));
    await settle();
    return requests;
  };


  it("reproduces: a second Enter registers twice", async () => {
    expect(await registerWithTwoEnters()).toBe(2);
  });


  it.fails("one register request however often Enter is pressed", async () => {
    expect(await registerWithTwoEnters()).toBe(1);
  });


  it("reproduces: a second Enter logs in twice", async () => {
    expect(await loginWithTwoEnters()).toBe(2);
  });


  it.fails("one login request however often Enter is pressed", async () => {
    expect(await loginWithTwoEnters()).toBe(1);
  });


  it("reproduces: a double-click on PRADĖTI TESTĄ logs in twice", async () => {
    expect(await startTestWithTwoClicks()).toBe(2);
  });


  it.fails("one login request however often PRADĖTI TESTĄ is clicked", async () => {
    expect(await startTestWithTwoClicks()).toBe(1);
  });
});







// -----------------------------------------------------------
// KB-08 — a question card keeps showing the old link areas
//         after the link editor closes
// -----------------------------------------------------------
//
// WHERE:   QuestionCard.jsx — QuestionImageCell; the preview
//          InteractiveImage fetches its areas once per loaded
//          image and nothing makes it fetch again
// TRIGGER: "Redaguoti Nuorodas" → change the areas →
//          "Išsaugoti" (the save also closes the editor)
// IMPACT:  the card's preview (and its URL tooltips) shows the
//          previous areas until the page is reloaded
// SUGGESTED FIX: remount the preview when the editor closes
//          (e.g. a `key` bumped on close) so it refetches
// -----------------------------------------------------------

describe("KB-08 — a question card keeps the old link areas after the editor closes", () => {

  const editLinksAndSave = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink({ id: 1, url: "https://senas.example" })]));

    const { user, container } = renderPage(
      <QuestionCard fetchedQuestionData={fx.adminQuestion({ questionid: 21 })} triggerQuestionListUpdate={vi.fn()} />,
      { toaster: true }
    );

    // The preview's image is on screen → its areas are fetched
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    // A real edit and save — whether a fix refetches after the
    // editor closed or hands the saved areas to the preview,
    // the new URL is what it has to show. The backend serves
    // the saved areas (re-created, new id) from the save on
    await user.click(screen.getByRole("button", { name: /Redaguoti Nuorodas/ }));
    const urlField = await screen.findByLabelText("Nuoroda");
    await user.clear(urlField);
    await user.type(urlField, "https://naujas.example");

    backend.on("POST", "/api/phishingpictures/21/links", reply.text("OK"));
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink({ id: 2, url: "https://naujas.example" })]));
    await user.click(screen.getByRole("button", { name: /Išsaugoti/ }));

    // The editor closes once the save's reply is in — a promise
    // continuation, so wait for it
    await waitFor(() => expect(screen.queryByText("Nuorodų Redagavimas")).toBeNull());

    // Whatever preview is on screen now gets its load event
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await settle();

    fireEvent.mouseEnter(linkAreas(container)[0]);
  };


  it("reproduces: the preview's tooltip still shows the old URL", async () => {
    await editLinksAndSave();

    expect(screen.getByText("https://senas.example")).toBeInTheDocument();
  });


  it.fails("the preview shows the areas as they are after the edit", async () => {
    await editLinksAndSave();

    expect(screen.getByText("https://naujas.example")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// KB-09 — useFetchData applies a late reply from the previous
//         endpoint
// -----------------------------------------------------------
//
// WHERE:   useFetchData.js — fetchData sets `data` from any
//          reply, whatever endpoint the hook serves by then
// TRIGGER: the endpoint changes (a route param — e.g. browser
//          back/forward between two /admin/students/:id pages)
//          while the previous request is still running, and
//          that request answers last
// IMPACT:  the page shows the PREVIOUS record under the new
//          URL — contrary to the hook's own promise that
//          consumers never see the previous endpoint's data
// SUGGESTED FIX: keep the current endpoint in a ref and drop
//          replies (and errors) requested for another one
// -----------------------------------------------------------

describe("KB-09 — useFetchData applies a late reply from the previous endpoint", () => {

  const switchEndpointWhileLoading = async () => {
    const first = deferred();
    backend.once("GET", "/api/admin/students/1", () => first.promise);
    backend.on("GET", "/api/admin/students/2", reply.json(fx.studentDetail({ id: 2, username: "ANTRAS" })));

    const { rerender } = render(<DataProbe endpoint="/api/admin/students/1" />);
    rerender(<DataProbe endpoint="/api/admin/students/2" />);
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("ANTRAS"));

    await act(async () => first.resolve(reply.json(fx.studentDetail({ id: 1, username: "PIRMAS" }))));
    await settle();
  };


  it("reproduces: the first endpoint's late reply replaces the data", async () => {
    await switchEndpointWhileLoading();

    expect(screen.getByTestId("data")).toHaveTextContent("PIRMAS");
  });


  it.fails("the current endpoint's data stays", async () => {
    await switchEndpointWhileLoading();

    expect(screen.getByTestId("data")).toHaveTextContent("ANTRAS");
  });
});







// -----------------------------------------------------------
// KB-10 — useFetchData hands the role-gate reply to pages as
//         data
// -----------------------------------------------------------
//
// WHERE:   useFetchData.js — the success branch
// TRIGGER: an admin GET answered HTTP 200 "Error: Not Admin"
//          (the documented role gate for a non-admin session —
//          e.g. a student logged in from another tab while an
//          admin page keeps polling)
// IMPACT:  the string becomes `data` and the list pages break
//          on it — StudentsListTable (polls every 5 s) and
//          StudentAnswers call .filter / .map on it,
//          AdministratorsList hands it to its DataGrid as
//          `rows` (which throws: rows without an id) — and the
//          whole page crashes to a blank screen (the app has
//          no error boundary)
// SUGGESTED FIX: never hand that reply over as data — treat
//          it as lost authorization (e.g. a hard navigation to
//          "/" so the router re-routes by the real role)
// -----------------------------------------------------------

describe("KB-10 — useFetchData hands the role-gate reply to pages as data", () => {

  const fetchAsNonAdmin = async () => {
    backend.on("GET", "/api/admin/students", reply.text("Error: Not Admin"));
    render(<DataProbe endpoint="/api/admin/students" />);
    await waitFor(() => expect(backend.requests("GET", "/api/admin/students")).toHaveLength(1));
    await settle();
  };


  it("reproduces: the role-gate string becomes the data", async () => {
    await fetchAsNonAdmin();

    expect(screen.getByTestId("data")).toHaveTextContent('"Error: Not Admin"');
  });


  it.fails("the role-gate string never becomes the data", async () => {
    await fetchAsNonAdmin();

    expect(screen.getByTestId("data")).not.toHaveTextContent("Error: Not Admin");
  });
});







// -----------------------------------------------------------
// KB-11 — a failed first dashboard poll prints
//         "undefined/undefined"
// -----------------------------------------------------------
//
// WHERE:   Home.jsx — `if (loadingData) return null` is the
//          only guard; after an error `data` is still the
//          hook's initial []
// TRIGGER: the first GET /api/admin/home fails (500, network)
// IMPACT:  the "Klausimai" widget prints "undefined/undefined"
//          and the test-size picker mounts with the bogus
//          default "undefined" — being uncontrolled, it keeps
//          it after the polling recovers
// SUGGESTED FIX: render the dashboard only once a dashboard
//          object has arrived
// -----------------------------------------------------------

describe("KB-11 — a failed first dashboard poll prints 'undefined/undefined'", () => {

  const renderFailedDashboard = async () => {
    backend.on("GET", "/api/admin/home", reply.status(500, "Internal Server Error"));
    renderPage(<Home />, { path: "/admin" });
    await waitFor(() => expect(backend.requests("GET", "/api/admin/home")).toHaveLength(1));
    await settle();
  };


  it("reproduces: 'undefined/undefined' is on screen", async () => {
    await renderFailedDashboard();

    expect(screen.getByText("undefined/undefined")).toBeInTheDocument();
  });


  it.fails("a failed poll never prints 'undefined'", async () => {
    await renderFailedDashboard();

    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-12 — the test page spins forever when the questions
//         cannot be loaded
// -----------------------------------------------------------
//
// WHERE:   TestHome.jsx — useTestQuestions: the load's catch
//          only handles 401
// TRIGGER: GET /api/student/questions fails with anything but
//          401 (500, 502 during a deploy, no connection)
// IMPACT:  the student sits on "Kraunasi..." with no message
//          and no way to retry except guessing to reload
// SUGGESTED FIX: a `failed` state rendering a message with a
//          "Bandyti dar kartą" (reload) button, like the empty-
//          bank screen
// -----------------------------------------------------------

describe("KB-12 — the test page spins forever when the questions cannot be loaded", () => {

  const renderFailedTest = () => {
    backend.on("GET", "/api/student/questions", reply.status(500, "Internal Server Error"));
    renderPage(<TestHome />, { path: "/student" });
  };

  const explanations = () =>
    screen.queryAllByText(EXPLAINS).length + screen.queryAllByRole("button", { name: EXPLAINS }).length;


  it("reproduces: the spinner stays, with no message and no retry", async () => {
    renderFailedTest();
    await waitFor(() => expect(backend.requests("GET", "/api/student/questions")).toHaveLength(1));
    await settle();

    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(explanations()).toBe(0);
  });


  it.fails("a failed load replaces the spinner with a message or a retry", async () => {
    renderFailedTest();

    await waitFor(() => expect(explanations()).toBeGreaterThan(0));
    expect(screen.queryByText("Kraunasi...")).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-13 — the next image shows the previous image's link
//         areas
// -----------------------------------------------------------
//
// WHERE:   InteractiveImage.jsx — the areas effect sets
//          whatever reply arrives, and neither the old areas
//          nor the hovered area (the URL bubble) are cleared
//          when `src` changes
// TRIGGER: the test page reuses one InteractiveImage for every
//          question; switching questions while the previous
//          question's areas request is still running — or, with
//          no late reply at all, the next email has loaded
//          while its OWN areas request is still running — or
//          while the pointer rests on a link area (a keyboard
//          switch: Tab to a sidebar number + Enter; no
//          mouseleave fires, and a removed area gets none)
// IMPACT:  the student hovers the NEW email and sees the
//          PREVIOUS email's link areas and URLs; after a
//          keyboard switch the previous URL bubble even pops up
//          by itself once the new email has loaded, and stays
//          after its own areas arrived — misleading in a test
//          that is about judging links
// SUGGESTED FIX: clear the areas/tooltip on a new src and mark
//          the running request stale in the effect cleanup
// -----------------------------------------------------------

describe("KB-13 — the next image shows the previous image's link areas", () => {

  // The first image's areas request answers only after the
  // second image took its place
  const switchImageWhileAreasLoad = async () => {
    const firstAreas = deferred();
    backend.once("GET", "/api/phishingpictures/11/links", () => firstAreas.promise);
    backend.on("GET", "/api/phishingpictures/12/links", reply.json([fx.questionLink({ id: 2, url: "https://antras.example" })]));

    const { container, rerender } = render(
      <InteractiveImage src="/api/phishingpictures/11" clickableAreasUrl="/api/phishingpictures/11/links" />
    );
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));

    rerender(<InteractiveImage src="/api/phishingpictures/12" clickableAreasUrl="/api/phishingpictures/12/links" />);
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    await act(async () => firstAreas.resolve(reply.json([fx.questionLink({ id: 1, url: "https://pirmas.example" })])));
    await settle();

    fireEvent.mouseEnter(linkAreas(container)[0]);
  };

  // The first image's areas arrived long ago; the second image
  // loads while ITS areas request is still running. Returns
  // what the second image offers meanwhile (its areas hovered),
  // then lets its own areas land
  const loadNextImageBeforeItsAreas = async () => {
    const secondAreas = deferred();
    backend.on("GET", "/api/phishingpictures/11/links", reply.json([fx.questionLink({ id: 1, url: "https://pirmas.example" })]));
    backend.on("GET", "/api/phishingpictures/12/links", () => secondAreas.promise);

    const { container, rerender } = render(
      <InteractiveImage src="/api/phishingpictures/11" clickableAreasUrl="/api/phishingpictures/11/links" />
    );
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    rerender(<InteractiveImage src="/api/phishingpictures/12" clickableAreasUrl="/api/phishingpictures/12/links" />);
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await settle();

    const areas = linkAreas(container);
    areas.forEach((area) => fireEvent.mouseEnter(area));
    const meanwhile = {
      areas: areas.length,
      firstLinkShown: screen.queryByText("https://pirmas.example") !== null,
    };

    await act(async () => secondAreas.resolve(reply.json([fx.questionLink({ id: 2, url: "https://antras.example" })])));
    await settle();

    return meanwhile;
  };

  // The first image's link is hovered — its URL bubble open —
  // when the question changes without the pointer moving (a
  // keyboard switch: no mouseleave, and the removed area gets
  // none either); the second image then loads and its own areas
  // arrive. Nothing hovers the second image
  const switchQuestionWhileHovering = async () => {
    backend.on("GET", "/api/phishingpictures/11/links", reply.json([fx.questionLink({ id: 1, url: "https://pirmas.example" })]));
    backend.on("GET", "/api/phishingpictures/12/links", reply.json([fx.questionLink({ id: 2, url: "https://antras.example" })]));

    const { container, rerender } = render(
      <InteractiveImage src="/api/phishingpictures/11" clickableAreasUrl="/api/phishingpictures/11/links" />
    );
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));
    fireEvent.mouseEnter(linkAreas(container)[0]);
    expect(screen.getByText("https://pirmas.example")).toBeInTheDocument();

    rerender(<InteractiveImage src="/api/phishingpictures/12" clickableAreasUrl="/api/phishingpictures/12/links" />);
    fireEvent.load(screen.getByAltText("Fišingo El. Laiškas"));
    await waitFor(() => expect(backend.requests("GET", "/api/phishingpictures/12/links")).toHaveLength(1));
    await settle();
  };


  it("reproduces: a late reply of the first image lands on the second one", async () => {
    await switchImageWhileAreasLoad();

    expect(screen.getByText("https://pirmas.example")).toBeInTheDocument();
  });


  it.fails("the second image keeps its own link", async () => {
    // A fix that aborts the stale request makes the component log
    // the abort — not a fault of the fix
    allowConsoleError(/Error fetching clickable areas/);
    await switchImageWhileAreasLoad();

    expect(screen.getByText("https://antras.example")).toBeInTheDocument();
  });


  it("reproduces: until its own areas arrive, the second image shows the first image's area and link", async () => {
    expect(await loadNextImageBeforeItsAreas()).toEqual({ areas: 1, firstLinkShown: true });
  });


  it.fails("nothing of the first image shows on the second one before its own areas arrive", async () => {
    expect(await loadNextImageBeforeItsAreas()).toEqual({ areas: 0, firstLinkShown: false });
  });


  it("reproduces: the first image's URL bubble reappears over the second one and stays after its own areas arrived", async () => {
    await switchQuestionWhileHovering();

    expect(screen.getByText("https://pirmas.example")).toBeInTheDocument();
  });


  it.fails("no URL bubble of the first image shows over the second one", async () => {
    await switchQuestionWhileHovering();

    expect(screen.queryByText("https://pirmas.example")).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-14 — a failed question-bank load is shown as an empty
//         bank
// -----------------------------------------------------------
//
// WHERE:   Questions.jsx — `data` stays the hook's initial []
//          after an error; QuestionsList then renders its
//          empty-bank state
// TRIGGER: GET /api/admin/questions fails (500, network)
// IMPACT:  "Klausimų banke dar nieko nėra" — the admin is told
//          the bank is empty (and may upload everything again)
//          when it merely failed to load
// SUGGESTED FIX: on a failed first load show an error panel
//          with a retry instead of the list
// -----------------------------------------------------------

describe("KB-14 — a failed question-bank load is shown as an empty bank", () => {

  // Waits for the request, not for the admin frame — a fix may
  // render its error panel without the page layout
  const renderFailedBank = async () => {
    backend.on("GET", "/api/admin/questions", reply.status(500, "Internal Server Error"));
    renderPage(<Questions />, { path: "/admin/questions" });
    await waitFor(() => expect(backend.requests("GET", "/api/admin/questions")).toHaveLength(1));
    await settle();
  };


  it("reproduces: the empty-bank message is shown", async () => {
    await renderFailedBank();

    expect(screen.getByText("Klausimų banke dar nieko nėra")).toBeInTheDocument();
  });


  it.fails("a failed load is not presented as an empty bank — it explains itself or offers a retry", async () => {
    await renderFailedBank();

    expect(screen.queryByText("Klausimų banke dar nieko nėra")).toBeNull();
    await waitFor(() => {
      expect(screen.queryAllByText(EXPLAINS).length + screen.queryAllByRole("button", { name: EXPLAINS }).length).toBeGreaterThan(0);
    });
  });
});







// -----------------------------------------------------------
// KB-15 — repeated option texts give an answer review
//         duplicate React keys
// -----------------------------------------------------------
//
// WHERE:   StudentAnswers.jsx — AnswerCard keys the option rows
//          by `optiontext`
// TRIGGER: two options of one question with the same text —
//          typically two options left blank ("")
// IMPACT:  React's duplicate-key error; rows may be duplicated
//          or dropped when the list re-renders
// SUGGESTED FIX: key the (static) option rows by index
// -----------------------------------------------------------

describe("KB-15 — repeated option texts give an answer review duplicate keys", () => {

  const renderTwoBlankOptions = async () => {
    allowConsoleError(/same key/);
    backend.on("GET", "/api/admin/students/5/answers", reply.json([
      fx.studentAnswer({
        id: 11,
        answeredoptions: [
          fx.answeredOption({ optiontext: "", rightansweroption: 1, selectedansweroption: 1 }),
          fx.answeredOption({ optiontext: "", rightansweroption: 0, selectedansweroption: 0 }),
        ],
      }),
    ]));

    render(<StudentAnswers studentID={5} />);
    await screen.findByText("Ar tai fišingas?");
  };

  const duplicateKeyErrors = () => consoleErrors().filter((message) => /same key/.test(message));


  it("reproduces: React reports the duplicate key", async () => {
    await renderTwoBlankOptions();

    expect(duplicateKeyErrors()).not.toHaveLength(0);
  });


  it.fails("two blank options render without a duplicate-key error", async () => {
    await renderTwoBlankOptions();

    expect(duplicateKeyErrors()).toHaveLength(0);
  });
});







// -----------------------------------------------------------
// KB-16 — a slide the browser cannot decode leaks its object
//         URL
// -----------------------------------------------------------
//
// WHERE:   Slides.jsx — preloadNewSlide: the object URL is
//          created before the image is decoded; when decoding
//          fails, the catch only logs and null is returned —
//          the URL is never revoked
// TRIGGER: a corrupt / undecodable file in the slides folder
//          (it is picked at random, so again and again)
// IMPACT:  every pick leaks the blob behind the URL — the
//          projector page runs all day, its memory only grows
// SUGGESTED FIX: revoke the URL when decoding fails (track it
//          outside the try, revoke in the catch)
// -----------------------------------------------------------

describe("KB-16 — a slide the browser cannot decode leaks its object URL", () => {

  // jsdom decodes nothing: an Image that always fails. The
  // object-URL API is spied on (predictable URLs, revokes
  // recorded) — spies, not assignments, so setup.js's
  // restoreAllMocks puts it back for the entries after this
  // one. All on a fake setTimeout (the loop's sleep)
  class UndecodableImage {
    set src(value) {
      queueMicrotask(() => this.onerror?.(new Event("error")));
    }
  }

  beforeEach(() => {
    let created = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:slide-${++created}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("Image", UndecodableImage);
  });

  // The first preload fails within microtasks — 100 ms in, well
  // before the 6 s leaderboard phase ends and a retry starts
  const preloadBrokenSlide = async () => {
    allowConsoleError(/Failed to fetch slide/);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    backend.on("GET", "/api/leaderboard/nextslide", reply.image("image/webp"));

    renderPage(<SlidesPage />, { path: "/slides" });
    await act(() => vi.advanceTimersByTimeAsync(100));
  };


  it("reproduces: the undecodable slide's URL is created and never revoked", async () => {
    await preloadBrokenSlide();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });


  // Fix-agnostic: revoking the URL in the catch, or creating it
  // only once the image has decoded, both leave nothing behind
  // (the request check keeps a preload that never ran from
  // passing for a fix)
  it.fails("the undecodable slide leaves no object URL behind", async () => {
    await preloadBrokenSlide();

    const created = URL.createObjectURL.mock.results.map((result) => result.value);
    const revoked = URL.revokeObjectURL.mock.calls.map(([url]) => url);
    expect(backend.requests("GET", "/api/leaderboard/nextslide")).not.toHaveLength(0);
    expect(created.filter((url) => !revoked.includes(url))).toEqual([]);
  });
});







// -----------------------------------------------------------
// KB-17 — the summary grid's ID column prints "#" without the
//         question id
// -----------------------------------------------------------
//
// WHERE:   StudentTestSummaryTable.jsx — SUMMARY_COLUMNS, the
//          "id" column's renderCell reads params.row.questionid
// TRIGGER: opening a student's "Testo Apibendrinimas" tab
// IMPACT:  every row's ID cell reads "#" — the answers endpoint
//          names the question id `id` and has no `questionid`
//          (contract/api.js carries this read as a
//          knownBugReads entry)
// SUGGESTED FIX: print params.row.id
// -----------------------------------------------------------

describe("KB-17 — the summary grid's ID column prints '#' without the question id", () => {

  const idCells = () => [...document.querySelectorAll('[role="gridcell"][data-field="id"]')];

  const renderSummary = async () => {
    backend.on("GET", "/api/admin/students/5/answers", reply.json([
      fx.studentAnswer({ id: 11 }),
      fx.studentAnswer({ id: 12 }),
    ]));
    renderPage(<StudentTestSummaryTable studentID="5" />);
    await waitFor(() => expect(idCells()).toHaveLength(2));
  };


  it("reproduces: the ID cells read only '#'", async () => {
    await renderSummary();

    expect(idCells().map((cell) => cell.textContent)).toEqual(["#", "#"]);
  });


  // Only the digits count: "#11" (the suggested fix) and a plain
  // "11" (renderCell dropped, the column's default cell) both
  // carry the id
  it.fails("the ID cells carry the question ids", async () => {
    await renderSummary();

    expect(idCells().map((cell) => cell.textContent.replace(/\D/g, ""))).toEqual(["11", "12"]);
  });
});







// -----------------------------------------------------------
// KB-18 — "Per Paskutinį Mėnesį" loses up to three days on the
//         29th–31st of a month
// -----------------------------------------------------------
//
// WHERE:   StudentsListTable.jsx — the cutoff
//          `oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)`
// TRIGGER: the students list opened on the 29th, 30th or 31st
//          of a month whose previous month is shorter (e.g.
//          March 31: "February 31" rolls over to March 3)
// IMPACT:  the month's oldest one to three days are cut off —
//          on March 31 students seen 28–31 days ago are hidden
//          by a filter that promises the last month
// SUGGESTED FIX: step back one calendar month with the day
//          clamped to that month's length (March 31 →
//          February 28/29)
// -----------------------------------------------------------

describe("KB-18 — the last-month filter shrinks on the 29th–31st", () => {

  // Fake ONLY Date — the grid and React Testing Library keep
  // their real timers
  const openListOnMarch31 = async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-31T12:00:00+03:00"));
    backend.on("GET", "/api/admin/students", reply.json([
      fx.studentDetail({ id: 1, username: "PRIES_29_DIENAS", lastseen: "2026-03-02T12:00:00+02:00" }),
    ]));

    renderPage(<StudentsListTable />, { path: "/admin/students" });

    // The heading's "(N)" appears once the list has loaded
    await screen.findByText(/^\(\d+\)$/);
  };


  it("reproduces: a student seen 29 days ago is filtered out", async () => {
    await openListOnMarch31();

    expect(screen.getByText("(0)")).toBeInTheDocument();
  });


  it.fails("a student seen 29 days ago counts as seen within the last month", async () => {
    await openListOnMarch31();

    expect(screen.getByText("(1)")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// KB-19 — a failed student-record load shows the student a
//         0 grade
// -----------------------------------------------------------
//
// WHERE:   TestFinish.jsx — `if (loadingData)` is the only
//          guard; after a failed load useFetchData's `data` is
//          still its initial [], so the grade tile prints
//          `data.testgrade || 0.0` → 0 and every count tile
//          "0 / 0"
// TRIGGER: GET /api/admin/students/<userid> fails with anything
//          but 401 (500, 502 during a deploy, no connection)
// IMPACT:  right after finishing, the student reads "Testas
//          baigtas!" with a grade of 0 and "0 / 0" tiles — told
//          they scored nothing, with no hint that the results
//          merely failed to load or that a reload would help
// SUGGESTED FIX: when `error` is set and no record arrived,
//          render a message with a "Bandyti dar kartą" (reload)
//          button instead of the summary tiles
// -----------------------------------------------------------

describe("KB-19 — a failed student-record load shows the student a 0 grade", () => {

  // The record fails; the finish call and the (empty) review
  // answer as usual
  const renderFailedRecord = async () => {
    backend.on("GET", "/api/admin/students/5", reply.status(500, "Internal Server Error"));
    backend.on("GET", "/api/student/finish", reply.json({}));
    backend.on("GET", "/api/admin/students/5/answers", reply.json([]));

    renderPage(<TestFinish authData={fx.studentAuth()} />, { path: "/student/finish" });
    await waitFor(() => expect(backend.requests("GET", "/api/admin/students/5")).toHaveLength(1));
    await settle();
  };


  it("reproduces: 'Testas baigtas!' with a 0 grade and 0 / 0 tiles", async () => {
    await renderFailedRecord();

    expect(screen.getByRole("heading", { name: "Testas baigtas!" })).toBeInTheDocument();
    expect(screen.getByText("Testo Įvertinimas").previousElementSibling.textContent).toBe("0");
    expect(screen.getAllByText("0 / 0")).toHaveLength(3);
  });


  it.fails("a failed load invents no results and explains itself or offers a retry", async () => {
    await renderFailedRecord();

    expect(screen.queryByText("Testo Įvertinimas")?.previousElementSibling?.textContent).not.toBe("0");
    expect(screen.queryAllByText("0 / 0")).toHaveLength(0);
    await waitFor(() => {
      expect(screen.queryAllByText(EXPLAINS).length + screen.queryAllByRole("button", { name: EXPLAINS }).length).toBeGreaterThan(0);
    });
  });
});







// -----------------------------------------------------------
// KB-20 — a failed answers load is shown as an empty answer
//         review
// -----------------------------------------------------------
//
// WHERE:   StudentAnswers.jsx — StudentAnswers reads only
//          `data` from useFetchData; after a failed load it is
//          still the initial [], so nothing renders
// TRIGGER: GET /api/admin/students/<id>/answers fails (500, 502
//          during a deploy, no connection)
// IMPACT:  the review is blank — exactly what a student who was
//          never dealt a test gets: the admin's "Atsakymai" tab
//          stays empty, the student's results page ends at the
//          summary, and nobody is told that the answers merely
//          failed to load
// SUGGESTED FIX: use `error` from useFetchData — render a short
//          message ("Nepavyko įkelti atsakymų") with a retry
//          (refetch) instead of the empty list
// -----------------------------------------------------------

describe("KB-20 — a failed answers load is shown as an empty answer review", () => {

  // With a <Toaster/> (the review mounts none of its own), so a
  // fix that toasts the failure counts as well
  const renderFailedAnswers = async () => {
    backend.on("GET", "/api/admin/students/5/answers", reply.status(500, "Internal Server Error"));

    const view = renderPage(<StudentAnswers studentID={5} />, { toaster: true });
    await waitFor(() => expect(backend.requests("GET", "/api/admin/students/5/answers")).toHaveLength(1));
    await settle();
    return view;
  };


  it("reproduces: nothing at all is rendered", async () => {
    const { container } = await renderFailedAnswers();

    expect(container.textContent).toBe("");
  });


  it.fails("a failed load is not silent — it explains itself or offers a retry", async () => {
    await renderFailedAnswers();

    await waitFor(() => {
      expect(screen.queryAllByText(EXPLAINS).length + screen.queryAllByRole("button", { name: EXPLAINS }).length).toBeGreaterThan(0);
    });
  });
});







// -----------------------------------------------------------
// KB-21 — a save refused with 401 is reported as a connection
//         problem — the student can never finish
// -----------------------------------------------------------
//
// WHERE:   TestHome.jsx — useTestQuestions: save()'s catch
//          takes every failure for a lost connection, and
//          finishTest only re-sends and toasts again; only the
//          questions GET handles 401
// TRIGGER: the session ends while the test is open — e.g. the
//          student opens /login in another tab of the same
//          browser (the login page logs out on mount) — so
//          every POST /api/student/questions answers 401
// IMPACT:  every click toasts "Nepavyko išsaugoti atsakymo —
//          patikrinkite ryšį" although the connection is fine,
//          nothing is saved any more, and "Užbaigti testą" only
//          answers "Paskutiniai atsakymai neišsaugoti —
//          patikrinkite ryšį ir bandykite dar kartą": the
//          student can never finish and is never told to log
//          in again
// SUGGESTED FIX: treat a 401 on the save like the load does —
//          window.location.href = "/login" (everything saved
//          before the session ended is on the server); an axios
//          response interceptor would cover the admin saves of
//          KB-36 as well
// -----------------------------------------------------------

describe("KB-21 — a save refused with 401 is reported as a connection problem", () => {

  // The session is gone: the student answers, then holds
  // "Užbaigti testą" as told
  const answerAndFinishWithoutSession = async () => {
    backend.on("GET", "/api/student/questions", reply.json(fx.dealtTest(2)));
    backend.on("POST", "/api/student/questions", reply.status(401, "Unauthorized"));
    const { user } = renderPage(<TestHome />, { path: "/student" });

    await user.click(await screen.findByRole("button", { name: "Fišingas" }));
    await settle();

    longPress(screen.getByRole("button", { name: "Užbaigti testą" }), 1600);
    await settle();
  };


  it("reproduces: the student is told to check the connection and cannot finish", async () => {
    await answerAndFinishWithoutSession();

    await findToast("Nepavyko išsaugoti atsakymo — patikrinkite ryšį");
    await findToast("Paskutiniai atsakymai neišsaugoti — patikrinkite ryšį ir bandykite dar kartą");
    expect(hardNavigations()).toEqual([]);
  });


  it.fails("a save refused with 401 sends the student to /login, as a refused load does", async () => {
    await answerAndFinishWithoutSession();

    await waitFor(() => expect(hardNavigations()).toContain("/login"));
  });
});







// -----------------------------------------------------------
// KB-22 — a new registration shows an earlier sign-in's
//         refusal
// -----------------------------------------------------------
//
// WHERE:   Login.jsx — Login's loginErrorBoxText: ONE message
//          for the sign-in form AND registration step 2
//          (RegisterForm's <ErrorBox>{loginErrorBoxText}), set
//          by handleLogin and never cleared
// TRIGGER: a refused sign-in ("Jau turiu paskyrą —
//          prisijungti" → PRISIJUNGTI), then "Neturiu paskyros
//          — registruotis" and a successful registration
// IMPACT:  step 2 shows the brand-new name and access code
//          with the old red "Vardas ir/arba Slaptažodis
//          neteisingas." right above PRADĖTI TESTĄ — the new
//          student is told the credentials are wrong before
//          ever using them (and may register yet again)
// SUGGESTED FIX: clear loginErrorBoxText when the visible form
//          switches (or when a registration succeeds)
// -----------------------------------------------------------

describe("KB-22 — a new registration shows an earlier sign-in's refusal", () => {

  const REFUSAL = "Vardas ir/arba Slaptažodis neteisingas.";

  // A refused sign-in → back to registration → a successful
  // registration; resolves once step 2 is on screen
  const registerAfterRefusedSignIn = async () => {
    backend.on("POST", "/api/login", reply.text(REFUSAL));
    backend.on("POST", "/api/student/register", reply.json({ status: "OK", username: "JONAS_JONAITIS", accessCode: "48291037" }));
    const { user } = renderLogin();

    await user.click(screen.getByRole("button", { name: "Jau turiu paskyrą — prisijungti" }));
    await user.type(screen.getByLabelText(/Vardas \/ El\. Paštas/), "JONAS");
    await user.type(screen.getByLabelText(/Kodas \/ Slaptažodis/), "00000000");
    await user.click(screen.getByRole("button", { name: "PRISIJUNGTI" }));
    await screen.findByText(REFUSAL);

    await user.click(screen.getByRole("button", { name: "Neturiu paskyros — registruotis" }));
    await user.type(screen.getByLabelText(/Prisijungimo Vardas/), "jonas_jonaitis");
    await user.click(screen.getByRole("button", { name: "REGISTRUOTIS" }));
    await screen.findByRole("button", { name: "PRADĖTI TESTĄ" });
  };

  // The refusals on screen — one inside the hidden form (the
  // "hidden" class; Tailwind is not loaded, see KB-06) does
  // not count
  const shownRefusals = () => screen.queryAllByText(REFUSAL).filter((element) => !element.closest(".hidden"));


  it("reproduces: step 2 shows the old refusal next to the new credentials", async () => {
    await registerAfterRefusedSignIn();

    const shown = shownRefusals();
    expect(shown).toHaveLength(1);
    expect(shown[0].closest("form")).toContainElement(screen.getByRole("button", { name: "PRADĖTI TESTĄ" }));
    expect(shown[0].closest("form")).toHaveTextContent("JONAS_JONAITIS");
  });


  it.fails("step 2 shows the new credentials without the earlier refusal", async () => {
    await registerAfterRefusedSignIn();

    expect(shownRefusals()).toEqual([]);
  });
});







// -----------------------------------------------------------
// KB-23 — a failed leaderboard load says "Šiuo metu dalyvių
//         nėra"
// -----------------------------------------------------------
//
// WHERE:   LeaderboardTable.jsx — the empty-state row
//          (`!loadingData && filteredRows.length === 0`); the
//          `error` useFetchData returns is never read
// TRIGGER: GET /api/leaderboard fails (500, 502 during a
//          deploy, no connection) while no standings have
//          loaded yet — e.g. the projector page (re)opened
//          during an outage
// IMPACT:  the projector tells the room "Šiuo metu dalyvių
//          nėra" (nobody is taking part right now) while the
//          board is merely unreachable — until a refresh
//          succeeds
// SUGGESTED FIX: take `error` from useFetchData and, while no
//          standings have arrived, show a connection message
//          (the 5 s countdown keeps retrying) instead of the
//          empty state
// -----------------------------------------------------------

describe("KB-23 — a failed leaderboard load says 'Šiuo metu dalyvių nėra'", () => {

  // No <Toaster/>: the /leaderboard page mounts none, so a toast
  // would never reach the projector
  const renderFailedBoard = async () => {
    backend.on("GET", "/api/leaderboard", reply.status(500, "Internal Server Error"));
    renderPage(<LeaderboardTable />, { path: "/leaderboard" });
    await waitFor(() => expect(backend.requests("GET", "/api/leaderboard")).toHaveLength(1));
    await settle();
  };


  it("reproduces: 'Šiuo metu dalyvių nėra' is on screen", async () => {
    await renderFailedBoard();

    expect(screen.getByText("Šiuo metu dalyvių nėra")).toBeInTheDocument();
  });


  it.fails("a failed load does not claim that nobody takes part — it says the board is unreachable", async () => {
    await renderFailedBoard();

    expect(screen.queryByText("Šiuo metu dalyvių nėra")).toBeNull();
    await waitFor(() => {
      expect(screen.queryAllByText(EXPLAINS).length + screen.queryAllByRole("button", { name: EXPLAINS }).length).toBeGreaterThan(0);
    });
  });
});







// -----------------------------------------------------------
// KB-24 — a late refresh reply takes the page back to older
//         data
// -----------------------------------------------------------
//
// WHERE:   useFetchData.js — fetchData applies every reply
//          (`setData(response.data)`) whenever it arrives,
//          and the polling interval (refreshInterval) — like
//          LeaderboardTable's 5 s countdown (`refetch`) —
//          starts a new request whether or not the previous
//          one has answered
// TRIGGER: a backend slower than the refresh period (the
//          dashboard polls every 2 s, the students list every
//          5 s, the leaderboard refetches every 5 s) — e.g.
//          under event load — so an earlier request answers
//          after a later one
// IMPACT:  the page falls back to the OLDER data until the
//          next reply: the projector's standings, the
//          students list or the dashboard's live progress
//          jump back; meanwhile the requests pile up on the
//          slow backend (every open page adds one per period)
// SUGGESTED FIX: number the requests in useFetchData (a ref
//          counter) and apply only the latest one's reply or
//          error — or start no refresh while one is in
//          flight. Same root as KB-09 (there: an endpoint
//          change); the counter fixes both
// -----------------------------------------------------------

describe("KB-24 — a late refresh reply takes the page back to older data", () => {

  // One student mid-test — the more answers, the newer the reply
  const standings = (answered) => [fx.leaderboardEntry({ isfinished: 0, answeredquestioncount: answered })];

  const answeredOnScreen = () => JSON.parse(screen.getByTestId("data").textContent)[0].answeredquestioncount;

  // Polls every 5 s (the leaderboard's pace) on a fake interval
  // — so no waitFor here. The 5 s poll is slow: its reply only
  // arrives after the 10 s poll's. Gives the answered count on
  // screen just before and just after that late reply lands
  const pollWithSlowReply = async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const slowPoll = deferred();
    backend.once("GET", "/api/leaderboard", reply.json(standings(2)));
    backend.once("GET", "/api/leaderboard", () => slowPoll.promise);
    backend.on("GET", "/api/leaderboard", reply.json(standings(10)));

    render(<DataProbe endpoint="/api/leaderboard" refreshInterval={5} />);
    await act(() => vi.advanceTimersByTimeAsync(10000));
    const before = answeredOnScreen();

    await act(async () => slowPoll.resolve(reply.json(standings(6))));
    await act(() => vi.advanceTimersByTimeAsync(0));

    return { before, after: answeredOnScreen() };
  };


  it("reproduces: the 5 s poll's late reply replaces the 10 s poll's newer data", async () => {
    const { before, after } = await pollWithSlowReply();

    expect(before).toBe(10);
    expect(after).toBe(6);
  });


  // Fix-agnostic: dropping the stale reply keeps 10; skipping
  // the overlapping poll never shows 10 and ends on 6 — either
  // way the data never goes back
  it.fails("a late reply never takes the data back to older data", async () => {
    const { before, after } = await pollWithSlowReply();

    expect(after).toBeGreaterThanOrEqual(before);
  });
});







// -----------------------------------------------------------
// KB-25 — an edit made just before a question card goes away
//         is never saved
// -----------------------------------------------------------
//
// WHERE:   QuestionCard.jsx — useQuestionEditor, the autosave
//          effect: its cleanup (`clearTimeout(debounceTimeout)`)
//          only cancels the pending save
// TRIGGER: the admin edits a card and leaves it within 500 ms
//          (a sidebar link, browser back) — the card unmounts
//          while the autosave debounce still runs
// IMPACT:  the edit is dropped silently: no request, no toast.
//          There is no save button and "Saugoma…" was on
//          screen, so the admin believes it was saved
// SUGGESTED FIX: on unmount, send a still-pending save right
//          away (the latest question kept in a ref) instead of
//          only cancelling its timer
// -----------------------------------------------------------

describe("KB-25 — an edit made just before a question card goes away is never saved", () => {

  const SAVE = "/api/admin/questions/updatequestion";

  // Edits "Papildomai", then the card unmounts 200 ms later —
  // well inside the 500 ms autosave debounce
  const editAndLeave = async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    backend.on("POST", SAVE, reply.json({ status: "ok" }));

    const { unmount } = renderPage(
      <QuestionCard fetchedQuestionData={fx.adminQuestion({ questionid: 21 })} triggerQuestionListUpdate={vi.fn()} />,
      { toaster: true }
    );

    fireEvent.change(screen.getByLabelText("Papildomai"), { target: { value: "Paskutinis pakeitimas" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByText("Saugoma…")).toBeInTheDocument();

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(1000));
  };


  it("reproduces: the edit never reaches the backend", async () => {
    await editAndLeave();

    expect(backend.requests("POST", SAVE)).toHaveLength(0);
  });


  it.fails("the edit is saved although the card is gone", async () => {
    await editAndLeave();

    const saves = backend.requests("POST", SAVE);
    expect(saves).not.toHaveLength(0);
    expect(saves[saves.length - 1].json.questiontext).toBe("Paskutinis pakeitimas");
  });
});







// -----------------------------------------------------------
// KB-26 — a question card says "Išsaugota" while a newer edit
//         is still unsaved
// -----------------------------------------------------------
//
// WHERE:   QuestionCard.jsx — useQuestionEditor, the autosave
//          effect: EVERY save's reply sets the status (.then →
//          "saved", .catch → "idle"), however many edits came
//          after it was sent
// TRIGGER: the admin edits again while the previous autosave
//          is still on its way (a slow backend); that older
//          save answers while the newer edit waits in its
//          500 ms debounce
// IMPACT:  the header claims "Išsaugota" for an edit that has
//          not even been sent — with no save button this is all
//          the admin goes by, and leaving now loses the edit
//          (KB-25). A failing older save likewise drops
//          "Saugoma…" and toasts while the newer edit is still
//          to come
// SUGGESTED FIX: let only the newest save set the status —
//          number the saves in a ref, ignore the replies of
//          older ones, and keep "Saugoma…" while an edit waits
// -----------------------------------------------------------

describe("KB-26 — a question card says 'Išsaugota' while a newer edit is still unsaved", () => {

  const SAVE = "/api/admin/questions/updatequestion";

  // Edit → its save goes out and hangs (slow backend); edit
  // again; the first save answers while the second edit still
  // waits in the debounce
  const olderSaveAnswersDuringNewerEdit = async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const firstSave = deferred();
    backend.once("POST", SAVE, () => firstSave.promise);
    backend.on("POST", SAVE, reply.json({ status: "ok" }));

    renderPage(
      <QuestionCard fetchedQuestionData={fx.adminQuestion({ questionid: 21 })} triggerQuestionListUpdate={vi.fn()} />,
      { toaster: true }
    );
    const description = screen.getByLabelText("Papildomai");

    fireEvent.change(description, { target: { value: "Pirmas" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    fireEvent.change(description, { target: { value: "Antras" } });
    await act(async () => firstSave.resolve(reply.json({ status: "ok" })));
  };


  it("reproduces: 'Išsaugota' shows before the newest edit was even sent", async () => {
    await olderSaveAnswersDuringNewerEdit();

    expect(backend.requests("POST", SAVE).map((request) => request.json.questiontext)).toEqual(["Pirmas"]);
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();
  });


  // Fix-agnostic: a fix may keep "Saugoma…" until the waiting
  // edit's debounce runs out, or send that edit as soon as the
  // older save answered — then "Išsaugota" is already true
  it.fails("'Išsaugota' shows only once the newest edit is saved", async () => {
    await olderSaveAnswersDuringNewerEdit();
    const newestSent = () => backend.lastRequest("POST", SAVE).json.questiontext === "Antras";

    expect(screen.queryByText("Išsaugota") === null || newestSent(), "'Išsaugota' before 'Antras' was sent").toBe(true);

    // ...and does show once it is (a card that never says it
    // is no fix)
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(newestSent()).toBe(true);
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// KB-27 — overlapping autosaves are not serialized — an older
//         question state can win
// -----------------------------------------------------------
//
// WHERE:   QuestionCard.jsx — useQuestionEditor, the autosave
//          effect: every 500 ms debounce POSTs the whole
//          question at once, whether the previous save has
//          answered or not
// TRIGGER: a slow backend — an autosave is still in flight
//          when the next edit's debounce runs out, and the
//          older request is the one that completes last
// IMPACT:  the bank keeps the OLDER state (a text, a verdict, a
//          question the admin just switched off enabled again)
//          while the card shows the newer one and "Išsaugota";
//          nobody notices until the page is reloaded
// SUGGESTED FIX: one save at a time — while a save is on its
//          way, keep the newest state and send it once the
//          reply is in (as the test page's autosave does)
// -----------------------------------------------------------

describe("KB-27 — overlapping autosaves are not serialized — an older question state can win", () => {

  const SAVE = "/api/admin/questions/updatequestion";

  // The fake bank keeps the body of the save that COMPLETED
  // last — whatever the fix, the newest state has to be the
  // last one standing. The first save hangs until the second
  // edit's debounce has run out (and its save, if one was
  // sent, went through), so it completes last
  const saveTwiceOnSlowBackend = async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const firstSave = deferred();
    const bank = { question: null };

    backend.once("POST", SAVE, async (request) => {
      const firstAnswer = await firstSave.promise;
      bank.question = request.json;
      return firstAnswer;
    });
    backend.on("POST", SAVE, (request) => {
      bank.question = request.json;
      return reply.json({ status: "ok" });
    });

    renderPage(
      <QuestionCard fetchedQuestionData={fx.adminQuestion({ questionid: 21 })} triggerQuestionListUpdate={vi.fn()} />,
      { toaster: true }
    );
    const description = screen.getByLabelText("Papildomai");

    fireEvent.change(description, { target: { value: "Pirmas" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    fireEvent.change(description, { target: { value: "Antras" } });
    await act(() => vi.advanceTimersByTimeAsync(500));

    await act(async () => firstSave.resolve(reply.json({ status: "ok" })));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    return bank;
  };


  it("reproduces: two saves race and the bank keeps the older text, shown as saved", async () => {
    const bank = await saveTwiceOnSlowBackend();

    expect(backend.requests("POST", SAVE).map((request) => request.json.questiontext)).toEqual(["Pirmas", "Antras"]);
    expect(bank.question.questiontext).toBe("Pirmas");
    expect(screen.getByLabelText("Papildomai")).toHaveValue("Antras");
    expect(screen.getByText("Išsaugota")).toBeInTheDocument();
  });


  it.fails("the bank ends up with the newest state", async () => {
    const bank = await saveTwiceOnSlowBackend();

    expect(bank.question.questiontext).toBe("Antras");
  });
});







// -----------------------------------------------------------
// KB-28 — link areas stay put when the image resizes without
//         a window resize
// -----------------------------------------------------------
//
// WHERE:   InteractiveImage.jsx — the re-measuring effect: only
//          a window "resize" re-measures the image
// TRIGGER: the image changes size while the window does not —
//          the admin pins or unpins the sidebar (the page
//          content reflows), a scrollbar appears while the
//          question bank loads — under a preview that follows
//          its container's width (the question cards, the
//          answer review)
// IMPACT:  the link areas and their URL bubbles keep the old
//          pixel boxes: they no longer cover the links they
//          describe until the window itself is resized
// SUGGESTED FIX: re-measure from a ResizeObserver on the image
//          (or its container), like the link editor's canvas
//          already does
// -----------------------------------------------------------

describe("KB-28 — link areas stay put when the image resizes without a window resize", () => {

  // Measured on load at 400 × 200 px; the page then narrows the
  // image to 300 × 150 px without resizing the window. The
  // ResizeObserver reports it for the image AND its container —
  // whichever of the two a fix watches
  const narrowWithoutWindowResize = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink()]));
    const { container } = render(
      <InteractiveImage src="/api/phishingpictures/21" clickableAreasUrl="/api/phishingpictures/21/links" />
    );
    const image = screen.getByAltText("Fišingo El. Laiškas");

    placeBox(image, { left: 0, top: 0, width: 400, height: 200 });
    placeBox(image.parentNode, { left: 0, top: 0, width: 400, height: 200 });
    fireEvent.load(image);
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    placeBox(image, { left: 0, top: 0, width: 300, height: 150 });
    placeBox(image.parentNode, { left: 0, top: 0, width: 300, height: 150 });
    act(() => {
      resizeObserved(image, { width: 300, height: 150 });
      resizeObserved(image.parentNode, { width: 300, height: 150 });
    });
    await settle();

    return container;
  };

  // The area's box in px however a fix places it: in px (as now,
  // measured), or in % of a container wrapping the image — no
  // measuring at all; 15 % of the 300 px wide box is 45 px
  const resolvedBox = (area) => {
    const box = area.parentNode.getBoundingClientRect();
    const px = (value, total) =>
      Math.round((value.endsWith("%") ? (parseFloat(value) / 100) * total : parseFloat(value)) * 1000) / 1000;

    return {
      left: px(area.style.left, box.width),
      top: px(area.style.top, box.height),
      width: px(area.style.width, box.width),
      height: px(area.style.height, box.height),
    };
  };


  it("reproduces: the area keeps the box it was measured with on load", async () => {
    const container = await narrowWithoutWindowResize();

    // 15 % × 400, 42 % × 200, 20 % × 400, 3 % × 200
    expect(pxBox(linkAreas(container)[0])).toEqual({ left: 60, top: 84, width: 80, height: 6 });
  });


  it.fails("the area follows the narrowed image", async () => {
    const container = await narrowWithoutWindowResize();

    // 15 % × 300, 42 % × 150, 20 % × 300, 3 % × 150
    await waitFor(() =>
      expect(resolvedBox(linkAreas(container)[0])).toEqual({ left: 45, top: 63, width: 60, height: 4.5 })
    );
  });
});







// -----------------------------------------------------------
// KB-29 — a null link coordinate gets no valid position
// -----------------------------------------------------------
//
// WHERE:   InteractiveImage.jsx — percentToPx (used by
//          AreaHighlight and UrlTooltip)
// TRIGGER: GET /api/phishingpictures/{id}/links answers a
//          coordinate as null — the contract's value for a
//          stored coordinate the API cannot parse
// IMPACT:  parseFloat(null) is NaN: the area's inline style
//          gets "NaNpx", which the browser drops — a null x / y
//          leaves the area at its static position instead of
//          on its link, a null width / height collapses it so
//          it cannot be hovered. The link editor shows the same
//          row at 0 % — the two views disagree
// SUGGESTED FIX: read an unparsable coordinate as 0, like the
//          editor does (parseFloat(value) || 0)
// -----------------------------------------------------------

describe("KB-29 — a null link coordinate gets no valid position", () => {

  // The image 20 px right and 30 px down in its container,
  // 400 × 200 px; the one area has x null
  const drawAreaWithNullX = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink({ x: null })]));
    const { container } = render(
      <InteractiveImage src="/api/phishingpictures/21" clickableAreasUrl="/api/phishingpictures/21/links" />
    );
    const image = screen.getByAltText("Fišingo El. Laiškas");

    placeBox(image, { left: 30, top: 50, width: 400, height: 200 });
    placeBox(image.parentNode, { left: 10, top: 20, width: 500, height: 300 });
    fireEvent.load(image);
    await waitFor(() => expect(linkAreas(container)).toHaveLength(1));

    return linkAreas(container)[0];
  };


  it("reproduces: the area's left is 'NaNpx', which the style engine drops", async () => {
    const area = await drawAreaWithNullX();

    expect(area.style.left).toBe("");
    // Only the null coordinate is lost: 30 + 42 % × 200
    expect(pxBox(area).top).toBe(114);
  });


  // The style engine drops an invalid length, so a value that
  // stuck is a valid one
  it.fails("the area gets a valid position and size", async () => {
    const area = await drawAreaWithNullX();

    for (const side of ["left", "top", "width", "height"]) {
      expect(area.style[side]).not.toBe("");
    }
  });
});







// -----------------------------------------------------------
// KB-30 — the link editor saves areas dragged off the image
// -----------------------------------------------------------
//
// WHERE:   InteractiveImageEditor.jsx — AreaOverlay's
//          bounds="parent" (the grey canvas, not the image) and
//          handleAreaChange, which only rounds
// TRIGGER: the admin drags (or resizes) a box into the grey
//          canvas around the centered image — react-rnd only
//          keeps it inside the canvas
// IMPACT:  negative or over-100 % coordinates are shown
//          ("X: -5%") and saved (x -0.05) — outside the
//          contract's 0.0–1.0 fractions, which the backend does
//          not check; the test page then draws that link area
//          beside the screenshot, where there is no link
// SUGGESTED FIX: clamp in handleAreaChange (x, y ≥ 0;
//          x + width, y + height ≤ 100), or bound the boxes by
//          the image instead of the canvas
// -----------------------------------------------------------

describe("KB-30 — the link editor saves areas dragged off the image", () => {

  // react-rnd keeps a dragged box inside its `bounds` element;
  // the double leaves that to this drag, which clamps the
  // requested corner (canvas px) with react-rnd's own limits —
  // so bounding the boxes by the image counts as a fix too
  const dragWithinBounds = (box, x, y) => {
    const { bounds, size, onDragStop } = box.rndProps;
    const canvas = box.parentNode.getBoundingClientRect();
    const boundary = bounds === "parent" ? box.parentNode
      : bounds instanceof Element ? bounds
      : typeof bounds === "string" ? document.querySelector(bounds)
      : null;
    const limit = boundary?.getBoundingClientRect();
    const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
    const left = limit ? clamp(x, limit.left - canvas.left, limit.left - canvas.left + limit.width - size.width) : x;
    const top = limit ? clamp(y, limit.top - canvas.top, limit.top - canvas.top + limit.height - size.height) : y;

    act(() => {
      onDragStop(new MouseEvent("mouseup"), { node: box, x: left, y: top, deltaX: 0, deltaY: 0, lastX: left, lastY: top });
    });
  };

  // The canvas at (100, 50), 600 × 400 px; the image centered
  // in it at (150, 60), 500 × 300 px — 50 px of grey on its
  // left. Its one area (15 % / 42 %) is dragged to canvas x 25,
  // into that grey, and saved
  const dragIntoTheGreyAndSave = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink()]));
    backend.on("POST", "/api/phishingpictures/21/links", reply.text("OK"));
    const { user } = renderPage(
      <InteractiveImageEditor src="/api/phishingpictures/21" initialAreasUrl="/api/phishingpictures/21/links" />,
      { toaster: true }
    );

    const image = await screen.findByAltText("Redaguojamas fišingo laiškas");
    placeBox(image.parentNode, { left: 100, top: 50, width: 600, height: 400 });
    placeBox(image, { left: 150, top: 60, width: 500, height: 300 });
    fireEvent.load(image);

    const [box] = screen.getAllByTestId("rnd-box");
    dragWithinBounds(box, 25, box.rndProps.position.y);

    await user.click(screen.getByRole("button", { name: /Išsaugoti/ }));
    await findToast("Nuorodos išsaugotos");

    return backend.lastRequest("POST", "/api/phishingpictures/21/links").json.areas[0];
  };


  it("reproduces: the area is shown and saved 5 % left of the image", async () => {
    const saved = await dragIntoTheGreyAndSave();

    // (25 − 50) / 500 = −5 %
    expect(screen.getByText("X: -5%")).toBeInTheDocument();
    expect(saved.x).toBe(-0.05);
  });


  it.fails("a saved area stays on the image", async () => {
    const saved = await dragIntoTheGreyAndSave();

    expect(saved.x).toBeGreaterThanOrEqual(0);
    expect(saved.y).toBeGreaterThanOrEqual(0);
    expect(saved.x + saved.width).toBeLessThanOrEqual(1);
    expect(saved.y + saved.height).toBeLessThanOrEqual(1);
  });
});







// -----------------------------------------------------------
// KB-31 — the link editor keeps the previous question's areas
//         when its question changes
// -----------------------------------------------------------
//
// WHERE:   InteractiveImageEditor.jsx — the areas effect: a new
//          initialAreasUrl is fetched, but the old areas (and
//          the "loaded" state) stay until an answer replaces
//          them
// TRIGGER: the editor stays mounted while its question changes
//          and the new question's GET is slow or fails. LATENT
//          today: no page swaps the question under a mounted
//          editor — EditQuestion (/admin/questions/:questionID)
//          is reached only by typing its URL, a full page load
//          (nothing links there), and a card keeps its question
//          for good. Any in-app way from one question's editor
//          to another's (a link, a "next question" button) makes
//          it live: React Router then only swaps the param
// IMPACT:  once live, question A's areas are shown and edited
//          over question B's image, and "Išsaugoti" POSTs them
//          to question B — replacing B's real link areas with
//          A's
// SUGGESTED FIX: on a new initialAreasUrl start over (no areas,
//          "Kraunasi...", no selection) and ignore an answer
//          that belongs to a previous URL
// -----------------------------------------------------------

describe("KB-31 — the link editor keeps the previous question's areas when its question changes", () => {

  // The editor shows question 21, then — still mounted, like on
  // a route param change — question 22, whose GET fails. A
  // plain render: its rerender keeps the editor mounted
  const moveToQuestionWhoseLoadFails = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.json([fx.questionLink({ id: 1, url: "https://pirmas.example" })]));
    backend.on("GET", "/api/phishingpictures/22/links", reply.status(500, "Internal Server Error"));
    backend.on("POST", "/api/phishingpictures/22/links", reply.text("OK"));

    const { rerender } = render(
      <InteractiveImageEditor src="/api/phishingpictures/21" initialAreasUrl="/api/phishingpictures/21/links" />
    );
    await screen.findByDisplayValue("https://pirmas.example");

    rerender(<InteractiveImageEditor src="/api/phishingpictures/22" initialAreasUrl="/api/phishingpictures/22/links" />);
    await waitFor(() => expect(backend.requests("GET", "/api/phishingpictures/22/links")).toHaveLength(1));
    await settle();
  };


  it("reproduces: question 21's area stays, and 'Išsaugoti' posts it to question 22", async () => {
    await moveToQuestionWhoseLoadFails();

    expect(screen.getByDisplayValue("https://pirmas.example")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Išsaugoti/ }));
    await waitFor(() => expect(backend.requests("POST", "/api/phishingpictures/22/links")).toHaveLength(1));
    await settle();

    expect(backend.lastRequest("POST", "/api/phishingpictures/22/links").json).toEqual({
      areas: [{ id: 1, url: "https://pirmas.example", x: 0.15, y: 0.42, width: 0.2, height: 0.03 }],
    });
  });


  it.fails("question 22's editor shows none of question 21's areas", async () => {
    await moveToQuestionWhoseLoadFails();

    expect(screen.queryByDisplayValue("https://pirmas.example")).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-32 — the link editor stays on "Kraunasi..." when its
//         areas cannot be loaded
// -----------------------------------------------------------
//
// WHERE:   InteractiveImageEditor.jsx — the areas effect:
//          fetchAreas' catch only toasts, so the
//          `!areasFetched` placeholder stays
// TRIGGER: GET /api/phishingpictures/{id}/links fails (500, a
//          502 during a deploy, no connection) — on
//          /admin/questions/:id and in a card's fullscreen
//          "Redaguoti Nuorodas" editor
// IMPACT:  "Nepavyko užkrauti nuorodų" is toasted once, then
//          the editor says "Kraunasi..." for good with no way
//          to retry in place — the admin has to leave (or
//          reload) and come back, or keeps waiting for a load
//          that is over
// SUGGESTED FIX: a `failed` state rendering a message with a
//          "Bandyti dar kartą" button that runs fetchAreas
//          again — NOT an empty editor: saving that would
//          delete every stored area of the question
// -----------------------------------------------------------

describe("KB-32 — the link editor stays on 'Kraunasi...' when its areas cannot be loaded", () => {

  // A retry button in whatever words the fix picks ("Bandyti
  // dar kartą", "Pakartoti", "Įkelti iš naujo", "Perkrauti")
  const RETRY = /bandyti|kartot|iš naujo|perkrau/i;

  const openWithFailingAreas = async () => {
    backend.on("GET", "/api/phishingpictures/21/links", reply.status(500, "Internal Server Error"));

    // Mounted like EditQuestion (/admin/questions/21) mounts it
    renderPage(
      <InteractiveImageEditor src="/api/phishingpictures/21" initialAreasUrl="/api/phishingpictures/21/links" />,
      { toaster: true }
    );
    await waitFor(() => expect(backend.requests("GET", "/api/phishingpictures/21/links")).toHaveLength(1));
    await settle();
  };


  it("reproduces: after the toast the editor still says 'Kraunasi...' and offers no retry", async () => {
    await openWithFailingAreas();
    await findToast("Nepavyko užkrauti nuorodų");

    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RETRY })).toBeNull();
  });


  it.fails("a failed load replaces 'Kraunasi...' with a retry", async () => {
    await openWithFailingAreas();

    await screen.findByRole("button", { name: RETRY }, { timeout: 1000 });
    expect(screen.queryByText("Kraunasi...")).toBeNull();
  });
});







// -----------------------------------------------------------
// KB-33 — a never-saved test size leaves the picker blank
// -----------------------------------------------------------
//
// WHERE:   Home.jsx — Home: <TestSizePicker currentSize=
//          {String(data.phishingtestsize)} />
// TRIGGER: GET /api/admin/home answers phishingtestsize: null
//          — the contract's value until an admin saves a size
//          for the first time (every fresh install)
// IMPACT:  "Testo dydis" shows no size at all: the picker's
//          value becomes the string "null", which matches no
//          option (MUI also warns "out-of-range value
//          `null`"). Yet new tests ARE dealt 30 questions —
//          the backend's code fallback (like any size, capped
//          at the enabled questions) — so the admin cannot see
//          what students get
// SUGGESTED FIX: show the size new tests get when none is
//          stored — currentSize={String(
//          data.phishingtestsize ?? 30)} — or a "30 klausimų"
//          placeholder
// -----------------------------------------------------------

describe("KB-33 — a never-saved test size leaves the picker blank", () => {

  // MUI's development build warns about the unmatched value —
  // kept out of the output, read back by the reproduction. The
  // warning comes from a passive effect; settle() makes sure it
  // ran, however React scheduled it after the first render
  const renderNeverSaved = async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard({ phishingtestsize: null })));
    renderPage(<Home />, { path: "/admin" });
    await screen.findByText("Studentų");
    await settle();
    return warn;
  };


  it("reproduces: the picker shows no size, and MUI reports `null` out of range", async () => {
    const warn = await renderNeverSaved();

    expect(screen.getByRole("combobox").textContent).not.toMatch(/\d/);
    expect(warn.mock.calls.flat().join("\n")).toMatch(/out-of-range value `null`/);
  });


  it.fails("the picker shows the size new tests are dealt: '30 klausimų'", async () => {
    await renderNeverSaved();

    expect(screen.getByRole("combobox")).toHaveTextContent("30 klausimų");
  });
});







// -----------------------------------------------------------
// KB-34 — a failed test-size save leaves the picker on the
//         unsaved size
// -----------------------------------------------------------
//
// WHERE:   Home.jsx — TestSizePicker: the uncontrolled
//          TextField select (defaultValue={currentSize}) and
//          saveTestSize's catch branch, which only toasts
// TRIGGER: the admin picks a new size and POST
//          /api/admin/update/phishingtestsize fails (500,
//          401, 403 "Error: Not Admin", no connection)
// IMPACT:  "Nepavyko išsaugoti" appears next to a picker that
//          claims the unsaved size ("21 klausimų") while new
//          tests keep getting the stored one (12). Being
//          uncontrolled, the picker also ignores the polls
//          that report 12 every 2 s — it stays wrong until
//          the page is reloaded
// SUGGESTED FIX: drive the picker from data.phishingtestsize
//          (controlled), hold the admin's pick only while its
//          save is in flight and drop it when the save fails.
//          That also ends MUI's dev console.error "changing
//          the default value state of an uncontrolled
//          Select", logged whenever a poll brings a size the
//          page did not open with
// -----------------------------------------------------------

describe("KB-34 — a failed test-size save leaves the picker on the unsaved size", () => {

  // The save of "21" fails, then the next 2-second poll lands,
  // still reporting the stored 12. Only the poll interval is
  // faked: user-event and findToast keep the real setTimeout
  // (findToast's waitFor re-checks on DOM changes then). The
  // POST leaves inside the option click and fails at once, so
  // settle() sees the failure through — no wait on a toast a
  // fix may word differently
  const pickAndFailToSave = async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    backend.on("GET", "/api/admin/home", reply.json(fx.dashboard({ phishingtestsize: 12 })));
    backend.on("POST", "/api/admin/update/phishingtestsize", reply.status(500, "Internal Server Error"));
    const { user } = renderPage(<Home />, { path: "/admin" });
    await settle();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "21 klausimų" }));
    await settle();

    await act(() => vi.advanceTimersByTimeAsync(2000));
    await settle();
  };


  it("reproduces: the picker still shows the unsaved 21 after the next poll", async () => {
    await pickAndFailToSave();

    expect(backend.lastRequest("POST", "/api/admin/update/phishingtestsize").json).toEqual({ phishingtestsize: "21" });
    await findToast("Nepavyko išsaugoti");
    expect(backend.requests("GET", "/api/admin/home")).toHaveLength(2);
    expect(screen.getByRole("combobox")).toHaveTextContent("21 klausimų");
  });


  it.fails("after the failed save the picker shows the stored size again", async () => {
    await pickAndFailToSave();

    expect(screen.getByRole("combobox")).toHaveTextContent("12 klausimų");
  });
});







// -----------------------------------------------------------
// KB-35 — two images dropped at once are refused as a wrong
//         type or size
// -----------------------------------------------------------
//
// WHERE:   AddQuestion.jsx — ImageDropzone's onDropRejected:
//          one message for every kind of rejection
// TRIGGER: two valid images dragged onto the drop area at
//          once — `multiple: false` makes react-dropzone
//          refuse BOTH as "too-many-files" (the file dialog
//          lets only one be picked; a drag does not)
// IMPACT:  "Tinka tik PNG, JPG arba GIF paveikslėlis iki 5 MB"
//          — the admin is told the files are of the wrong type
//          or too large, though both are fine
// SUGGESTED FIX: read the error codes onDropRejected receives
//          and, for "too-many-files", say that one image goes
//          at a time
// -----------------------------------------------------------

describe("KB-35 — two images dropped at once are refused as a wrong type or size", () => {

  // The refusal of a wrong or too large file — right for those,
  // wrong for two good images
  const TYPE_OR_SIZE = "Tinka tik PNG, JPG arba GIF paveikslėlis iki 5 MB";

  // Two PNGs of a few bytes — each would be taken on its own.
  // jsdom has no DataTransfer: react-dropzone reads the plain
  // object's types and files. The drop is handled in promise
  // callbacks only (no timers), so settle() sees it through.
  // Resolves with the upload button — enabled once a file is
  // picked
  const dropTwoImages = async () => {
    renderPage(<AddQuestion setOpen={vi.fn()} getData={vi.fn()} />, { toaster: true });

    const dropArea = document.querySelector('input[type="file"]').parentElement;
    fireEvent.drop(dropArea, {
      dataTransfer: {
        types: ["Files"],
        files: [
          new File(["pirmas"], "pirmas.png", { type: "image/png" }),
          new File(["antras"], "antras.png", { type: "image/png" }),
        ],
      },
    });
    await settle();

    return screen.getByRole("button", { name: /Įkelti Paveikslėlį/ });
  };


  it("reproduces: both are refused with the type-or-size message", async () => {
    const uploadButton = await dropTwoImages();

    expect(toastTexts()).toEqual([TYPE_OR_SIZE]);
    expect(uploadButton).toBeDisabled();
  });


  // Fix-agnostic: saying that one image goes at a time (in any
  // words) or taking one of the two both count; the type-or-
  // size refusal, or no answer at all, do not
  it.fails("two good images get no type-or-size refusal, and the drop is answered", async () => {
    const uploadButton = await dropTwoImages();

    expect(toastTexts()).not.toContain(TYPE_OR_SIZE);
    expect(toastTexts().length > 0 || !uploadButton.disabled, "the drop was ignored silently").toBe(true);
  });
});







// -----------------------------------------------------------
// KB-36 — an expired session during an admin save reads as a
//         server error
// -----------------------------------------------------------
//
// WHERE:   AddQuestion.jsx — handleUpload's catch; the same in
//          every admin mutation (QuestionCard's saves,
//          InteractiveImageEditor.handleSave,
//          AddEditAdministrator.sendData, Home's test-size
//          save, StudentInformation's delete) — only
//          useFetchData's GETs and the test page's question
//          load handle a 401 (the test page's saves: KB-21)
// TRIGGER: the session ended meanwhile — logged out in another
//          tab (opening /login does that) or dropped server-
//          side — and the next upload is answered HTTP 401
// IMPACT:  "Nepavyko įkelti: Serverio klaida." — the admin
//          blames the server and retries in vain instead of
//          being sent to log in again, as any admin page load
//          would
// SUGGESTED FIX: on a 401, window.location.href = "/login"
//          like useFetchData — best once for every mutation
//          (an axios response interceptor)
// -----------------------------------------------------------

describe("KB-36 — an expired session during an admin save reads as a server error", () => {

  // Resolves with the render result — its location() is where
  // the router is
  const uploadWithExpiredSession = async () => {
    backend.on("POST", "/api/phishingpictures", reply.status(401, "Unauthorized"));
    const view = renderPage(<AddQuestion setOpen={vi.fn()} getData={vi.fn()} />, { toaster: true });

    await view.user.upload(document.querySelector('input[type="file"]'), new File(["png"], "laiskas.png", { type: "image/png" }));
    const uploadButton = screen.getByRole("button", { name: /Įkelti Paveikslėlį/ });
    await waitFor(() => expect(uploadButton).toBeEnabled());
    await view.user.click(uploadButton);
    await settle();

    return view;
  };


  it("reproduces: 'Serverio klaida.' is toasted and the admin stays on the page", async () => {
    const { location } = await uploadWithExpiredSession();
    await findToast("Serverio klaida.");

    expect(hardNavigations()).toEqual([]);
    expect(location().pathname).toBe("/");
  });


  // Fix-agnostic: only the target counts — a hard navigation
  // from the catch, an axios interceptor or both, with or
  // without a query string, or a router navigation
  it.fails("a 401 sends the admin to /login, as useFetchData does", async () => {
    const { location } = await uploadWithExpiredSession();

    await waitFor(() => {
      const toLogin = hardNavigations().some((url) => new URL(url, "http://localhost").pathname === "/login");
      expect(toLogin || location().pathname === "/login").toBe(true);
    });
  });
});







// -----------------------------------------------------------
// KB-37 — a hold released right at the full duration does
//         nothing
// -----------------------------------------------------------
//
// WHERE:   LongPressButton.jsx — useLongPress: only the
//          animation frame completes a press (`elapsed >=
//          duration` in tick); cancel() — mouse up, touch end,
//          leave — only toasts BEFORE the duration and
//          otherwise just clears the press
// TRIGGER: the release comes after the full duration but
//          before the next animation frame ran — a window of
//          one frame (~16 ms at 60 Hz, longer on a slow or busy
//          device)
// IMPACT:  the ring was all but full, yet nothing happens: no
//          action and no "hold longer" hint — the test is not
//          finished (or the question / option / student /
//          administrator not deleted) and the user is left to
//          guess and hold again
// SUGGESTED FIX: in cancel(), complete the press (onComplete +
//          the success toast) when the duration has passed
// -----------------------------------------------------------

describe("KB-37 — a hold released right at the full duration does nothing", () => {

  // "Užbaigti testą" (1.5 s) held exactly 1500 ms on a fake
  // clock. Animation frames run every 16 ms from the clock's
  // start, so the last one ran at 1488 ms (not complete yet)
  // and the next is due at 1504 ms — the release lands between
  // them. setTimeout shares the clock, so a fix that completes
  // on a timer is caught too
  const holdExactlyTheDuration = () => {
    const onFinish = vi.fn();
    renderPage(
      <StudentSidebar currentQuestionIndex={0} setCurrentQuestionIndex={vi.fn()} questionsData={fx.dealtTest(2)} onFinish={onFinish} />,
      { toaster: true }
    );
    const finishButton = screen.getByRole("button", { name: "Užbaigti testą" });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    longPress(finishButton, 1500);
    return onFinish;
  };


  it("reproduces: the test is not finished and no hint is shown", () => {
    const onFinish = holdExactlyTheDuration();

    expect(onFinish).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);
  });


  it.fails("a hold of the full duration finishes the test", () => {
    const onFinish = holdExactlyTheDuration();

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// KB-38 — the test-size warning says "klausimai" whatever the
//         number
// -----------------------------------------------------------
//
// WHERE:   Questions.jsx — TestSizeWarning: "bet įjungti tik
//          {enabledCount ?? 0} klausimai" for every count
// TRIGGER: fewer questions enabled than the test size (9, 12,
//          15, 21 or 30) with a count Lithuanian does not pair
//          with "klausimai": 0 and 10–20 take "klausimų", 1 and
//          21 "klausimas" — about half of the counts the banner
//          can show
// IMPACT:  broken Lithuanian in a warning the admin is meant to
//          act on: "įjungti tik 1 klausimai", "įjungti tik 0
//          klausimai", "įjungti tik 15 klausimai"
// SUGGESTED FIX: choose the words by the count's plural form —
//          …1 (not …11): "įjungtas … klausimas"; …2–…9 (not
//          …12–…19): "įjungti … klausimai"; otherwise "įjungta
//          … klausimų"
// -----------------------------------------------------------

describe("KB-38 — the test-size warning says 'klausimai' whatever the number", () => {

  // The banner's text for a bank of one question — switched on
  // (1 enabled) or off (0 enabled) — and a test size of 12
  const bannerFor = async (enabled) => {
    backend.on("GET", "/api/admin/questions", reply.json(
      fx.questionBank([fx.adminQuestion({ questionid: 21, isenabled: enabled })], { phishingtestsize: 12 })
    ));
    const { unmount } = renderPage(<Questions />, { path: "/admin/questions" });
    const text = (await screen.findByText("Įjungtų klausimų per mažai:")).parentElement.textContent;
    unmount();
    return text;
  };


  it("reproduces: 'įjungti tik 1 klausimai' and 'įjungti tik 0 klausimai'", async () => {
    expect(await bannerFor(1)).toContain("įjungti tik 1 klausimai");
    expect(await bannerFor(0)).toContain("įjungti tik 0 klausimai");
  });


  it.fails("neither one nor no enabled question is called 'klausimai'", async () => {
    expect(await bannerFor(1)).not.toMatch(/(^|\D)1 klausimai/);
    expect(await bannerFor(0)).not.toMatch(/(^|\D)0 klausimai/);
  });
});







// -----------------------------------------------------------
// KB-39 — after the column picker closed itself, "STULPELIAI"
//         needs two clicks to open it again
// -----------------------------------------------------------
//
// WHERE:   ColumnsButton.jsx — ColumnsButton: its own
//          `panelOpen` state (useState) decides whether a click
//          hides or shows the grid's column picker
// TRIGGER: the grid closes the picker itself, not the button —
//          a click anywhere outside it (the panel's click-away)
//          or Escape inside it — on the students list, and on
//          the administrators list (the same button)
// IMPACT:  `panelOpen` still says "open": the next click on
//          "STULPELIAI" only hides the picker that is already
//          hidden, so nothing happens and the admin has to click
//          again — every time the picker was closed that way
// SUGGESTED FIX: build the button on the grid's own
//          ColumnsPanelTrigger (render={<Button …/>}): it reads
//          the picker's state from the grid
//          (gridPreferencePanelStateSelector) and, while the
//          picker is open, stops the click's pointerup so the
//          panel's click-away does not close it first. Reading
//          the grid's state alone is not enough: a click on the
//          open picker's button would close it (click-away) and
//          open it again (the click)
// -----------------------------------------------------------

describe("KB-39 — after the column picker closed itself, 'STULPELIAI' needs two clicks to open it again", () => {

  // A column of the picker — on screen while the picker is open
  const pickerColumn = () => screen.queryByRole("checkbox", { name: "Prisijungimo Vardas" });

  const columnsButton = () => screen.getByRole("button", { name: "STULPELIAI" });

  // The students list (the picker needs no students) with the
  // picker opened by "STULPELIAI" and then closed by the grid
  // itself — `closeIt` does that: the grid's panel closes on a
  // pointerup outside it (a click-away armed one tick after it
  // opened) and on Escape inside it. Resolves with the
  // user-event instance
  const pickerClosedByTheGrid = async (closeIt) => {
    backend.on("GET", "/api/admin/students", reply.json([]));
    const { user } = renderPage(<StudentsListTable />, { path: "/admin/students" });
    await screen.findByText("(0)");

    await user.click(columnsButton());
    await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" });

    await closeIt(user);
    await waitFor(() => expect(pickerColumn()).toBeNull());
    return user;
  };

  // A click on the list's heading — outside the picker
  const clickElsewhere = (user) => user.click(screen.getByRole("heading", { name: "Studentų Sąrašas" }));

  // Escape pressed on one of the picker's own checkboxes
  const pressEscapeInIt = () => {
    fireEvent.keyDown(pickerColumn(), { key: "Escape" });
  };


  it("reproduces: after a click elsewhere, one click on 'STULPELIAI' does nothing — only a second opens the picker", async () => {
    const user = await pickerClosedByTheGrid(clickElsewhere);

    await user.click(columnsButton());
    await settle();
    expect(pickerColumn()).toBeNull();

    await user.click(columnsButton());
    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });


  it.fails("after a click elsewhere closed the picker, one click on 'STULPELIAI' opens it again", async () => {
    const user = await pickerClosedByTheGrid(clickElsewhere);

    await user.click(columnsButton());

    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });


  it("reproduces: after Escape, one click on 'STULPELIAI' does nothing — only a second opens the picker", async () => {
    const user = await pickerClosedByTheGrid(pressEscapeInIt);

    await user.click(columnsButton());
    await settle();
    expect(pickerColumn()).toBeNull();

    await user.click(columnsButton());
    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });


  it.fails("after Escape closed the picker, one click on 'STULPELIAI' opens it again", async () => {
    const user = await pickerClosedByTheGrid(pressEscapeInIt);

    await user.click(columnsButton());

    expect(await screen.findByRole("checkbox", { name: "Prisijungimo Vardas" })).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// KB-40 — a second hold while the delete is on its way deletes
//         again — and a failure is reported after the success
// -----------------------------------------------------------
//
// WHERE:   StudentInformation.jsx — handleDeleteStudent: no
//          in-flight guard, and the "Ištrinti Studentą" button
//          stays enabled, with no sign of the running POST,
//          until the reply arrives
// TRIGGER: the admin holds "Ištrinti Studentą" again — the
//          ring filled, then nothing seemed to happen — before
//          the first POST /api/admin/students/<id>/delete has
//          answered (a slow backend)
// IMPACT:  a second delete of the same student goes out. The
//          first answers OK — "Studentas ištrintas", back to
//          the list — and the second finds the student gone
//          (404): "Nepavyko ištrinti studento" appears right
//          after, on the students list, and the admin cannot
//          tell whether the student was deleted
// SUGGESTED FIX: keep the running delete in a ref and ignore
//          further holds until it has answered (or disable the
//          button meanwhile)
// -----------------------------------------------------------

describe("KB-40 — a second hold while the delete is on its way deletes again", () => {

  const DELETE = "/api/admin/students/5/delete";

  // Student 5's page, with a <Toaster/> that outlives it (in the
  // app the students list's layout brings the next one). The
  // delete is held twice while the first POST is on its way;
  // then the first answers OK and a second one — if any was
  // sent — 404, the student being gone by then.
  // react-hot-toast 2.6.0 drops the FIRST "default" listener
  // when a Toaster unmounts, not its own: the page's Toaster is
  // that one only because it registers first (its effects run
  // before those of renderPage's later sibling Toaster) — so the
  // outer Toaster still hears the toasts raised after the page
  // left
  const deleteTwiceWhileTheFirstIsOnItsWay = async () => {
    const firstDelete = deferred();
    const secondDelete = deferred();
    backend.on("GET", "/api/admin/students/5", reply.json(fx.studentDetail({ id: 5 })));
    backend.on("GET", "/api/admin/students/5/answers", reply.json([]));
    backend.once("POST", DELETE, () => firstDelete.promise);
    backend.once("POST", DELETE, () => secondDelete.promise);

    const { location } = renderPage(<StudentInformation />, {
      path: "/admin/students/:studentID",
      url: "/admin/students/5",
      toaster: true,
    });
    await screen.findByRole("heading", { level: 1, name: "JONAS_JONAITIS" });

    // Looked up once: while held, the label drops out of the
    // button's name (and a fix may change it while deleting)
    const deleteButton = screen.getByRole("button", { name: "Ištrinti Studentą" });
    longPress(deleteButton, 1600);
    await waitFor(() => expect(backend.requests("POST", DELETE)).toHaveLength(1));

    longPress(deleteButton, 1600);
    await settle();

    await act(async () => firstDelete.resolve(reply.json({ status: "ok" })));
    await waitFor(() => expect(location().pathname).toBe("/admin/students"));
    await act(async () => secondDelete.resolve(reply.text("Error: Student not found", 404)));
    await settle();
  };


  it("reproduces: two delete POSTs — 'Nepavyko ištrinti studento' shows next to 'Studentas ištrintas'", async () => {
    await deleteTwiceWhileTheFirstIsOnItsWay();

    expect(backend.requests("POST", DELETE)).toHaveLength(2);
    await findToast("Nepavyko ištrinti studento");
    expect(toastTexts()).toContain("Studentas ištrintas");
  });


  // Fix-agnostic: a guard, a disabled button or an ignored hold
  // all send the one delete and report only its success
  it.fails("a second hold while the delete is on its way sends nothing — only the success is reported", async () => {
    await deleteTwiceWhileTheFirstIsOnItsWay();

    expect(backend.requests("POST", DELETE)).toHaveLength(1);
    expect(toastTexts()).toContain("Studentas ištrintas");
    expect(toastTexts()).not.toContain("Nepavyko ištrinti studento");
  });
});







// -----------------------------------------------------------
// KB-41 — a failed administrators load is shown as an empty
//         list — "(0)"
// -----------------------------------------------------------
//
// WHERE:   AdministratorsList.jsx — AdministratorsList takes
//          `data`, `loadingData` and `refetch` from useFetchData
//          but never the `error` it returns: after a failed GET
//          `data` is still the hook's initial [], so the heading
//          prints "({data.length})" over the grid's `rows={data}`
// TRIGGER: GET /api/admin/administrators fails (500, 502 during
//          a deploy, no connection)
// IMPACT:  "Administratorių Sąrašas (0)" over an empty grid —
//          the admin is told there are no administrators at all
//          (not even themselves) when the list merely failed to
//          load; no message, no retry, and "Įterpti Naują"
//          invites re-creating accounts that exist
// SUGGESTED FIX: take `error` from useFetchData and, while no
//          list has arrived, show a message with a retry
//          (refetch) instead of the count and the empty grid
// -----------------------------------------------------------

describe("KB-41 — a failed administrators load is shown as an empty list", () => {

  // Waits for the request, not for the grid — a fix may show its
  // message instead of the list
  const renderFailedList = async () => {
    backend.on("GET", "/api/admin/administrators", reply.status(500, "Internal Server Error"));
    renderPage(<AdministratorsList />, { path: "/admin/administrators" });
    await waitFor(() => expect(backend.requests("GET", "/api/admin/administrators")).toHaveLength(1));
    await settle();
  };


  it("reproduces: the heading counts '(0)' administrators over an empty grid", async () => {
    await renderFailedList();

    expect(screen.getByText("(0)")).toBeInTheDocument();
    expect(document.querySelectorAll('[role="row"][data-id]')).toHaveLength(0);
  });


  it.fails("a failed load claims no '(0)' administrators and explains itself or offers a retry", async () => {
    await renderFailedList();

    expect(screen.queryByText("(0)")).toBeNull();
    await waitFor(() => {
      expect(screen.queryAllByText(EXPLAINS).length + screen.queryAllByRole("button", { name: EXPLAINS }).length).toBeGreaterThan(0);
    });
  });
});







// -----------------------------------------------------------
// KB-42 — a double click on "Įterpti" creates the
//         administrator twice
// -----------------------------------------------------------
//
// WHERE:   AddEditAdministrator.jsx — sendData and
//          handleSaveButton: nothing marks a save as running;
//          ActionButtons' "Įterpti" / "Išsaugoti" is disabled
//          only by the form rules (`disableSave`), so it stays
//          enabled while the POST is on its way
// TRIGGER: a double click on "Įterpti" — or a second click
//          because a slow server seems not to react — before
//          the first reply arrives
// IMPACT:  the same create is POSTed twice: the backend keeps
//          one and refuses (or fails) the other, so the admin
//          reads "Išsaugota" and a "Nepavyko: …" together — the
//          second after the dialog has closed. "Išsaugoti"
//          repeats an update the same way: "Išsaugota" twice and
//          the list reloaded twice
// SUGGESTED FIX: a saving flag — state for the buttons, or an
//          in-flight ref — set before the POST and cleared when
//          it settles: ignore clicks meanwhile and disable the
//          footer's buttons, as AddQuestion does for its upload
// -----------------------------------------------------------

describe("KB-42 — a double click on 'Įterpti' creates the administrator twice", () => {

  // Fills the create form and double-clicks "Įterpti" while the
  // create is held in flight; resolves with the creates sent.
  // One user-event call: its pointer-events check runs once, so
  // a fix that disables the button after the first click does
  // not trip it — the second click is then simply not delivered
  const createWithDoubleClick = async () => {
    const pending = deferred();
    backend.on("POST", "/api/admin/administrators", () => pending.promise);
    const { user } = renderPage(<AddEditAdministrator rowData={undefined} setOpen={vi.fn()} getData={vi.fn()} />, { toaster: true });

    await user.type(screen.getByLabelText(/El\. Paštas/), "naujas@knf.vu.lt");
    await user.type(screen.getByLabelText(/^Slaptažodis/), "ilgas-slaptazodis");
    await user.type(screen.getByLabelText(/^Pakartoti Slaptažodį/), "ilgas-slaptazodis");
    await user.dblClick(screen.getByRole("button", { name: "Įterpti" }));
    const requests = backend.requests("POST", "/api/admin/administrators").length;

    await act(async () => pending.resolve(reply.json({ type: "ok" })));
    await settle();
    return requests;
  };


  it("reproduces: a double click sends the create twice", async () => {
    expect(await createWithDoubleClick()).toBe(2);
  });


  it.fails("one create request however often 'Įterpti' is clicked while it runs", async () => {
    expect(await createWithDoubleClick()).toBe(1);
  });
});







// -----------------------------------------------------------
// KB-43 — searching what a pill or badge says finds nobody
// -----------------------------------------------------------
//
// WHERE:   AdministratorsList.jsx — ADMINISTRATOR_COLUMNS: the
//          "Įjungtas?" column draws its "Įjungtas" /
//          "Išjungtas" pill with renderCell only; the same in
//          StudentsListTable.jsx for "Baigta?" and its "BAIGTA"
//          badge. The grids' quick filter ("Ieškoti...")
//          matches each column's printed value, and with no
//          valueFormatter (or a quick-filter function of their
//          own) these columns print the raw 1 / 0
// TRIGGER: the admin searches for the word a pill or badge
//          shows — "Išjungtas" for the disabled accounts,
//          "BAIGTA" for the students who finished
// IMPACT:  nobody is listed although the page shows those
//          words, so the admin concludes there are no disabled
//          accounts / no finished students; the digits match
//          instead — "1" lists every enabled administrator
//          (and any row whose ID or time holds a 1)
// SUGGESTED FIX: give the columns a printed value, e.g.
//          valueFormatter: (value) => (value === 1 ?
//          "Įjungtas" : "Išjungtas"), and "BAIGTA" / "" for
//          "Baigta?" — renderCell keeps drawing the pill and the
//          badge, and the quick filter finds their words
// -----------------------------------------------------------

describe("KB-43 — searching what a pill or badge says finds nobody", () => {

  // The grid's data rows by id (sorted) — the header row carries
  // no data-id
  const rowIds = () =>
    [...document.querySelectorAll('[role="row"][data-id]')].map((row) => row.getAttribute("data-id")).sort();

  // What a row's cell in `field` shows
  const cellText = (id, field) =>
    document.querySelector(`[role="row"][data-id="${id}"] [role="gridcell"][data-field="${field}"]`).textContent;

  // `word` goes into "Ieškoti..." in one go — a single run of
  // the quick filter, 150 ms later; waits until the list has
  // shrunk below `before` rows, whatever it kept
  const search = async (word, before) => {
    fireEvent.change(screen.getByPlaceholderText("Ieškoti..."), { target: { value: word } });
    await waitFor(() => expect(rowIds().length).toBeLessThan(before));
  };

  // Two enabled administrators and a disabled one; searches for
  // the word the disabled one's pill shows and resolves with it
  const searchAdministratorsForTheDisabledPill = async () => {
    backend.on("GET", "/api/admin/administrators", reply.json([
      fx.administrator({ id: 1, email: "admin@knf.vu.lt", enabled: 1 }),
      fx.administrator({ id: 2, email: "jonas.jonaitis@knf.vu.lt", enabled: 1 }),
      fx.administrator({ id: 3, email: "ona.onaityte@knf.vu.lt", enabled: 0, lastseen: null }),
    ]));
    renderPage(<AdministratorsList />, { path: "/admin/administrators" });
    await screen.findByText("(3)", {}, { timeout: 3000 });
    await waitFor(() => expect(rowIds()).toEqual(["1", "2", "3"]));

    const word = cellText(3, "enabled");
    await search(word, 3);
    return word;
  };

  // A finished student and one still answering, both seen
  // minutes ago; searches for the word the finished one's badge
  // shows and resolves with it. The list's 5 s poll is held
  // still: a poll inside the search's debounce drops the search
  // (KB-44)
  const searchStudentsForTheFinishedBadge = async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    backend.on("GET", "/api/admin/students", reply.json([
      fx.studentDetail({ id: 1, username: "BAIGES_STUDENTAS", isfinished: 1, lastseen: fx.minutesAgo(5) }),
      fx.studentDetail({ id: 2, username: "DAR_SPRENDZIA", isfinished: 0, lastseen: fx.minutesAgo(5) }),
    ]));
    renderPage(<StudentsListTable />, { path: "/admin/students" });
    await screen.findByText("(2)", {}, { timeout: 3000 });
    await waitFor(() => expect(rowIds()).toEqual(["1", "2"]));

    const word = cellText(1, "isfinished");
    await search(word, 2);
    return word;
  };


  it("reproduces: 'Išjungtas' — what the disabled administrator's pill says — lists nobody", async () => {
    expect(await searchAdministratorsForTheDisabledPill()).toBe("Išjungtas");
    expect(rowIds()).toEqual([]);
  });


  // Fix-agnostic: the word is read off the pill, whatever a fix
  // prints there — a valueFormatter, a quick-filter function or
  // a valueGetter to text all list exactly the disabled one
  it.fails("the word on the disabled administrator's pill finds that administrator — and only that one", async () => {
    await searchAdministratorsForTheDisabledPill();

    expect(rowIds()).toEqual(["3"]);
  });


  it("reproduces: 'BAIGTA' — what the finished student's badge says — lists nobody", async () => {
    expect(await searchStudentsForTheFinishedBadge()).toBe("BAIGTA");
    expect(rowIds()).toEqual([]);
  });


  it.fails("the word on the finished student's badge finds that student — and only that one", async () => {
    await searchStudentsForTheFinishedBadge();

    expect(rowIds()).toEqual(["1"]);
  });
});







// -----------------------------------------------------------
// KB-44 — a search typed just before a poll reply is dropped
// -----------------------------------------------------------
//
// WHERE:   StudentsListTable.jsx — QuickSearchToolbar hands
//          <QuickFilter> new inline `parser` / `formatter`
//          functions on every render. The grid's QuickFilter
//          rebuilds its debounced search setter whenever
//          `parser` changes, and the rebuild cancels the call
//          the previous setter still had pending
// TRIGGER: the table re-renders within the 150 ms between the
//          last keystroke in "Ieškoti..." and the search being
//          applied — every 5 s poll reply re-renders it, so
//          roughly one search in thirty is hit
// IMPACT:  the search is dropped without a sign: the box shows
//          the typed text while the list stays unfiltered, and
//          nothing changes until the admin types again
// SUGGESTED FIX: hand QuickFilter stable functions — declare
//          the parser and the formatter once, at module level
//          (AdministratorsList.jsx has the same inline pair; it
//          does not poll, so it is rarely hit there)
// -----------------------------------------------------------

describe("KB-44 — a search typed just before a poll reply is dropped", () => {

  // The grid's data rows in screen order — the header row
  // carries no data-id
  const listedIds = () => [...document.querySelectorAll('[role="row"][data-id]')].map((row) => row.getAttribute("data-id"));

  const searchBox = () => screen.getByPlaceholderText("Ieškoti...");

  // The whole clock is fake — setTimeout (the search's 150 ms),
  // setInterval (the 5 s polls) and Date (pinned mid-month, clear
  // of KB-18) — so only the test moves time: fireEvent and act,
  // no user-event / waitFor / findBy. Three students, one of
  // them a JONAS. "jonas" goes into the box 100 ms before the
  // first poll (the search is due 50 ms after it); the poll and
  // its reply's re-render run in the next act — separate acts,
  // because an async act renders its queued updates only when
  // its callback is done — and the last act runs well past the
  // search's due time
  const searchJustBeforeAPoll = async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00+03:00"));
    backend.on("GET", "/api/admin/students", reply.json([
      fx.studentDetail({ id: 5, username: "JONAS_JONAITIS", registrationtime: fx.daysAgo(3), lastseen: fx.minutesAgo(5) }),
      fx.studentDetail({ id: 6, username: "PETRAS_PETRAITIS", registrationtime: fx.daysAgo(3), lastseen: fx.minutesAgo(5) }),
      fx.studentDetail({ id: 7, username: "ONA_ONAITĖ", registrationtime: fx.daysAgo(3), lastseen: fx.minutesAgo(5) }),
    ]));

    renderPage(<StudentsListTable />, { path: "/admin/students" });
    await act(() => vi.advanceTimersByTimeAsync(4900));

    fireEvent.change(searchBox(), { target: { value: "jonas" } });

    await act(() => vi.advanceTimersByTimeAsync(100));
    await act(() => vi.advanceTimersByTimeAsync(1000));
  };


  it("reproduces: the box reads 'jonas' while every student is still listed", async () => {
    await searchJustBeforeAPoll();

    expect(backend.requests("GET", "/api/admin/students")).toHaveLength(2);
    expect(searchBox()).toHaveValue("jonas");
    expect(listedIds()).toEqual(["5", "6", "7"]);
  });


  // Fix-agnostic: however the pending search survives the poll —
  // stable functions, memoization, a poll that does not re-render
  // an unchanged list — the list ends up filtered by what the box
  // shows
  it.fails("the search typed just before the poll is applied — only JONAS_JONAITIS is listed", async () => {
    await searchJustBeforeAPoll();

    expect(searchBox()).toHaveValue("jonas");
    expect(listedIds()).toEqual(["5"]);
  });
});
