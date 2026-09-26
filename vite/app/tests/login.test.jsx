// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the login page
//
//  src/systemPages/PublicPages/Login/Login.jsx, rendered the
//  way App renders /login — without the MUI theme — and with
//  the particles background mocked (jsdom has no canvas):
//
//    - opening the page logs out: exactly one bare POST
//      /api/logout (axios, no body, no config); a failed
//      logout is silent. A copy the browser restores from its
//      back-forward cache is reloaded (the fresh load logs
//      out) and cannot log in again meanwhile
//    - registration, the default form. Step 1: REGISTRUOTIS /
//      Enter → POST /api/student/register {username: <the raw
//      typed text>}; refusals — HTTP 200 {status: "error",
//      error}, or an HTTP 400 carrying that body — are shown
//      verbatim, any other failure as "Nepavyko susisiekti su
//      serveriu. …". Step 2: the NORMALIZED name and the
//      access code from the reply as chips; PRADĖTI TESTĄ /
//      Enter → POST /api/login {username, password}
//    - the sign-in form ("Jau turiu paskyrą"), for admins and
//      students alike: POST /api/login {username, password};
//      "OK" → full page load of "/", any other 200 body is the
//      message to show, a failed request → "Nepavyko …"
//    - one request at a time: while a registration / login
//      runs, its button (REGISTRUOTIS, PRISIJUNGTI or step
//      2's PRADĖTI TESTĄ) is a disabled PALAUKITE with
//      bouncing dots, and a second click or Enter sends
//      nothing; after a login's "OK" the button stays on
//      PALAUKITE while "/" loads
//    - Enter acts on the visible form only, and never on a
//      focused button — that is the button's own click (the
//      link-buttons switch forms); on registration the
//      keydown is cancelled (no implicit form submit)
//    - a refusal stays with its form: registration's first
//      step never shows a login refusal, the sign-in form
//      never a registration refusal; the ONE login message
//      Login shares between step 2 and the sign-in form is
//      dropped when the forms switch and when a registration
//      succeeds
//
//  Both forms stay mounted and the hidden one only carries
//  the "hidden" class — Tailwind is not loaded here, so
//  visibility is asserted on the wrapper classes and queries
//  are scoped to one form.
//
//  Every scripted success answer is on the API contract
//  (tests/contract/api.js): logout and login answer plain
//  text, registration one of its two JSON shapes (the local
//  registration() / registrationRefused() builders).
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";

import { backend, deferred, reply } from "./support/backend";
import { consoleErrors } from "./support/setup";
import { hardNavigations, reloadCount } from "./support/navigation";
import { renderPage, settle } from "./support/render";

import Login from "@/systemPages/PublicPages/Login/Login";


// The page's canvas background — jsdom has no canvas
vi.mock("@/systemPages/PublicPages/Login/components/Particles/Particles", () => ({
  default: () => null,
}));


const LOGOUT = "/api/logout";
const REGISTER = "/api/student/register";
const LOGIN = "/api/login";

// What the page says for any failure the backend gave no
// message for
const NO_CONNECTION = "Nepavyko susisiekti su serveriu. Bandykite dar kartą.";


// The two answer shapes of POST /api/student/register in
// tests/contract/api.js (fixtures.js has no builder for them):
// a registration — the name as the backend normalized it + the
// one-time 8-digit access code — or a refusal with a
// display-ready message (also the body of its HTTP 400)
const registration = (overrides = {}) => ({
  status: "OK",
  username: "JONAS_JONAITIS",
  accessCode: "48291037",
  ...overrides,
});

const registrationRefused = (error) => ({ status: "error", error });


// The login page mounts with its logout POST answered
const renderLogin = () => {
  backend.on("POST", LOGOUT, reply.text("OK"));
  return renderPage(<Login />, { path: "/login", theme: false });
};


// The two form cards, in page order — both always mounted;
// the wrapper <div> around each carries "block" or "hidden"
const registerForm = () => document.querySelectorAll("form")[0];
const signInForm = () => document.querySelectorAll("form")[1];

// ErrorBox has no role or label; it is the page's only red box
const errorBox = (form) => form.querySelector(".bg-red-50");

const buttonIn = (form, name) => within(form).getByRole("button", { name });

const nameField = () => screen.getByLabelText(/Prisijungimo Vardas/);
const signInNameField = () => screen.getByLabelText(/Vardas \/ El\. Paštas/);
const signInCodeField = () => screen.getByLabelText(/Kodas \/ Slaptažodis/);

// Step 2's credential chips: a label, the value right after it
const chipValue = (label) => within(registerForm()).getByText(label).nextElementSibling.textContent;


const openSignIn = (user) => user.click(screen.getByRole("button", { name: "Jau turiu paskyrą — prisijungti" }));

const backToRegistration = (user) => user.click(screen.getByRole("button", { name: "Neturiu paskyros — registruotis" }));


// Registration step 1 → step 2: types `name`, presses
// REGISTRUOTIS and waits for the credentials
const register = async (user, name = "jonas_jonaitis", registered = registration()) => {
  backend.once("POST", REGISTER, reply.json(registered));
  await user.type(nameField(), name);
  await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
  await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });
};


// Opens the sign-in form, fills what is given ("" leaves a
// field empty) and presses PRISIJUNGTI
const signIn = async (user, name, code) => {
  await openSignIn(user);
  if (name) {
    await user.type(signInNameField(), name);
  }
  if (code) {
    await user.type(signInCodeField(), code);
  }
  await user.click(buttonIn(signInForm(), "PRISIJUNGTI"));
};


// Enter with no field focused, as in registration step 2
// where the name field is gone. After a click on REGISTRUOTIS
// the focus stays on a button (jsdom does not move it off a
// button that gets disabled), so it is dropped explicitly —
// Enter on a focused button is that button's own click, not
// the page's Enter.
//
// settle() first: step 2 renders from the reply, outside
// act(), and React runs the useEffect that re-subscribes the
// document Enter listener one scheduler task AFTER that
// commit — an Enter sent as soon as PRADĖTI TESTĄ shows could
// still reach step 1's listener and register a second time
const pressEnterOnPage = async (user) => {
  await settle();
  act(() => document.activeElement.blur());
  expect(document.activeElement).toBe(document.body);
  await user.keyboard("{Enter}");
};


// The same Enter on the page, after a click on a button that
// has turned into the disabled PALAUKITE: jsdom keeps the
// focus there and will not blur a disabled element, so the
// keydown is sent to <body> directly
const pressEnterOnPageWhileWaiting = async () => {
  await settle();
  fireEvent.keyDown(document.body, { key: "Enter", code: "Enter" });
};







// -----------------------------------------------------------
// Opening the page logs out
// -----------------------------------------------------------

describe("Login — opening the page logs out", () => {

  it("sends exactly one POST /api/logout — no body, no axios config", async () => {
    const post = vi.spyOn(axios, "post");
    renderLogin();
    await settle();

    expect(post.mock.calls).toEqual([[LOGOUT]]);

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "POST", url: LOGOUT });
    expect(requests[0].body).toBeUndefined();
    expect(requests[0].json).toBeUndefined();
    expect(requests[0].withCredentials).toBeUndefined();
  });


  it("does not log out again when the forms switch", async () => {
    const { user } = renderLogin();

    await openSignIn(user);
    await backToRegistration(user);
    await settle();

    expect(backend.requests()).toHaveLength(1);
    expect(backend.requests("POST", LOGOUT)).toHaveLength(1);
  });


  it.each([
    ["an HTTP 500", reply.status(500, "Internal Server Error")],
    ["no connection", reply.networkError()],
  ])("stays silent when the logout fails with %s", async (_, failure) => {
    backend.once("POST", LOGOUT, failure);
    renderLogin();
    await settle();

    expect(backend.requests("POST", LOGOUT)).toHaveLength(1);
    expect(errorBox(registerForm())).toBeNull();
    expect(errorBox(signInForm())).toBeNull();
    expect(buttonIn(registerForm(), "REGISTRUOTIS")).toBeEnabled();
    expect(hardNavigations()).toEqual([]);
  });


  it("reloads a copy restored from the back-forward cache after a login — the copy cannot log in again meanwhile", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await signIn(user, "admin@knf.vu.lt", "slaptazodis");
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    // A page show that is no restore (a fresh load) changes
    // nothing
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
    });
    expect(reloadCount()).toBe(0);

    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    expect(reloadCount()).toBe(1);

    await user.type(signInCodeField(), "{Enter}");
    await settle();

    expect(buttonIn(signInForm(), "PALAUKITE")).toBeDisabled();
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(hardNavigations()).toEqual(["/"]);
  });
});







// -----------------------------------------------------------
// The first view
// -----------------------------------------------------------

describe("Login — the first view", () => {

  it("opens on the registration form, the sign-in form hidden", () => {
    renderLogin();

    expect(registerForm().parentElement).toHaveClass("block");
    expect(registerForm().parentElement).not.toHaveClass("hidden");
    expect(signInForm().parentElement).toHaveClass("hidden");
    expect(signInForm().parentElement).not.toHaveClass("block");
  });


  it("asks for a 'Prisijungimo Vardas' in an empty, required text field", () => {
    renderLogin();

    const field = nameField();
    expect(registerForm()).toContainElement(field);
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveValue("");
    expect(field).toBeRequired();
  });


  it("offers REGISTRUOTIS and the switch to the sign-in form, with no error box", () => {
    renderLogin();

    expect(buttonIn(registerForm(), "REGISTRUOTIS")).toBeEnabled();
    expect(buttonIn(registerForm(), "Jau turiu paskyrą — prisijungti")).toBeEnabled();
    expect(errorBox(registerForm())).toBeNull();
    expect(errorBox(signInForm())).toBeNull();
  });


  it("shows no credentials before anything is registered", () => {
    renderLogin();

    expect(within(registerForm()).queryByText("Užsirašykite šiuos duomenis")).toBeNull();
    expect(within(registerForm()).queryByText("Vardas")).toBeNull();
    expect(within(registerForm()).queryByText("Kodas")).toBeNull();
    expect(screen.queryByRole("button", { name: "PRADĖTI TESTĄ" })).toBeNull();
  });


  it("shows the VU KnF logo and the app title on both cards, and the copyright line", () => {
    renderLogin();

    const logos = screen.getAllByAltText("VU KnF logotipas");
    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      expect(logo).toHaveAttribute("src", "/img/vuknflogo.png");
    }
    expect(screen.getAllByText("Fišingo atakų atpažinimo testas")).toHaveLength(2);
    expect(screen.getByText("Copyright © | All Rights Reserved | VUKnF")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Registration, step 1 — the request
// -----------------------------------------------------------
//
// The backend normalizes the name (uppercase, only A–Z,
// Lithuanian letters, 0–9 and _ kept); the page sends it
// untouched.
// -----------------------------------------------------------

describe("Login — registration, step 1: the request", () => {

  it("REGISTRUOTIS posts the name exactly as typed to /api/student/register", async () => {
    backend.on("POST", REGISTER, reply.json(registration({ username: "JONASJONAITIS" })));
    const { user } = renderLogin();

    await user.type(nameField(), "  Jonas Jonaitis! ");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    const requests = backend.requests("POST", REGISTER);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: REGISTER });
    expect(requests[0].json).toEqual({ username: "  Jonas Jonaitis! " });
    expect(requests[0].headers["content-type"]).toBe("application/json");
    expect(requests[0].withCredentials).toBeUndefined();
  });


  it("sends an empty name as is — refusing it is the backend's job", async () => {
    backend.on("POST", REGISTER, reply.json(registrationRefused("Įveskite prisijungimo vardą")));
    const { user } = renderLogin();

    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Įveskite prisijungimo vardą");

    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: "" });
  });


  it("sends a name typed before a look at the sign-in form", async () => {
    backend.on("POST", REGISTER, reply.json(registration()));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas_jonaitis");
    await openSignIn(user);
    await backToRegistration(user);
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: "jonas_jonaitis" });
  });
});







// -----------------------------------------------------------
// Registration, step 2 — the credentials
// -----------------------------------------------------------

describe("Login — registration, step 2: the credentials", () => {

  it("shows the name as the backend normalized it and the access code as chips", async () => {
    const { user } = renderLogin();

    await register(user, "  Jonas Jonaitis! ", registration({ username: "JONASJONAITIS", accessCode: "48291037" }));

    expect(chipValue("Vardas")).toBe("JONASJONAITIS");
    expect(chipValue("Kodas")).toBe("48291037");
    expect(within(registerForm()).queryByText(/Jonas Jonaitis/)).toBeNull();
  });


  it("warns to write the credentials down", async () => {
    const { user } = renderLogin();

    await register(user);

    expect(within(registerForm()).getByText("Užsirašykite šiuos duomenis")).toBeInTheDocument();
  });


  it("replaces step 1: no name field, no REGISTRUOTIS, no way to the sign-in form", async () => {
    const { user } = renderLogin();

    await register(user);

    expect(screen.queryByLabelText(/Prisijungimo Vardas/)).toBeNull();
    expect(within(registerForm()).queryByRole("button", { name: "REGISTRUOTIS" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Jau turiu paskyrą — prisijungti" })).toBeNull();
    expect(buttonIn(registerForm(), "PRADĖTI TESTĄ")).toBeEnabled();
  });


  it("shows no error box after a clean registration", async () => {
    const { user } = renderLogin();

    await register(user);

    expect(errorBox(registerForm())).toBeNull();
  });


  it("keeps Lithuanian letters of the normalized name", async () => {
    const { user } = renderLogin();

    await register(user, "Vardenė_Pavardenė", registration({ username: "VARDENĖ_PAVARDENĖ" }));

    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: "Vardenė_Pavardenė" });
    expect(chipValue("Vardas")).toBe("VARDENĖ_PAVARDENĖ");
  });


  it("shows an access code with a leading zero unchanged", async () => {
    const { user } = renderLogin();

    await register(user, "jonas", registration({ username: "JONAS", accessCode: "04821937" }));

    expect(chipValue("Kodas")).toBe("04821937");
  });


  it("waits for PRADĖTI TESTĄ — registering alone neither logs in nor leaves the page", async () => {
    const { user } = renderLogin();

    await register(user);
    await settle();

    // /api/login is not routed: a login here would also fail
    // the test as an unanswered request
    expect(backend.requests("POST", LOGIN)).toHaveLength(0);
    expect(hardNavigations()).toEqual([]);
  });
});







// -----------------------------------------------------------
// Registration refused or unreachable
// -----------------------------------------------------------

describe("Login — registration refused or unreachable", () => {

  it.each([
    ["the name is already taken", "jonas", reply.json(registrationRefused("Vartotojas tokiu vardu jau registruotas")), "Vartotojas tokiu vardu jau registruotas"],
    ["nothing is left of the name after normalization", "!!!", reply.json(registrationRefused("Įveskite prisijungimo vardą")), "Įveskite prisijungimo vardą"],
    ["the backend answers HTTP 400 with a message", "jonas", reply.json(registrationRefused("Neteisinga užklausa"), 400), "Neteisinga užklausa"],
  ])("shows the backend's message verbatim when %s", async (_, name, refusal, message) => {
    backend.on("POST", REGISTER, refusal);
    const { user } = renderLogin();

    await user.type(nameField(), name);
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText(message);

    expect(errorBox(registerForm()).textContent).toBe(message);
  });


  it("shows the too-long refusal for a pasted 256-character name", async () => {
    const tooLong = "J".repeat(256);
    backend.on("POST", REGISTER, reply.json(registrationRefused("Prisijungimo vardas per ilgas (daugiausia 255 simboliai)")));
    const { user } = renderLogin();

    await user.click(nameField());
    await user.paste(tooLong);
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Prisijungimo vardas per ilgas (daugiausia 255 simboliai)");

    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: tooLong });
    expect(errorBox(registerForm()).textContent).toBe("Prisijungimo vardas per ilgas (daugiausia 255 simboliai)");
  });


  it.each([
    ["an HTTP 500 with an HTML error page", reply.status(500, "<h1>Server Error (500)</h1>")],
    ["an HTTP 502 from the proxy with no body", reply.status(502)],
    ["an HTTP 400 without a JSON message", reply.status(400, "Bad Request")],
    ["no connection", reply.networkError()],
  ])("says the server could not be reached on %s", async (_, failure) => {
    backend.on("POST", REGISTER, failure);
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText(NO_CONNECTION);

    expect(errorBox(registerForm()).textContent).toBe(NO_CONNECTION);
  });


  it("keeps step 1 and the typed name after a refusal", async () => {
    backend.on("POST", REGISTER, reply.json(registrationRefused("Vartotojas tokiu vardu jau registruotas")));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Vartotojas tokiu vardu jau registruotas");

    expect(nameField()).toHaveValue("jonas");
    expect(buttonIn(registerForm(), "REGISTRUOTIS")).toBeEnabled();
    expect(buttonIn(registerForm(), "Jau turiu paskyrą — prisijungti")).toBeEnabled();
    expect(within(registerForm()).queryByText("Užsirašykite šiuos duomenis")).toBeNull();
  });


  it("replaces the message with the next refusal's", async () => {
    backend.once("POST", REGISTER, reply.json(registrationRefused("Vartotojas tokiu vardu jau registruotas")));
    backend.once("POST", REGISTER, reply.json(registrationRefused("Įveskite prisijungimo vardą")));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Vartotojas tokiu vardu jau registruotas");

    await user.clear(nameField());
    await user.type(nameField(), "!!!");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Įveskite prisijungimo vardą");

    expect(errorBox(registerForm()).textContent).toBe("Įveskite prisijungimo vardą");
    expect(backend.requests("POST", REGISTER).map((request) => request.json)).toEqual([
      { username: "jonas" },
      { username: "!!!" },
    ]);
  });


  it("moves on to step 2 when a retry succeeds, leaving the refusal behind", async () => {
    backend.once("POST", REGISTER, reply.json(registrationRefused("Vartotojas tokiu vardu jau registruotas")));
    backend.once("POST", REGISTER, reply.json(registration({ username: "JONAS2" })));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Vartotojas tokiu vardu jau registruotas");

    await user.clear(nameField());
    await user.type(nameField(), "jonas2");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: "jonas2" });
    expect(chipValue("Vardas")).toBe("JONAS2");
    expect(errorBox(registerForm())).toBeNull();
  });
});







// -----------------------------------------------------------
// Registration while the request runs
// -----------------------------------------------------------

describe("Login — registration while the request runs", () => {

  it("turns REGISTRUOTIS into a disabled PALAUKITE with three bouncing dots", async () => {
    const pending = deferred();
    backend.on("POST", REGISTER, () => pending.promise);
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));

    const waiting = buttonIn(registerForm(), "PALAUKITE");
    expect(waiting).toBeDisabled();
    expect(waiting.querySelectorAll(".animate-bounce-dot")).toHaveLength(3);
    expect(within(registerForm()).queryByRole("button", { name: "REGISTRUOTIS" })).toBeNull();

    await act(async () => pending.resolve(reply.json(registration())));
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });
  });


  it.each([
    ["a refusal", reply.json(registrationRefused("Vartotojas tokiu vardu jau registruotas")), "Vartotojas tokiu vardu jau registruotas"],
    ["a network failure", reply.networkError(), NO_CONNECTION],
  ])("comes back as REGISTRUOTIS after %s", async (_, answer, message) => {
    const pending = deferred();
    backend.on("POST", REGISTER, () => pending.promise);
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await act(async () => pending.resolve(answer));

    expect(await within(registerForm()).findByRole("button", { name: "REGISTRUOTIS" })).toBeEnabled();
    expect(within(registerForm()).queryByRole("button", { name: "PALAUKITE" })).toBeNull();
    expect(errorBox(registerForm()).textContent).toBe(message);
  });


  it("registers once on a double-click", async () => {
    const pending = deferred();
    backend.on("POST", REGISTER, () => pending.promise);
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.dblClick(buttonIn(registerForm(), "REGISTRUOTIS"));

    expect(backend.requests("POST", REGISTER)).toHaveLength(1);

    await act(async () => pending.resolve(reply.json(registration())));
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });
    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
  });


  it("registers once however often Enter is pressed", async () => {
    const pending = deferred();
    backend.on("POST", REGISTER, () => pending.promise);
    const { user } = renderLogin();

    await user.type(nameField(), "jonas{Enter}");
    await user.keyboard("{Enter}{Enter}");

    expect(backend.requests("POST", REGISTER)).toHaveLength(1);

    await act(async () => pending.resolve(reply.json(registration())));
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });
    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
  });


  it("drops a reply that arrives after the page is gone", async () => {
    const pending = deferred();
    backend.on("POST", REGISTER, () => pending.promise);
    const { user, unmount } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    unmount();

    await act(async () => pending.resolve(reply.json(registration())));
    await settle();

    expect(consoleErrors()).toEqual([]);
    expect(hardNavigations()).toEqual([]);
  });
});







// -----------------------------------------------------------
// Enter on the registration form
// -----------------------------------------------------------

describe("Login — Enter on the registration form", () => {

  it("registers the typed name once, without submitting the form", async () => {
    backend.on("POST", REGISTER, reply.json(registration()));
    const { user } = renderLogin();

    // Step 1 is a one-field form without a submit button: a
    // browser submits it implicitly (a full page reload) on an
    // Enter that is not cancelled
    const submitted = vi.fn();
    registerForm().addEventListener("submit", submitted);

    await user.type(nameField(), "jonas_jonaitis{Enter}");
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: "jonas_jonaitis" });
    expect(submitted).not.toHaveBeenCalled();
  });


  it("cancels the Enter keydown", async () => {
    backend.on("POST", REGISTER, reply.json(registration()));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas_jonaitis");
    const notCancelled = fireEvent.keyDown(nameField(), { key: "Enter", code: "Enter" });
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    expect(notCancelled).toBe(false);
    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// Registration, step 2 — starting the test
// -----------------------------------------------------------

describe("Login — registration, step 2: starting the test", () => {

  it("PRADĖTI TESTĄ logs in with the normalized name and the access code, then loads '/'", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();
    await register(user, "jonas jonaitis", registration({ username: "JONASJONAITIS", accessCode: "48291037" }));

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    const requests = backend.requests("POST", LOGIN);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: LOGIN });
    expect(requests[0].json).toEqual({ username: "JONASJONAITIS", password: "48291037" });
    expect(requests[0].headers["content-type"]).toBe("application/json");
    expect(requests[0].withCredentials).toBeUndefined();
  });


  it("logs in with Lithuanian letters and a leading-zero code unchanged", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();
    await register(user, "vardenė_pavardenė", registration({ username: "VARDENĖ_PAVARDENĖ", accessCode: "04821937" }));

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: "VARDENĖ_PAVARDENĖ", password: "04821937" });
  });


  it("shows a refused login's message in step 2 and keeps the credentials", async () => {
    backend.on("POST", LOGIN, reply.text("Vardas ir/arba Slaptažodis neteisingas."));
    const { user } = renderLogin();
    await register(user);

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await within(registerForm()).findByText("Vardas ir/arba Slaptažodis neteisingas.");

    expect(errorBox(registerForm()).textContent).toBe("Vardas ir/arba Slaptažodis neteisingas.");
    expect(chipValue("Vardas")).toBe("JONAS_JONAITIS");
    expect(chipValue("Kodas")).toBe("48291037");
    // Awaited: the button is PALAUKITE while the login runs,
    // which may still be clearing as the message lands
    expect(await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" })).toBeEnabled();
    expect(hardNavigations()).toEqual([]);
  });


  it.each([
    ["no connection", reply.networkError()],
    ["an HTTP 502 from the proxy", reply.status(502, "Bad Gateway")],
  ])("says the server could not be reached on %s", async (_, failure) => {
    backend.on("POST", LOGIN, failure);
    const { user } = renderLogin();
    await register(user);

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await within(registerForm()).findByText(NO_CONNECTION);

    expect(errorBox(registerForm()).textContent).toBe(NO_CONNECTION);
    expect(hardNavigations()).toEqual([]);
  });


  it("Enter logs in with the shown credentials", async () => {
    backend.on("POST", REGISTER, reply.json(registration()));
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas_jonaitis{Enter}");
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    await pressEnterOnPage(user);
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: "JONAS_JONAITIS", password: "48291037" });
    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// Registration, step 2 — while the login runs
// -----------------------------------------------------------
//
// Step 2 goes through the same login as the sign-in form, so
// PRADĖTI TESTĄ waits the way PRISIJUNGTI does.
// -----------------------------------------------------------

describe("Login — registration, step 2: while the login runs", () => {

  it("turns PRADĖTI TESTĄ into a disabled PALAUKITE with three bouncing dots", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();
    await register(user);

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));

    const waiting = buttonIn(registerForm(), "PALAUKITE");
    expect(waiting).toBeDisabled();
    expect(waiting.querySelectorAll(".animate-bounce-dot")).toHaveLength(3);
    expect(within(registerForm()).queryByRole("button", { name: "PRADĖTI TESTĄ" })).toBeNull();

    await act(async () => pending.resolve(reply.text("OK")));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
  });


  it.each([
    ["a refusal", reply.text("Vardas ir/arba Slaptažodis neteisingas."), "Vardas ir/arba Slaptažodis neteisingas."],
    ["a network failure", reply.networkError(), NO_CONNECTION],
  ])("comes back as PRADĖTI TESTĄ after %s", async (_, answer, message) => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();
    await register(user);

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await act(async () => pending.resolve(answer));

    expect(await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" })).toBeEnabled();
    expect(within(registerForm()).queryByRole("button", { name: "PALAUKITE" })).toBeNull();
    expect(errorBox(registerForm()).textContent).toBe(message);
  });


  it("logs in once however often PRADĖTI TESTĄ is clicked", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();
    await register(user);

    await user.dblClick(buttonIn(registerForm(), "PRADĖTI TESTĄ"));

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);

    await act(async () => pending.resolve(reply.text("OK")));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
  });


  it("logs in once on a click followed by an Enter", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();
    await register(user);

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await pressEnterOnPageWhileWaiting();

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);

    await act(async () => pending.resolve(reply.text("OK")));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
  });


  it("stays on PALAUKITE after the 'OK' — no second login while '/' loads", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();
    await register(user);

    await user.click(buttonIn(registerForm(), "PRADĖTI TESTĄ"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
    await pressEnterOnPageWhileWaiting();
    await settle();

    expect(buttonIn(registerForm(), "PALAUKITE")).toBeDisabled();
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(hardNavigations()).toEqual(["/"]);
  });
});







// -----------------------------------------------------------
// Switching between the forms
// -----------------------------------------------------------

describe("Login — switching between the forms", () => {

  it("'Jau turiu paskyrą — prisijungti' shows the sign-in form instead", async () => {
    const { user } = renderLogin();

    await openSignIn(user);

    expect(signInForm().parentElement).toHaveClass("block");
    expect(signInForm().parentElement).not.toHaveClass("hidden");
    expect(registerForm().parentElement).toHaveClass("hidden");
    expect(registerForm().parentElement).not.toHaveClass("block");
  });


  it("'Neturiu paskyros — registruotis' goes back to registration", async () => {
    const { user } = renderLogin();

    await openSignIn(user);
    await backToRegistration(user);

    expect(registerForm().parentElement).toHaveClass("block");
    expect(signInForm().parentElement).toHaveClass("hidden");
  });


  it("keeps what was typed into the sign-in form across a round trip", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "admin@knf.vu.lt");
    await user.type(signInCodeField(), "slaptazodis");
    await backToRegistration(user);
    await openSignIn(user);

    expect(signInNameField()).toHaveValue("admin@knf.vu.lt");
    expect(signInCodeField()).toHaveValue("slaptazodis");

    await user.click(buttonIn(signInForm(), "PRISIJUNGTI"));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: "admin@knf.vu.lt", password: "slaptazodis" });
  });
});







// -----------------------------------------------------------
// The sign-in form
// -----------------------------------------------------------
//
// One endpoint for both roles — the backend tells an admin
// (the name contains "@") from a student.
// -----------------------------------------------------------

describe("Login — the sign-in form", () => {

  it("asks for 'Vardas / El. Paštas' and a masked 'Kodas / Slaptažodis'", async () => {
    const { user } = renderLogin();
    await openSignIn(user);

    expect(signInForm()).toContainElement(signInNameField());
    expect(signInForm()).toContainElement(signInCodeField());
    expect(signInNameField()).toHaveAttribute("type", "text");
    expect(signInCodeField()).toHaveAttribute("type", "password");
    expect(signInNameField()).toBeRequired();
    expect(signInCodeField()).toBeRequired();
  });


  it("starts empty, with PRISIJUNGTI and no error box", async () => {
    const { user } = renderLogin();
    await openSignIn(user);

    expect(signInNameField()).toHaveValue("");
    expect(signInCodeField()).toHaveValue("");
    expect(buttonIn(signInForm(), "PRISIJUNGTI")).toBeEnabled();
    expect(errorBox(signInForm())).toBeNull();
  });


  it.each([
    ["an administrator with email and password", "admin@knf.vu.lt", "Slaptas-Slaptazodis-1"],
    ["a student with name and access code", "JONAS_JONAITIS", "48291037"],
  ])("signs in %s through POST /api/login, then loads '/'", async (_, name, code) => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await signIn(user, name, code);
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    const requests = backend.requests("POST", LOGIN);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", url: LOGIN });
    expect(requests[0].json).toEqual({ username: name, password: code });
    expect(requests[0].withCredentials).toBeUndefined();
  });


  it("sends a name with Lithuanian letters unchanged", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await signIn(user, "VARDENĖ_PAVARDENĖ", "30718264");
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: "VARDENĖ_PAVARDENĖ", password: "30718264" });
  });


  it("Enter in the code field signs in", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "JONAS_JONAITIS");
    await user.type(signInCodeField(), "48291037{Enter}");
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: "JONAS_JONAITIS", password: "48291037" });
  });
});







// -----------------------------------------------------------
// Sign-in refused or unreachable
// -----------------------------------------------------------

describe("Login — sign-in refused or unreachable", () => {

  // The documented messages of POST /api/login — always HTTP
  // 200 and display-ready, so they are shown as they come
  it.each([
    ["both fields are empty", "", "", "Įveskite Prisijungimo Vardą ir Slaptažodį."],
    ["the name is empty", "", "48291037", "Įveskite Prisijungimo Vardą."],
    ["the password is empty", "admin@knf.vu.lt", "", "Įveskite Slaptažodį."],
    ["an administrator's password is wrong", "admin@knf.vu.lt", "neteisingas", "El. Paštas ir/arba Slaptažodis neteisingas."],
    ["a student's code is wrong", "JONAS_JONAITIS", "00000000", "Vardas ir/arba Slaptažodis neteisingas."],
  ])("shows the backend's message verbatim when %s", async (_, name, code, message) => {
    backend.on("POST", LOGIN, reply.text(message));
    const { user } = renderLogin();

    await signIn(user, name, code);
    await within(signInForm()).findByText(message);

    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: name, password: code });
    expect(errorBox(signInForm()).textContent).toBe(message);
    expect(hardNavigations()).toEqual([]);
  });


  it.each([
    ["no connection", reply.networkError()],
    ["an HTTP 500", reply.status(500, "Internal Server Error")],
    ["an HTTP 502 from the proxy", reply.status(502, "Bad Gateway")],
  ])("says the server could not be reached on %s", async (_, failure) => {
    backend.on("POST", LOGIN, failure);
    const { user } = renderLogin();

    await signIn(user, "admin@knf.vu.lt", "slaptazodis");
    await within(signInForm()).findByText(NO_CONNECTION);

    expect(errorBox(signInForm()).textContent).toBe(NO_CONNECTION);
    expect(hardNavigations()).toEqual([]);
  });


  it("keeps the typed credentials and shows the next attempt's message instead", async () => {
    backend.once("POST", LOGIN, reply.text("Įveskite Slaptažodį."));
    backend.once("POST", LOGIN, reply.text("El. Paštas ir/arba Slaptažodis neteisingas."));
    const { user } = renderLogin();

    await signIn(user, "admin@knf.vu.lt", "");
    await within(signInForm()).findByText("Įveskite Slaptažodį.");
    expect(signInNameField()).toHaveValue("admin@knf.vu.lt");

    await user.type(signInCodeField(), "neteisingas");
    await user.click(await within(signInForm()).findByRole("button", { name: "PRISIJUNGTI" }));
    await within(signInForm()).findByText("El. Paštas ir/arba Slaptažodis neteisingas.");

    expect(errorBox(signInForm()).textContent).toBe("El. Paštas ir/arba Slaptažodis neteisingas.");
    expect(backend.requests("POST", LOGIN).map((request) => request.json)).toEqual([
      { username: "admin@knf.vu.lt", password: "" },
      { username: "admin@knf.vu.lt", password: "neteisingas" },
    ]);
  });
});







// -----------------------------------------------------------
// The sign-in form while the request runs
// -----------------------------------------------------------

describe("Login — the sign-in form while the request runs", () => {

  it("turns PRISIJUNGTI into a disabled PALAUKITE with three bouncing dots", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();

    await signIn(user, "admin@knf.vu.lt", "slaptazodis");

    const waiting = buttonIn(signInForm(), "PALAUKITE");
    expect(waiting).toBeDisabled();
    expect(waiting.querySelectorAll(".animate-bounce-dot")).toHaveLength(3);
    expect(within(signInForm()).queryByRole("button", { name: "PRISIJUNGTI" })).toBeNull();

    await act(async () => pending.resolve(reply.text("OK")));
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
  });


  it.each([
    ["a refusal", reply.text("El. Paštas ir/arba Slaptažodis neteisingas."), "El. Paštas ir/arba Slaptažodis neteisingas."],
    ["a network failure", reply.networkError(), NO_CONNECTION],
  ])("comes back as PRISIJUNGTI after %s", async (_, answer, message) => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();

    await signIn(user, "admin@knf.vu.lt", "slaptazodis");
    await act(async () => pending.resolve(answer));

    expect(await within(signInForm()).findByRole("button", { name: "PRISIJUNGTI" })).toBeEnabled();
    expect(within(signInForm()).queryByRole("button", { name: "PALAUKITE" })).toBeNull();
    expect(errorBox(signInForm()).textContent).toBe(message);
  });


  it("signs in once on a double-click", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "admin@knf.vu.lt");
    await user.type(signInCodeField(), "slaptazodis");
    await user.dblClick(buttonIn(signInForm(), "PRISIJUNGTI"));

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);

    await act(async () => pending.resolve(reply.text("El. Paštas ir/arba Slaptažodis neteisingas.")));
    await within(signInForm()).findByRole("button", { name: "PRISIJUNGTI" });
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
  });


  it("signs in once however often Enter is pressed", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "JONAS_JONAITIS");
    await user.type(signInCodeField(), "48291037{Enter}");
    await user.keyboard("{Enter}{Enter}");

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);

    await act(async () => pending.resolve(reply.text("Vardas ir/arba Slaptažodis neteisingas.")));
    await within(signInForm()).findByRole("button", { name: "PRISIJUNGTI" });
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
  });


  it("stays on PALAUKITE after the 'OK' — no second login while '/' loads", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await signIn(user, "admin@knf.vu.lt", "slaptazodis");
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));
    await user.type(signInCodeField(), "{Enter}");
    await settle();

    expect(buttonIn(signInForm(), "PALAUKITE")).toBeDisabled();
    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(hardNavigations()).toEqual(["/"]);
  });
});







// -----------------------------------------------------------
// Enter only acts on the visible form
// -----------------------------------------------------------
//
// Both forms listen for Enter on the whole document; each
// must ignore it while the other one is showing. The request
// that must not happen is left unrouted, so it would also
// fail the test as unanswered.
// -----------------------------------------------------------

describe("Login — Enter only acts on the visible form", () => {

  it("Enter on the sign-in form does not register the name typed into registration", async () => {
    backend.on("POST", LOGIN, reply.text("Vardas ir/arba Slaptažodis neteisingas."));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await openSignIn(user);
    await user.type(signInNameField(), "JONAS");
    await user.type(signInCodeField(), "00000000{Enter}");
    await within(signInForm()).findByText("Vardas ir/arba Slaptažodis neteisingas.");

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(backend.requests("POST", REGISTER)).toHaveLength(0);
  });


  it("Enter on the registration form does not sign in with a filled sign-in form", async () => {
    backend.on("POST", REGISTER, reply.json(registration()));
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "admin@knf.vu.lt");
    await user.type(signInCodeField(), "slaptazodis");
    await backToRegistration(user);
    await user.type(nameField(), "jonas_jonaitis{Enter}");
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
    expect(backend.requests("POST", LOGIN)).toHaveLength(0);
  });


  it("Enter in step 2 logs in once, with the chips' credentials — not the sign-in form's", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "admin@knf.vu.lt");
    await user.type(signInCodeField(), "slaptazodis");
    await backToRegistration(user);
    await register(user);

    await pressEnterOnPage(user);
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    expect(backend.requests("POST", LOGIN).map((request) => request.json)).toEqual([
      { username: "JONAS_JONAITIS", password: "48291037" },
    ]);
  });
});







// -----------------------------------------------------------
// Enter on a focused button
// -----------------------------------------------------------
//
// A focused button handles Enter through its own click; the
// forms' document-wide Enter listeners leave it alone. The
// request that must not happen is left unrouted, so it would
// also fail the test as unanswered.
// -----------------------------------------------------------

describe("Login — Enter on a focused button", () => {

  it("Enter on 'Jau turiu paskyrą' switches to the sign-in form without registering", async () => {
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    buttonIn(registerForm(), "Jau turiu paskyrą — prisijungti").focus();
    await user.keyboard("{Enter}");
    await settle();

    expect(backend.requests("POST", REGISTER)).toHaveLength(0);
    expect(signInForm().parentElement).toHaveClass("block");
    expect(registerForm().parentElement).toHaveClass("hidden");
  });


  it("Enter on 'Neturiu paskyros' goes back to registration without signing in", async () => {
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "JONAS");
    buttonIn(signInForm(), "Neturiu paskyros — registruotis").focus();
    await user.keyboard("{Enter}");
    await settle();

    expect(backend.requests("POST", LOGIN)).toHaveLength(0);
    expect(registerForm().parentElement).toHaveClass("block");
    expect(signInForm().parentElement).toHaveClass("hidden");
  });


  it("Enter on a focused REGISTRUOTIS registers once", async () => {
    backend.on("POST", REGISTER, reply.json(registration()));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas_jonaitis");
    buttonIn(registerForm(), "REGISTRUOTIS").focus();
    await user.keyboard("{Enter}");
    await within(registerForm()).findByRole("button", { name: "PRADĖTI TESTĄ" });

    expect(backend.requests("POST", REGISTER)).toHaveLength(1);
    expect(backend.lastRequest("POST", REGISTER).json).toEqual({ username: "jonas_jonaitis" });
  });


  it("Enter on a focused PRISIJUNGTI signs in once", async () => {
    backend.on("POST", LOGIN, reply.text("OK"));
    const { user } = renderLogin();

    await openSignIn(user);
    await user.type(signInNameField(), "admin@knf.vu.lt");
    await user.type(signInCodeField(), "slaptazodis");
    buttonIn(signInForm(), "PRISIJUNGTI").focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(hardNavigations()).toEqual(["/"]));

    expect(backend.requests("POST", LOGIN)).toHaveLength(1);
    expect(backend.lastRequest("POST", LOGIN).json).toEqual({ username: "admin@knf.vu.lt", password: "slaptazodis" });
  });
});







// -----------------------------------------------------------
// A refusal stays with its form
// -----------------------------------------------------------
//
// Registration's first step keeps its own message (the
// registration refusals), apart from the login message. The
// ONE login message Login shares between step 2 and the
// sign-in form belongs to the attempt that got it: a switch
// between the forms and a successful registration drop it.
// -----------------------------------------------------------

describe("Login — a refusal stays with its form", () => {

  it("a refused sign-in does not show on registration's first step", async () => {
    backend.on("POST", LOGIN, reply.text("Vardas ir/arba Slaptažodis neteisingas."));
    const { user } = renderLogin();

    await signIn(user, "JONAS", "00000000");
    await within(signInForm()).findByText("Vardas ir/arba Slaptažodis neteisingas.");
    await backToRegistration(user);

    expect(registerForm().parentElement).toHaveClass("block");
    expect(errorBox(registerForm())).toBeNull();
  });


  it("a refused registration does not show in the sign-in form", async () => {
    backend.on("POST", REGISTER, reply.json(registrationRefused("Vartotojas tokiu vardu jau registruotas")));
    const { user } = renderLogin();

    await user.type(nameField(), "jonas");
    await user.click(buttonIn(registerForm(), "REGISTRUOTIS"));
    await within(registerForm()).findByText("Vartotojas tokiu vardu jau registruotas");
    await openSignIn(user);

    expect(signInForm().parentElement).toHaveClass("block");
    expect(errorBox(signInForm())).toBeNull();
  });


  it("a new registration's step 2 shows its credentials without an earlier sign-in's refusal", async () => {
    backend.on("POST", LOGIN, reply.text("Vardas ir/arba Slaptažodis neteisingas."));
    const { user } = renderLogin();

    await signIn(user, "JONAS", "00000000");
    await within(signInForm()).findByText("Vardas ir/arba Slaptažodis neteisingas.");
    await backToRegistration(user);
    await register(user);

    expect(chipValue("Vardas")).toBe("JONAS_JONAITIS");
    expect(chipValue("Kodas")).toBe("48291037");
    expect(errorBox(registerForm())).toBeNull();
  });


  it("a refused sign-in's message is gone once the sign-in form is opened again", async () => {
    backend.on("POST", LOGIN, reply.text("Vardas ir/arba Slaptažodis neteisingas."));
    const { user } = renderLogin();

    await signIn(user, "JONAS", "00000000");
    await within(signInForm()).findByText("Vardas ir/arba Slaptažodis neteisingas.");
    await backToRegistration(user);
    await openSignIn(user);

    expect(errorBox(signInForm())).toBeNull();
    expect(signInNameField()).toHaveValue("JONAS");
    expect(signInCodeField()).toHaveValue("00000000");
  });


  it("a sign-in refusal that lands after the switch stays out of the new registration's step 2", async () => {
    const pending = deferred();
    backend.on("POST", LOGIN, () => pending.promise);
    const { user } = renderLogin();

    await signIn(user, "JONAS", "00000000");
    await backToRegistration(user);
    await act(async () => pending.resolve(reply.text("Vardas ir/arba Slaptažodis neteisingas.")));
    await register(user);

    expect(chipValue("Vardas")).toBe("JONAS_JONAITIS");
    expect(errorBox(registerForm())).toBeNull();
  });
});
