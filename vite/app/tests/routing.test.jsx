// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — routing, route guards, theming
//
//  src/App.jsx + src/providers.jsx, driven through the real
//  <App/> (BrowserRouter + AuthProvider + Providers) with the
//  page modules replaced by tiny stubs — so these tests pin
//  ONLY where each kind of visitor ends up:
//
//    - "/"              → by role: admin /admin, student
//                         /student (finished: /student/finish),
//                         anonymous /login
//    - /admin/*         → admins only (students → /student,
//                         anonymous → /login)
//    - /student(/finish)→ students only (admins → /admin,
//                         anonymous → /login); a finished
//                         student's /student → /student/finish
//    - /login, /leaderboard, /slides → public
//    - guards render NOTHING while the session check runs (no
//      premature bounce to /login)
//    - route params reach the pages; authData is passed on
//    - the MUI theme wraps every page except /login
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { renderApp, settle } from "./support/render";
import * as fx from "./support/fixtures";

import App from "@/App";


// Page stubs — plain text, naming the page and what it got
vi.mock("@/systemPages/PublicPages/Login/Login", async () => {
  const { useTheme } = await import("@mui/material/styles");
  return { default: function LoginStub() { return `LOGIN PAGE ${useTheme().palette.primary.main}`; } };
});
vi.mock("@/systemPages/PublicPages/Leaderboard/Leaderboard", () => ({
  default: () => "LEADERBOARD PAGE",
}));
vi.mock("@/systemPages/PublicPages/Slides/Slides", () => ({
  default: () => "SLIDES PAGE",
}));
vi.mock("@/systemPages/StudentPages/TestHome/TestHome", () => ({
  default: ({ authData }) => `TEST PAGE ${authData?.id}`,
}));
vi.mock("@/systemPages/StudentPages/TestFinish/TestFinish", () => ({
  default: ({ authData }) => `RESULTS PAGE ${authData?.id}`,
}));
vi.mock("@/systemPages/AdminPages/Home/Home", async () => {
  const { useTheme } = await import("@mui/material/styles");
  return { default: function HomeStub({ authData }) { return `ADMIN HOME ${authData?.id} ${useTheme().palette.primary.main}`; } };
});
vi.mock("@/systemPages/AdminPages/StudentsList/StudentsList", () => ({
  default: () => "STUDENTS PAGE",
}));
vi.mock("@/systemPages/AdminPages/StudentInformation/StudentInformation", async () => {
  const { useParams } = await import("react-router-dom");
  return { default: function StudentStub() { return `STUDENT PAGE ${useParams().studentID}`; } };
});
vi.mock("@/systemPages/AdminPages/Questions/Questions", () => ({
  default: () => "QUESTIONS PAGE",
}));
vi.mock("@/systemPages/AdminPages/Questions/QuestionsList/EditQuestion/EditQuestion", async () => {
  const { useParams } = await import("react-router-dom");
  return { default: function EditStub() { return `EDIT QUESTION PAGE ${useParams().questionID}`; } };
});
vi.mock("@/systemPages/AdminPages/AdministratorsList/AdministratorsList", () => ({
  default: () => "ADMINISTRATORS PAGE",
}));


const ADMIN = fx.adminAuth();
const STUDENT = fx.studentAuth();
const FINISHED_STUDENT = fx.studentAuth({ phishingtestfinished: 1 });

// The session check answers `auth` (undefined = anonymous)
const sessionIs = (auth) => {
  backend.on("GET", "/api/checkauth", auth === undefined ? reply.status(401, "Unauthorized") : reply.json(auth));
};

// Mount the app at `url` as `auth`; resolves with the page text
// once a page rendered
const visit = async (url, auth) => {
  sessionIs(auth);
  const result = renderApp(App, url);
  await waitFor(() => expect(document.body.textContent).toMatch(/PAGE|ADMIN HOME/));
  return result;
};

const pathname = () => window.location.pathname;







// -----------------------------------------------------------
// "/" — the role-based home
// -----------------------------------------------------------

describe("routing — '/' sends everyone to their home", () => {

  it("anonymous → /login", async () => {
    await visit("/", undefined);

    expect(pathname()).toBe("/login");
    expect(screen.getByText(/LOGIN PAGE/)).toBeInTheDocument();
  });


  it("admin → /admin", async () => {
    await visit("/", ADMIN);

    expect(pathname()).toBe("/admin");
    expect(screen.getByText(/ADMIN HOME admin@knf\.vu\.lt/)).toBeInTheDocument();
  });


  it("student with a running test → /student", async () => {
    await visit("/", STUDENT);

    expect(pathname()).toBe("/student");
    expect(screen.getByText("TEST PAGE JONAS_JONAITIS")).toBeInTheDocument();
  });


  it("student who finished → /student/finish", async () => {
    await visit("/", FINISHED_STUDENT);

    expect(pathname()).toBe("/student/finish");
    expect(screen.getByText("RESULTS PAGE JONAS_JONAITIS")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Admin pages
// -----------------------------------------------------------

describe("routing — admin pages are for admins only", () => {

  const ADMIN_PAGES = [
    ["/admin", /ADMIN HOME/],
    ["/admin/students", /STUDENTS PAGE/],
    ["/admin/students/7", /STUDENT PAGE 7/],
    ["/admin/questions", /QUESTIONS PAGE/],
    ["/admin/questions/5", /EDIT QUESTION PAGE 5/],
    ["/admin/administrators", /ADMINISTRATORS PAGE/],
  ];


  it.each(ADMIN_PAGES)("%s opens for an admin", async (url, page) => {
    await visit(url, ADMIN);

    expect(pathname()).toBe(url);
    expect(screen.getByText(page)).toBeInTheDocument();
  });


  it.each(ADMIN_PAGES)("%s sends an anonymous visitor to /login", async (url) => {
    await visit(url, undefined);

    expect(pathname()).toBe("/login");
  });


  it.each(ADMIN_PAGES)("%s sends a student to the test", async (url) => {
    await visit(url, STUDENT);

    expect(pathname()).toBe("/student");
    expect(screen.getByText("TEST PAGE JONAS_JONAITIS")).toBeInTheDocument();
  });


  it("sends a finished student on to the results", async () => {
    await visit("/admin/students", FINISHED_STUDENT);

    expect(pathname()).toBe("/student/finish");
  });
});







// -----------------------------------------------------------
// Student pages
// -----------------------------------------------------------

describe("routing — student pages are for students only", () => {

  it("/student opens the test for a student with a running test", async () => {
    await visit("/student", STUDENT);

    expect(pathname()).toBe("/student");
    expect(screen.getByText("TEST PAGE JONAS_JONAITIS")).toBeInTheDocument();
  });


  it("/student sends a finished student to the results", async () => {
    await visit("/student", FINISHED_STUDENT);

    expect(pathname()).toBe("/student/finish");
    expect(screen.getByText("RESULTS PAGE JONAS_JONAITIS")).toBeInTheDocument();
  });


  it("/student/finish opens for a student whose test is still running", async () => {
    // The results page is what ends the test (it calls
    // /api/student/finish), so it must be reachable
    await visit("/student/finish", STUDENT);

    expect(pathname()).toBe("/student/finish");
    expect(screen.getByText("RESULTS PAGE JONAS_JONAITIS")).toBeInTheDocument();
  });


  it.each(["/student", "/student/finish"])("%s sends an admin to /admin", async (url) => {
    await visit(url, ADMIN);

    expect(pathname()).toBe("/admin");
  });


  it.each(["/student", "/student/finish"])("%s sends an anonymous visitor to /login", async (url) => {
    await visit(url, undefined);

    expect(pathname()).toBe("/login");
  });
});







// -----------------------------------------------------------
// Public pages
// -----------------------------------------------------------

describe("routing — public pages", () => {

  it.each([
    ["/leaderboard", "LEADERBOARD PAGE"],
    ["/slides", "SLIDES PAGE"],
  ])("%s opens without a session", async (url, page) => {
    await visit(url, undefined);

    expect(pathname()).toBe(url);
    expect(screen.getByText(page)).toBeInTheDocument();
  });


  it("/login stays /login for a logged-in admin (opening it logs out)", async () => {
    await visit("/login", ADMIN);

    expect(pathname()).toBe("/login");
    expect(screen.getByText(/LOGIN PAGE/)).toBeInTheDocument();
  });


  it("public pages do not wait for the session check", async () => {
    const check = deferred();
    backend.on("GET", "/api/checkauth", () => check.promise);
    renderApp(App, "/leaderboard");

    expect(await screen.findByText("LEADERBOARD PAGE")).toBeInTheDocument();

    // The (anonymous) answer arriving later changes nothing
    await act(async () => check.resolve(reply.status(401, "Unauthorized")));
    expect(pathname()).toBe("/leaderboard");
    expect(screen.getByText("LEADERBOARD PAGE")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// While the session check runs
// -----------------------------------------------------------

describe("routing — while the session check runs", () => {

  it.each(["/", "/admin/students", "/student", "/student/finish"])(
    "%s renders nothing and stays put until the check answers",
    async (url) => {
      const check = deferred();
      backend.on("GET", "/api/checkauth", () => check.promise);
      renderApp(App, url);
      await settle();

      expect(document.body.textContent).toBe("");
      expect(pathname()).toBe(url);

      await act(async () => check.resolve(reply.json(ADMIN)));
      await waitFor(() => expect(document.body.textContent).not.toBe(""));
    }
  );


  it("checks the session only once across client-side redirects", async () => {
    await visit("/", STUDENT);
    await settle();

    expect(backend.requests("GET", "/api/checkauth")).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// Theming (providers.jsx)
// -----------------------------------------------------------

describe("routing — the MUI theme", () => {

  it("wraps the admin pages in the burgundy app theme", async () => {
    await visit("/admin", ADMIN);

    expect(screen.getByText(/ADMIN HOME/).textContent).toContain("#7B003F");
  });


  it("is left out on /login, which styles itself", async () => {
    await visit("/login", undefined);

    // MUI's stock primary color — no app ThemeProvider around it
    expect(screen.getByText(/LOGIN PAGE/).textContent).toContain("#1976d2");
  });
});
