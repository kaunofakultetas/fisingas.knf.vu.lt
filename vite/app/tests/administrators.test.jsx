// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the administrators list and its
//      create / edit / delete dialog
//
//  src/systemPages/AdminPages/AdministratorsList/
//  AdministratorsList.jsx — /admin/administrators, inside its
//  AdminPageLayout (the navbar, "Administratoriai" lit in the
//  sidebar, the grey #EBECEF content area, the layout's own
//  <Toaster/>):
//    - GET /api/admin/administrators (axios, withCredentials)
//      once on mount. The heading "Administratorių Sąrašas" is
//      there at once, its "(N)" — N = the whole list, whatever
//      the search shows — and the rows only once the reply is
//      in (a loading bar until then); a 401 is a full page
//      load of /login, the role gate "Error: Not Admin" (HTTP
//      200, a session that is not an admin's) one of "/" —
//      never a list. A first load that fails shows "Nepavyko
//      įkelti administratorių sąrašo" with "Bandyti dar kartą"
//      (it asks again) in place of the count and the grid; a
//      failed refetch keeps the list on screen
//    - the DataGrid: ID, El. Paštas, Įjungtas? (a green
//      "Įjungtas" / grey "Išjungtas" pill for 1 / 0) and
//      Paskutinįkart Pastebėtas (Vilnius wall time, sorted by
//      the instant, empty for null = never); 100 rows a page
//      on the numbered pager
//    - the toolbar: "Ieškoti..." (debounced; the trimmed input
//      is ONE phrase, matched case-insensitively inside every
//      column's printed value — the Vilnius time for last
//      seen, the pill's word for Įjungtas?, hidden columns
//      too — and never lost to a re-render of the page while
//      it waits), STULPELIAI and "Įterpti Naują"
//    - STULPELIAI opens the grid's column picker (a checkbox
//      per column; unticked = hidden) and says so with
//      aria-expanded; a second click closes it, and after the
//      picker closed itself — a click elsewhere, Escape — one
//      click opens it again
//
//  .../AddEditAdministrator/AddEditAdministrator.jsx — one
//  dialog, two modes:
//    - create ("Įterpti Naują"): "Naujas Administratorius",
//      empty email, Įjungtas? Taip, both password fields;
//      "Įterpti" needs a non-blank email and two filled, equal
//      passwords; "Slaptažodžiai nesutampa" shows once the
//      repeat field has content that differs
//    - edit (a click anywhere on a row): "Redaguoti
//      Administratorių" prefilled from the row, the password
//      behind "Keisti Slaptažodį", "Ištrinti" held 1.5 s
//    - POST /api/admin/administrators (axios, withCredentials):
//        {action: "insertupdate", id, email, enabled, password}
//          id "" creates, else it is the row's id — a NUMBER;
//          enabled 1 / 0 — NUMBERS; password "" keeps the old
//        {action: "delete", id}
//      While one is on its way, "Įterpti" / "Išsaugoti" and
//      "Ištrinti" are disabled: one request per save / delete
//    - only the answer speaks: {type: "ok"} → "Išsaugota" (a
//      save) / "Įrašas ištrintas" (a delete), the grid
//      refetches, the dialog closes; {type: "error", reason}
//      — HTTP 200, or 400 from the backend's shape checks —
//      → "Nepavyko:" + the reason in Lithuanian (every reason
//      the backend gives is translated; an unknown one shows
//      as it came), the dialog stays as it was; the role gate
//      "Error: Not Admin" (HTTP 200) → a full page load of
//      "/", a 401 → one of /login, nothing toasted either way;
//      any other 200 body → "Nepavyko:Neaiškus atsakymas.";
//      any other failed request → "Nepavyko:Serverio klaida."
//    - × ("Uždaryti"), Escape and the backdrop close it,
//      sending nothing
//
//  NOT exercised here: a release right at the 1.5 s edge of
//  the hold — the holds here are 1.6 s (complete) or 1.4 s
//  (early); the edge is LongPressButton's own timing, pinned
//  in longPressButton.test.jsx. The grid's built-in texts are
//  English (no localeText) and are not pinned either.
//
//  NOTE the grid's column-menu buttons are labelled "<column>
//  column menu" (aria-label) — "El. Paštas column menu" would
//  answer a page-wide label query for the email field, so the
//  dialog's fields are looked up inside the dialog.
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { hardNavigations } from "./support/navigation";
import { longPress } from "./support/interactions";
import * as fx from "./support/fixtures";

import AdministratorsList from "@/systemPages/AdminPages/AdministratorsList/AdministratorsList";
import AddEditAdministrator from "@/systemPages/AdminPages/AdministratorsList/AddEditAdministrator/AddEditAdministrator";


const ADMINISTRATORS = "/api/admin/administrators";

// POST /api/admin/administrators answers — the object protocol
const SAVED = reply.json({ type: "ok" });
const refusal = (reason) => reply.json({ type: "error", reason });

// The documented refusals (swagger) — all HTTP 200
const EMAIL_TAKEN = "Administrator with this email already exists";
const PASSWORD_TOO_SHORT = "Password must be at least 8 characters long";
const PASSWORD_TOO_LONG = "Password must be at most 72 bytes long";
const EMAIL_WITHOUT_AT = "Email address must contain @";
const OWN_ACCOUNT_DISABLED = "You cannot disable your own account";
const OWN_ACCOUNT_DELETED = "You cannot delete your own account";

// The shape checks refuse with HTTP 400 and the same object —
// e.g. "Invalid email" for an address over 255 characters (the
// field sets no limit)
const shapeRefusal = (reason) => reply.json({ type: "error", reason }, 400);
const INVALID_EMAIL = "Invalid email";

// Every reason the backend gives (administrators_views.py), its
// HTTP status, and what the dialog shows after "Nepavyko:"
const REASONS = [
  ["Invalid request body", 400, "Netinkamas užklausos turinys"],
  [INVALID_EMAIL, 400, "Netinkamas el. pašto adresas (daugiausia 255 simboliai)"],
  ["Invalid password", 400, "Netinkamas slaptažodis"],
  ["Invalid id", 400, "Netinkamas administratoriaus ID"],
  ["Invalid enabled flag", 400, "Netinkama „Įjungtas?“ reikšmė"],
  [EMAIL_WITHOUT_AT, 200, "El. pašto adrese turi būti simbolis @"],
  [PASSWORD_TOO_SHORT, 200, "Slaptažodis turi būti bent 8 simbolių ilgio"],
  [PASSWORD_TOO_LONG, 200, "Slaptažodis per ilgas: daugiausia 72 baitai (lietuviška raidė užima 2)"],
  [EMAIL_TAKEN, 200, "Administratorius su tokiu el. pašto adresu jau yra"],
  [OWN_ACCOUNT_DISABLED, 200, "Negalite išjungti savo paskyros"],
  [OWN_ACCOUNT_DELETED, 200, "Negalite ištrinti savo paskyros"],
];

// What the dialog shows for one of them
const shown = (reason) => REASONS.find(([sent]) => sent === reason)[2];

// The role gate: the contract's own answer (HTTP 200, plain
// text) to a session that is not an admin's
const ROLE_GATE = reply.text("Error: Not Admin");

// Any other 200 body — off the contract on purpose
const UNCLEAR_ANSWERS = [
  ["an empty object", reply.json({}, 200, { offContract: true })],
  ["the question endpoints' {status: 'ok'}", reply.json({ status: "ok" }, 200, { offContract: true })],
  ["a plain-text 'OK'", reply.text("OK", 200, { offContract: true })],
];

// Requests that fail outright, with no reason to show — for the
// list's GET and the dialog's POST alike
const FAILURES = [
  ["no connection", reply.networkError()],
  ["a 500", reply.status(500, "Internal Server Error")],
  ["a 502 from the proxy", reply.status(502, "Bad Gateway")],
];


// The team most tests open with: an administrator seen in
// summer, one seen in winter, a disabled one never seen
const ADMIN = fx.administrator({ id: 1, email: "admin@knf.vu.lt", enabled: 1, lastseen: "2026-08-26T19:09:07+03:00" });
const JONAS = fx.administrator({ id: 2, email: "jonas.jonaitis@knf.vu.lt", enabled: 1, lastseen: "2026-01-15T10:00:00+02:00" });
const ONA = fx.administrator({ id: 3, email: "ona.onaityte@knf.vu.lt", enabled: 0, lastseen: null });
const TEAM = [ADMIN, JONAS, ONA];

// Whom a successful create adds — what the refetch then lists
const NAUJAS = fx.administrator({ id: 4, email: "naujas@knf.vu.lt", enabled: 1, lastseen: null });

const COLUMN_TITLES = ["ID", "El. Paštas", "Įjungtas?", "Paskutinįkart Pastebėtas"];

const ACTIVE_TINT = "bg-[rgba(var(--mui-palette-primary-mainChannel)/0.20)]";

// Per-test timeout of every describe below: they mount the
// DataGrid page or the MUI dialog under jsdom and type whole
// forms through user-event — seconds a test, more on a busy
// CI box than vitest's default 5 s allows
const SLOW_UI_TIMEOUT = 15000;


// ---- the grid. jsdom turns the DataGrid's virtualization
// off: every row and column of the page is in the DOM

const rowIds = () =>
  [...document.querySelectorAll('[role="row"][data-id]')].map((row) => row.getAttribute("data-id"));

const cell = (id, field) =>
  document.querySelector(`[role="row"][data-id="${id}"] [role="gridcell"][data-field="${field}"]`);

const cellText = (id, field) => cell(id, field).textContent;

// The colored pill inside an "Įjungtas?" cell
const pill = (id) => cell(id, "enabled").firstElementChild;

const columnHeader = (field) => document.querySelector(`[role="columnheader"][data-field="${field}"]`);

const columnTitle = (field) => columnHeader(field).querySelector(".MuiDataGrid-columnHeaderTitle");

const columnFields = () =>
  [...document.querySelectorAll('[role="columnheader"]')].map((header) => header.getAttribute("data-field"));

const columnTitles = () =>
  [...document.querySelectorAll('[role="columnheader"] .MuiDataGrid-columnHeaderTitle')].map((title) => title.textContent);

const waitForRows = (ids) => waitFor(() => expect(rowIds()).toEqual(ids), { timeout: 3000 });

const searchBox = () => screen.getByPlaceholderText("Ieškoti...");

// The whole text in one go: a single debounced filter run, so
// the grid is only ever asserted in its final state
const search = (text) => fireEvent.change(searchBox(), { target: { value: text } });

// The numbered pager's page buttons, found by their number
const pageButton = (number) =>
  within(screen.getByRole("navigation")).getAllByRole("button").find((item) => item.textContent === String(number));


// ---- the dialog. A MUI Modal (no role="dialog"); while it is
// open, every other child of <body> is aria-hidden. Its fields
// are looked up inside it (see the NOTE in the header); the
// labels of the required ones end in " *"

const dialog = () => document.querySelector('[aria-labelledby="universal-modal-title"]');

const emailField = () => within(dialog()).getByLabelText(/^El\. Paštas/);
const enabledSelect = () => within(dialog()).getByRole("combobox", { name: /^Įjungtas\?/ });
const passwordField = () => within(dialog()).getByLabelText(/^Slaptažodis/);
const repeatField = () => within(dialog()).getByLabelText(/^Pakartoti Slaptažodį/);
const mismatchNote = () => screen.queryByText("Slaptažodžiai nesutampa");

const button = (name) => screen.getByRole("button", { name });

// Looked up before a hold — held, its label drops out of the
// button's accessible name
const deleteButton = () => button("Ištrinti");

const closeButton = () => within(dialog()).getByRole("button", { name: "Uždaryti" });
const backdrop = () => dialog().querySelector(".MuiBackdrop-root");


// On real timers; resolves once the grid shows the whole list
const renderList = async (administrators = TEAM) => {
  backend.on("GET", ADMINISTRATORS, reply.json(administrators));
  const result = renderPage(<AdministratorsList />, { path: "/admin/administrators" });
  await screen.findByText(`(${administrators.length})`, {}, { timeout: 3000 });
  await waitForRows(administrators.map((administrator) => String(administrator.id)));
  return result;
};

// The dialog alone, the list's callbacks as spies. rowData is
// what a row click hands in: the grid's { id, columns, row }
const renderDialog = (rowData) => {
  const setOpen = vi.fn();
  const getData = vi.fn();
  const result = renderPage(<AddEditAdministrator rowData={rowData} setOpen={setOpen} getData={getData} />, { toaster: true });
  return { ...result, setOpen, getData };
};

const rowClick = (administrator) => ({ id: administrator.id, columns: [], row: { ...administrator } });

const openCreate = (user) => user.click(button("Įterpti Naują"));
const openEdit = (user, id) => user.click(cell(id, "email"));

// Types the create form; a field given as "" is left alone
const fillNew = async (user, { email = "naujas@knf.vu.lt", password = "ilgas-slaptazodis", repeat = password } = {}) => {
  if (email) await user.type(emailField(), email);
  if (password) await user.type(passwordField(), password);
  if (repeat) await user.type(repeatField(), repeat);
};

const retypeEmail = async (user, email) => {
  await user.clear(emailField());
  await user.type(emailField(), email);
};

// Picks "Taip" / "Ne". The open menu is a modal of its own —
// the dialog is aria-hidden until it closes — and its exit is
// waited out, so no listbox of it lingers for later queries
const pickEnabled = async (user, option) => {
  await user.click(enabledSelect());
  await user.click(screen.getByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};

const posts = () => backend.requests("POST", ADMINISTRATORS);
const gets = () => backend.requests("GET", ADMINISTRATORS);

// The three ways out of the dialog. Escape is dispatched inside
// it — MUI's Modal listens on its own root
const CLOSERS = [
  ["the × button", (user) => user.click(closeButton())],
  ["Escape", () => fireEvent.keyDown(emailField(), { key: "Escape" })],
  ["a backdrop click", (user) => user.click(backdrop())],
];

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

describe("AdministratorsList — loading the list", () => {

  it("asks GET /api/admin/administrators once, with the session cookie — and nothing else", async () => {
    await renderList();
    await settle();

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: ADMINISTRATORS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();
  });


  it("shows the heading with a loading bar — and no count — until the list arrives", async () => {
    const list = deferred();
    backend.on("GET", ADMINISTRATORS, () => list.promise);
    renderPage(<AdministratorsList />, { path: "/admin/administrators" });
    await settle();

    expect(screen.getByRole("heading", { name: "Administratorių Sąrašas" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText(/^\(\d+\)$/)).toBeNull();
    expect(rowIds()).toEqual([]);

    await act(async () => list.resolve(reply.json(TEAM)));

    expect(await screen.findByText("(3)", {}, { timeout: 3000 })).toBeInTheDocument();
    await waitForRows(["1", "2", "3"]);
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  });


  it("shows '(0)' and no rows for an empty list", async () => {
    await renderList([]);

    expect(screen.getByText("(0)")).toBeInTheDocument();
    expect(rowIds()).toEqual([]);
  });


  it("sends an expired session (401) to /login with a full page load", async () => {
    backend.on("GET", ADMINISTRATORS, reply.status(401, "Unauthorized"));
    renderPage(<AdministratorsList />, { path: "/admin/administrators" });

    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();
    // The target is pinned, not how often it is set
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(screen.queryByText(/^\(\d+\)$/)).toBeNull();
  });


  // The string is never handed to the grid as its rows — setup.js
  // fails the test on any error React would log for them
  it("sends a session that is not an admin's (the role gate 'Error: Not Admin', HTTP 200) to '/' with a full page load — never a list", async () => {
    backend.on("GET", ADMINISTRATORS, ROLE_GATE);
    renderPage(<AdministratorsList />, { path: "/admin/administrators" });

    await waitFor(() => expect(hardNavigations()).toContain("/"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/"]);
    expect(screen.queryByText(/^\(\d+\)$/)).toBeNull();
    expect(rowIds()).toEqual([]);
    expect(screen.queryByRole("alert")).toBeNull();
  });


  // An empty grid under "(0)" would say there are no
  // administrators at all — and invite re-creating them
  it.each(FAILURES)("a first load failing with %s says 'Nepavyko įkelti administratorių sąrašo' and offers 'Bandyti dar kartą' — no count, no grid", async (_, failure) => {
    backend.on("GET", ADMINISTRATORS, failure);
    renderPage(<AdministratorsList />, { path: "/admin/administrators" });

    const failed = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(failed).toHaveTextContent("Nepavyko įkelti administratorių sąrašo");
    expect(within(failed).getByRole("button", { name: "Bandyti dar kartą" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Administratorių Sąrašas" })).toBeInTheDocument();
    expect(screen.queryByText(/^\(\d+\)$/)).toBeNull();
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.queryByRole("button", { name: "Įterpti Naują" })).toBeNull();
    expect(gets()).toHaveLength(1);
  });


  it("'Bandyti dar kartą' asks again — and shows the list, counted, once it arrives", async () => {
    backend.once("GET", ADMINISTRATORS, reply.status(500, "Internal Server Error"));
    backend.on("GET", ADMINISTRATORS, reply.json(TEAM));
    const { user } = renderPage(<AdministratorsList />, { path: "/admin/administrators" });
    const failed = await screen.findByRole("alert", {}, { timeout: 3000 });

    await user.click(within(failed).getByRole("button", { name: "Bandyti dar kartą" }));

    expect(await screen.findByText("(3)", {}, { timeout: 3000 })).toBeInTheDocument();
    await waitForRows(["1", "2", "3"]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(gets()).toHaveLength(2);
    expect(gets()[1].withCredentials).toBe(true);
  });


  it("keeps the list on screen when the refetch after a save fails", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    backend.on("GET", ADMINISTRATORS, reply.status(500, "Internal Server Error"));
    await openEdit(user, 2);

    await user.click(button("Išsaugoti"));
    await findToast("Išsaugota");
    await waitFor(() => expect(gets()).toHaveLength(2));
    await settle();

    expect(rowIds()).toEqual(["1", "2", "3"]);
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });


  it("drops a reply that arrives after the admin has left the page", async () => {
    const list = deferred();
    backend.on("GET", ADMINISTRATORS, () => list.promise);
    const { unmount } = renderPage(<AdministratorsList />, { path: "/admin/administrators" });
    await settle();
    unmount();

    await act(async () => list.resolve(reply.json(TEAM)));
    await settle();

    // The late state update must stay silent — setup.js fails the
    // test on any React error it would log
    expect(screen.queryByText("(3)")).toBeNull();
  });


  it("sits in the admin frame: the navbar, 'Administratoriai' lit in the sidebar, the grey content area", async () => {
    const { container } = await renderList();

    expect(screen.getByAltText("VU logotipas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atsijungti" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administratoriai" }).querySelector("li")).toHaveClass(ACTIVE_TINT);
    expect(container.querySelector(".overflow-auto").style.backgroundColor).toBe(cssColor("#EBECEF"));
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The grid
// -----------------------------------------------------------

describe("AdministratorsList — the grid", () => {

  it("has the columns ID, El. Paštas, Įjungtas?, Paskutinįkart Pastebėtas — in that order", async () => {
    await renderList();

    expect(columnTitles()).toEqual(COLUMN_TITLES);
    expect(columnFields()).toEqual(["id", "email", "enabled", "lastseen"]);
  });


  it("lists one row per administrator in the API's order, keyed by the ID", async () => {
    await renderList();

    expect(rowIds()).toEqual(["1", "2", "3"]);
  });


  it("shows each administrator's ID and email as sent", async () => {
    await renderList();

    expect(cellText(1, "id")).toBe("1");
    expect(cellText(1, "email")).toBe("admin@knf.vu.lt");
    expect(cellText(2, "id")).toBe("2");
    expect(cellText(2, "email")).toBe("jonas.jonaitis@knf.vu.lt");
  });


  it("shows Lithuanian letters in an address intact", async () => {
    await renderList([fx.administrator({ id: 5, email: "žydrūnas.čiurlionis@knf.vu.lt" })]);

    expect(cellText(5, "email")).toBe("žydrūnas.čiurlionis@knf.vu.lt");
  });


  it("shows enabled 1 as a green 'Įjungtas' pill and 0 as a grey 'Išjungtas' one", async () => {
    await renderList();

    expect(pill(1).textContent).toBe("Įjungtas");
    expect(pill(1)).toHaveClass("bg-[green]");
    expect(pill(1)).not.toHaveClass("bg-[grey]");

    expect(pill(3).textContent).toBe("Išjungtas");
    expect(pill(3)).toHaveClass("bg-[grey]");
    expect(pill(3)).not.toHaveClass("bg-[green]");
  });


  it("prints last seen as Vilnius wall time — summer (+03:00) and winter (+02:00) alike", async () => {
    await renderList();

    expect(cellText(1, "lastseen")).toBe("2026-08-26 19:09:07");
    expect(cellText(2, "lastseen")).toBe("2026-01-15 10:00:00");
  });


  it("leaves last seen empty for an administrator never seen (null)", async () => {
    await renderList();

    expect(cellText(3, "lastseen")).toBe("");
  });


  it("sorts by 'Paskutinįkart Pastebėtas' on the instant, not the text — even the two 03:30 of the autumn clock change", async () => {
    const { user } = await renderList([
      fx.administrator({ id: 1, email: "anksciau@knf.vu.lt", lastseen: "2026-10-25T03:30:00+03:00" }),
      fx.administrator({ id: 2, email: "ziema@knf.vu.lt", lastseen: "2026-01-15T10:00:00+02:00" }),
      fx.administrator({ id: 3, email: "veliau@knf.vu.lt", lastseen: "2026-10-25T03:30:00+02:00" }),
    ]);
    // 03:30 EEST and, an hour later, 03:30 EET read the same
    expect(cellText(1, "lastseen")).toBe("2026-10-25 03:30:00");
    expect(cellText(3, "lastseen")).toBe("2026-10-25 03:30:00");

    // As text the order would be 2, 3, 1
    await user.click(columnTitle("lastseen"));
    await waitForRows(["2", "1", "3"]);
    expect(columnHeader("lastseen")).toHaveAttribute("aria-sort", "ascending");

    await user.click(columnTitle("lastseen"));
    await waitForRows(["3", "1", "2"]);
    expect(columnHeader("lastseen")).toHaveAttribute("aria-sort", "descending");
  });


  it("pages at 100 administrators — the 101st waits on page 2 of the numbered pager", async () => {
    const administrators = Array.from({ length: 101 }, (_, index) =>
      fx.administrator({ id: index + 1, email: `admin${index + 1}@knf.vu.lt` }));
    backend.on("GET", ADMINISTRATORS, reply.json(administrators));
    const { user } = renderPage(<AdministratorsList />, { path: "/admin/administrators" });

    await screen.findByText("(101)", {}, { timeout: 10000 });
    await waitFor(() => expect(rowIds()).toHaveLength(100), { timeout: 10000 });
    expect(rowIds()[0]).toBe("1");
    expect(rowIds()[99]).toBe("100");
    expect(pageButton(1)).toHaveAttribute("aria-current", "page");

    await user.click(pageButton(2));

    await waitFor(() => expect(rowIds()).toEqual(["101"]), { timeout: 10000 });
    expect(pageButton(2)).toHaveAttribute("aria-current", "page");
    // The heading still counts everyone
    expect(screen.getByText("(101)")).toBeInTheDocument();
  }, 30000);
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The quick search
// -----------------------------------------------------------

describe("AdministratorsList — the quick search", () => {

  it("sits in the grid's toolbar with STULPELIAI and 'Įterpti Naują'", async () => {
    await renderList();

    const toolbar = screen.getByRole("toolbar");
    expect(within(toolbar).getByRole("searchbox")).toBe(searchBox());
    expect(within(toolbar).getByRole("button", { name: "STULPELIAI" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Įterpti Naują" })).toBeInTheDocument();
  });


  it("narrows the grid as the admin types — case-insensitive, without asking the server, the heading still counting everyone", async () => {
    const { user } = await renderList();

    await user.type(searchBox(), "JONAS");

    await waitForRows(["2"]);
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(backend.requests()).toHaveLength(1);
  });


  it("matches Lithuanian letters case-insensitively too", async () => {
    await renderList([ADMIN, fx.administrator({ id: 5, email: "žydrūnas.čiurlionis@knf.vu.lt" })]);

    search("ŽYDRŪNAS");

    await waitForRows(["5"]);
  });


  it("ignores spaces around the search text", async () => {
    await renderList();

    search("   ona.onaityte   ");

    await waitForRows(["3"]);
  });


  it("keeps the words together — 'jonas knf' is one phrase and matches nobody", async () => {
    await renderList();

    search("jonas knf");

    // Split into words, "knf" alone would match every address
    await waitForRows([]);
  });


  // The pill's word is the column's printed value — the search
  // finds what the admin reads, not the 1 / 0 behind it
  it("finds the disabled administrator by the word on the pill — 'Išjungtas' — and only that one", async () => {
    await renderList();

    search("Išjungtas");

    await waitForRows(["3"]);
    expect(pill(3).textContent).toBe("Išjungtas");
  });


  it("finds the enabled administrators by 'įjungtas' — case-insensitive, 'Išjungtas' left out", async () => {
    await renderList();

    search("įjungtas");

    await waitForRows(["1", "2"]);
  });


  it("finds an administrator by the last-seen time as shown — Vilnius time, not UTC", async () => {
    await renderList();

    search("2026-01-15 10:00");
    await waitForRows(["2"]);

    // The very same instant, written in UTC
    search("2026-01-15 08:00");
    await waitForRows([]);
  });


  it("brings everyone back when the search is cleared", async () => {
    const { user } = await renderList();
    search("jonas");
    await waitForRows(["2"]);

    await user.clear(searchBox());

    await waitForRows(["1", "2", "3"]);
  });


  // The search runs 150 ms after the last keystroke. Here the
  // page re-renders inside that wait — "Įterpti Naują" opens the
  // dialog and Escape closes it, all in the same task as the
  // typing, so no timer can run in between — and the waiting
  // search must survive it (a refetch landing mid-typing
  // re-renders the page the same way)
  it("applies a search even when the page re-renders before the search runs", async () => {
    await renderList();

    search("jonas");
    fireEvent.click(button("Įterpti Naują"));
    fireEvent.keyDown(emailField(), { key: "Escape" });
    expect(dialog()).toBeNull();

    await waitForRows(["2"]);
    expect(searchBox()).toHaveValue("jonas");
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The column picker
// -----------------------------------------------------------

describe("AdministratorsList — the column picker (STULPELIAI)", () => {

  const columnToggle = (title) => screen.getByRole("checkbox", { name: title });

  // A column of the picker — on screen while the picker is open
  const pickerColumn = () => screen.queryByRole("checkbox", { name: "El. Paštas" });

  // Resolves with the picker's "El. Paštas" checkbox
  const openPicker = async (user) => {
    await user.click(button("STULPELIAI"));
    return screen.findByRole("checkbox", { name: "El. Paštas" });
  };

  const hideEmailColumn = async (user) => {
    await user.click(await openPicker(user));
    await waitFor(() => expect(columnFields()).toEqual(["id", "enabled", "lastseen"]));
  };

  // The picker opened by STULPELIAI and then closed by the grid
  // itself — `closeIt` does that: the panel closes on a pointerup
  // outside it (a click-away armed one tick after it opened) and
  // on Escape inside it. Resolves with the user-event instance
  const pickerClosedByTheGrid = async (closeIt) => {
    const { user } = await renderList();
    await openPicker(user);

    await closeIt(user);
    await waitFor(() => expect(pickerColumn()).toBeNull());
    return user;
  };


  it("opens with a ticked checkbox for each of the four columns", async () => {
    const { user } = await renderList();

    await openPicker(user);

    for (const title of COLUMN_TITLES) {
      expect(columnToggle(title)).toBeChecked();
    }
  });


  it("hides a column that is unticked — a second STULPELIAI click closes the picker, the column stays hidden", async () => {
    const { user } = await renderList();

    await hideEmailColumn(user);
    expect(columnToggle("El. Paštas")).not.toBeChecked();
    expect(cell(2, "email")).toBeNull();

    await user.click(button("STULPELIAI"));

    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "El. Paštas" })).toBeNull());
    expect(columnFields()).toEqual(["id", "enabled", "lastseen"]);
  });


  it("keeps searching a hidden column", async () => {
    const { user } = await renderList();
    await hideEmailColumn(user);
    await user.click(button("STULPELIAI"));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "El. Paštas" })).toBeNull());

    search("jonas");

    await waitForRows(["2"]);
  });


  it("says whether the picker is open — aria-haspopup, and aria-expanded 'true' only while it is", async () => {
    const { user } = await renderList();
    expect(button("STULPELIAI")).toHaveAttribute("aria-haspopup", "true");
    expect(button("STULPELIAI")).not.toHaveAttribute("aria-expanded");

    await openPicker(user);
    expect(button("STULPELIAI")).toHaveAttribute("aria-expanded", "true");

    await user.click(button("STULPELIAI"));
    await waitFor(() => expect(pickerColumn()).toBeNull());
    expect(button("STULPELIAI")).not.toHaveAttribute("aria-expanded");
  });


  it("after a click elsewhere closed the picker, one click on STULPELIAI opens it again", async () => {
    const user = await pickerClosedByTheGrid((user) => user.click(screen.getByRole("heading", { name: "Administratorių Sąrašas" })));

    await user.click(button("STULPELIAI"));

    expect(await screen.findByRole("checkbox", { name: "El. Paštas" })).toBeInTheDocument();
  });


  it("after Escape closed the picker, one click on STULPELIAI opens it again", async () => {
    const user = await pickerClosedByTheGrid(() => {
      fireEvent.keyDown(pickerColumn(), { key: "Escape" });
    });

    await user.click(button("STULPELIAI"));

    expect(await screen.findByRole("checkbox", { name: "El. Paštas" })).toBeInTheDocument();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// Creating an administrator
// -----------------------------------------------------------

describe("AdministratorsList — creating an administrator", () => {

  it("'Įterpti Naują' opens 'Naujas Administratorius': empty email, Įjungtas? Taip, both password fields — nothing sent", async () => {
    const { user } = await renderList();

    await openCreate(user);

    expect(screen.getByRole("heading", { name: "Naujas Administratorius" })).toBeInTheDocument();
    expect(emailField()).toHaveValue("");
    expect(enabledSelect().textContent).toBe("Taip");
    expect(passwordField()).toHaveValue("");
    expect(repeatField()).toHaveValue("");
    expect(button("Įterpti")).toBeDisabled();
    expect(mismatchNote()).toBeNull();

    await settle();
    expect(backend.requests()).toHaveLength(1);
  });


  it("offers neither 'Ištrinti' nor 'Keisti Slaptažodį' — a new administrator has nothing to delete or keep", async () => {
    const { user } = await renderList();

    await openCreate(user);

    expect(within(dialog()).queryByRole("button", { name: "Ištrinti" })).toBeNull();
    expect(within(dialog()).queryByRole("button", { name: "Keisti Slaptažodį" })).toBeNull();
  });


  it("POSTs exactly {action: 'insertupdate', id: '', email, enabled: 1, password} with the session cookie", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user, { email: "naujas@knf.vu.lt", password: "ilgas-slaptazodis" });

    await user.click(button("Įterpti"));
    await findToast("Išsaugota");

    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject({ client: "axios", method: "POST", url: ADMINISTRATORS, withCredentials: true });
    expect(posts()[0].headers["content-type"]).toMatch(/^application\/json/);
    // id "" means INSERT; the repeated password stays in the browser
    expect(posts()[0].json).toEqual({
      action: "insertupdate",
      id: "",
      email: "naujas@knf.vu.lt",
      enabled: 1,
      password: "ilgas-slaptazodis",
    });
  });


  it("sends 'Ne' as enabled 0 — the number, as the menu's values are numbers", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await pickEnabled(user, "Ne");
    expect(enabledSelect().textContent).toBe("Ne");
    await user.click(button("Įterpti"));
    await findToast("Išsaugota");

    expect(posts()[0].json).toEqual({
      action: "insertupdate",
      id: "",
      email: "naujas@knf.vu.lt",
      enabled: 0,
      password: "ilgas-slaptazodis",
    });
  });


  it("sends the password exactly as typed — Lithuanian letters and spaces intact, nothing trimmed", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user, { password: " Žalias ąžuolas 2026 " });

    await user.click(button("Įterpti"));
    await findToast("Išsaugota");

    expect(posts()[0].json.password).toBe(" Žalias ąžuolas 2026 ");
  });


  it("on {type: 'ok'}: 'Išsaugota', a refetch with the session cookie, the dialog closes, the newcomer is listed", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList([ADMIN]);
    backend.on("GET", ADMINISTRATORS, reply.json([ADMIN, NAUJAS]));
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    expect((await findToast("Išsaugota")).textContent).toBe("Išsaugota");
    await waitFor(() => expect(dialog()).toBeNull());
    await waitForRows(["1", "4"]);
    expect(gets()).toHaveLength(2);
    expect(gets()[1].withCredentials).toBe(true);
    expect(screen.getByText("(2)")).toBeInTheDocument();
    // Exactly one toast: the layout's own Toaster is the only one
    expect(toastTexts()).toEqual(["Išsaugota"]);
  });


  it.each([
    EMAIL_TAKEN,
    PASSWORD_TOO_SHORT,
    PASSWORD_TOO_LONG,
    EMAIL_WITHOUT_AT,
  ])("shows the refusal '%s' as 'Nepavyko:' + the reason in Lithuanian — the dialog stays open with what was typed, no refetch", async (reason) => {
    backend.on("POST", ADMINISTRATORS, refusal(reason));
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    expect((await findToast(shown(reason))).textContent).toBe(`Nepavyko:${shown(reason)}`);
    await settle();
    expect(toastTexts()).toEqual([`Nepavyko:${shown(reason)}`]);
    expect(screen.getByRole("heading", { name: "Naujas Administratorius" })).toBeInTheDocument();
    expect(emailField()).toHaveValue("naujas@knf.vu.lt");
    expect(passwordField()).toHaveValue("ilgas-slaptazodis");
    expect(repeatField()).toHaveValue("ilgas-slaptazodis");
    expect(button("Įterpti")).toBeEnabled();
    expect(gets()).toHaveLength(1);
  });


  it("sends the corrected form again after a refusal", async () => {
    backend.once("POST", ADMINISTRATORS, refusal(EMAIL_TAKEN));
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user, { email: "admin@knf.vu.lt" });
    await user.click(button("Įterpti"));
    await findToast(shown(EMAIL_TAKEN));

    await retypeEmail(user, "naujas@knf.vu.lt");
    await user.click(button("Įterpti"));

    await findToast("Išsaugota");
    expect(posts().map((request) => request.json.email)).toEqual(["admin@knf.vu.lt", "naujas@knf.vu.lt"]);
    await waitFor(() => expect(dialog()).toBeNull());
  });


  it.each(UNCLEAR_ANSWERS)("answers %s with 'Nepavyko:Neaiškus atsakymas.' — the dialog stays open, no refetch", async (_, answer) => {
    backend.on("POST", ADMINISTRATORS, answer);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    expect((await findToast("Neaiškus atsakymas.")).textContent).toBe("Nepavyko:Neaiškus atsakymas.");
    await settle();
    expect(dialog()).not.toBeNull();
    expect(gets()).toHaveLength(1);
  });


  it.each(FAILURES)("answers %s with 'Nepavyko:Serverio klaida.' — the dialog stays open, no refetch", async (_, failure) => {
    backend.on("POST", ADMINISTRATORS, failure);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    expect((await findToast("Serverio klaida.")).textContent).toBe("Nepavyko:Serverio klaida.");
    await settle();
    expect(dialog()).not.toBeNull();
    expect(emailField()).toHaveValue("naujas@knf.vu.lt");
    expect(gets()).toHaveLength(1);
  });


  it("shows the reason of a 400 refusal in Lithuanian — 'Invalid email' as its 255-character limit — the dialog stays open with what was typed, no refetch", async () => {
    backend.on("POST", ADMINISTRATORS, shapeRefusal(INVALID_EMAIL));
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    expect((await findToast(shown(INVALID_EMAIL))).textContent).toBe("Nepavyko:Netinkamas el. pašto adresas (daugiausia 255 simboliai)");
    await settle();
    expect(toastTexts()).toEqual([`Nepavyko:${shown(INVALID_EMAIL)}`]);
    expect(dialog()).not.toBeNull();
    expect(emailField()).toHaveValue("naujas@knf.vu.lt");
    expect(button("Įterpti")).toBeEnabled();
    expect(gets()).toHaveLength(1);
  });


  it("sends an expired session (401) to /login with a full page load — nothing toasted, no refetch", async () => {
    backend.on("POST", ADMINISTRATORS, reply.status(401, "Unauthorized"));
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    await waitFor(() => expect(hardNavigations()).toContain("/login"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(toastTexts()).toEqual([]);
    expect(gets()).toHaveLength(1);
  });


  it("sends a session that is not an admin's (the role gate 'Error: Not Admin', HTTP 200) to '/' with a full page load — nothing toasted, no refetch", async () => {
    backend.on("POST", ADMINISTRATORS, ROLE_GATE);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    await waitFor(() => expect(hardNavigations()).toContain("/"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/"]);
    expect(toastTexts()).toEqual([]);
    expect(gets()).toHaveLength(1);
  });


  it("disables 'Įterpti' while the create is on its way — and enables it again after a refusal", async () => {
    const save = deferred();
    backend.on("POST", ADMINISTRATORS, () => save.promise);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));
    expect(button("Įterpti")).toBeDisabled();

    await act(async () => save.resolve(refusal(EMAIL_TAKEN)));

    await findToast(shown(EMAIL_TAKEN));
    expect(button("Įterpti")).toBeEnabled();
  });


  // One user-event call: its pointer-events check runs once, so
  // the button the first click disabled simply does not get the
  // second
  it("sends one create however often 'Įterpti' is clicked while it runs — one 'Išsaugota'", async () => {
    const save = deferred();
    backend.on("POST", ADMINISTRATORS, () => save.promise);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.dblClick(button("Įterpti"));
    expect(posts()).toHaveLength(1);

    await act(async () => save.resolve(SAVED));
    await findToast("Išsaugota");
    await settle();

    expect(posts()).toHaveLength(1);
    expect(toastTexts()).toEqual(["Išsaugota"]);
  });


  it("says nothing until the save has landed", async () => {
    const save = deferred();
    backend.on("POST", ADMINISTRATORS, () => save.promise);
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));
    await settle();

    expect(posts()).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
    expect(dialog()).not.toBeNull();
    expect(gets()).toHaveLength(1);

    await act(async () => save.resolve(SAVED));

    await findToast("Išsaugota");
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(gets()).toHaveLength(2));
  });


  it("still says 'Išsaugota' and refreshes the list when the save lands after the dialog was closed", async () => {
    const save = deferred();
    backend.on("POST", ADMINISTRATORS, () => save.promise);
    const { user } = await renderList([ADMIN]);
    backend.on("GET", ADMINISTRATORS, reply.json([ADMIN, NAUJAS]));
    await openCreate(user);
    await fillNew(user);
    await user.click(button("Įterpti"));

    await user.click(closeButton());
    expect(dialog()).toBeNull();

    await act(async () => save.resolve(SAVED));

    await findToast("Išsaugota");
    await waitForRows(["1", "4"]);
    expect(dialog()).toBeNull();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The create form's rules
// -----------------------------------------------------------

describe("AddEditAdministrator — the create form's rules", () => {

  it("asks for an email address, hides what is typed as a password, requires all three", () => {
    renderDialog(undefined);

    expect(emailField()).toHaveAttribute("type", "email");
    expect(passwordField()).toHaveAttribute("type", "password");
    expect(repeatField()).toHaveAttribute("type", "password");
    expect(emailField()).toBeRequired();
    expect(passwordField()).toBeRequired();
    expect(repeatField()).toBeRequired();
  });


  it("offers 'Taip' (1) and 'Ne' (0) under 'Įjungtas?', 'Taip' selected", async () => {
    const { user } = renderDialog(undefined);

    await user.click(enabledSelect());

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Taip", "Ne"]);
    expect(options.map((option) => option.getAttribute("data-value"))).toEqual(["1", "0"]);
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false"]);
  });


  it("keeps 'Įterpti' disabled while the email is empty", async () => {
    const { user } = renderDialog(undefined);

    await fillNew(user, { email: "" });

    expect(button("Įterpti")).toBeDisabled();
  });


  it("keeps 'Įterpti' disabled until both passwords are typed", async () => {
    const { user } = renderDialog(undefined);

    await user.type(emailField(), "naujas@knf.vu.lt");
    expect(button("Įterpti")).toBeDisabled();

    await user.type(passwordField(), "ilgas-slaptazodis");
    expect(button("Įterpti")).toBeDisabled();

    await user.type(repeatField(), "ilgas-slaptazodis");
    expect(button("Įterpti")).toBeEnabled();
  });


  it("keeps 'Įterpti' disabled while the passwords differ — even only in case", async () => {
    const { user } = renderDialog(undefined);

    await fillNew(user, { password: "ilgas-slaptazodis", repeat: "Ilgas-slaptazodis" });

    expect(button("Įterpti")).toBeDisabled();
  });


  it("flags 'Slaptažodžiai nesutampa' only once the repeat field has content that differs", async () => {
    const { user } = renderDialog(undefined);

    await user.type(passwordField(), "ilgas-slaptazodis");
    // Nothing repeated yet — nothing flagged
    expect(mismatchNote()).toBeNull();
    expect(repeatField()).toHaveAttribute("aria-invalid", "false");

    await user.type(repeatField(), "ilgas");
    expect(mismatchNote()).toBeInTheDocument();
    expect(repeatField()).toHaveAttribute("aria-invalid", "true");

    await user.type(repeatField(), "-slaptazodis");
    expect(mismatchNote()).toBeNull();
    expect(repeatField()).toHaveAttribute("aria-invalid", "false");

    // Only the repeat field is ever flagged
    expect(passwordField()).toHaveAttribute("aria-invalid", "false");
  });


  it("flags the mismatch at once when the repeat field is filled first", async () => {
    const { user } = renderDialog(undefined);

    await user.type(repeatField(), "ilgas-slaptazodis");
    expect(mismatchNote()).toBeInTheDocument();

    await user.type(passwordField(), "ilgas-slaptazodis");
    expect(mismatchNote()).toBeNull();
  });


  it("sends nothing on a click on the disabled 'Įterpti'", async () => {
    const { user } = renderDialog(undefined);
    await fillNew(user, { repeat: "kitas-slaptazodis" });

    // user-event refuses to click it (MUI's disabled style is
    // pointer-events: none) — a raw click is dropped by React
    fireEvent.click(button("Įterpti"));
    await settle();

    expect(backend.requests()).toHaveLength(0);
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// Editing an administrator
// -----------------------------------------------------------

describe("AdministratorsList — editing an administrator", () => {

  it("a click on a row opens 'Redaguoti Administratorių' prefilled from it, the password behind 'Keisti Slaptažodį'", async () => {
    const { user } = await renderList();

    await openEdit(user, 2);

    expect(screen.getByRole("heading", { name: "Redaguoti Administratorių" })).toBeInTheDocument();
    expect(emailField()).toHaveValue("jonas.jonaitis@knf.vu.lt");
    expect(enabledSelect().textContent).toBe("Taip");
    expect(button("Keisti Slaptažodį")).toBeInTheDocument();
    expect(within(dialog()).queryByLabelText(/^Slaptažodis/)).toBeNull();
    expect(within(dialog()).queryByLabelText(/^Pakartoti Slaptažodį/)).toBeNull();
    expect(button("Išsaugoti")).toBeEnabled();
    expect(deleteButton()).toBeEnabled();

    await settle();
    expect(backend.requests()).toHaveLength(1);
  });


  it("opens a disabled administrator with 'Įjungtas?' Ne", async () => {
    const { user } = await renderList();

    await openEdit(user, 3);

    expect(emailField()).toHaveValue("ona.onaityte@knf.vu.lt");
    expect(enabledSelect().textContent).toBe("Ne");
  });


  it.each(["id", "enabled", "lastseen"])("opens from a click on the row's '%s' cell as well", async (field) => {
    const { user } = await renderList();

    await user.click(cell(3, field));

    expect(screen.getByRole("heading", { name: "Redaguoti Administratorių" })).toBeInTheDocument();
    expect(emailField()).toHaveValue("ona.onaityte@knf.vu.lt");
  });


  it("saving untouched POSTs {action: 'insertupdate', id: <the row's id, a number>, email, enabled, password: ''} — '' keeps the password", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openEdit(user, 2);

    await user.click(button("Išsaugoti"));
    await findToast("Išsaugota");

    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject({ client: "axios", method: "POST", url: ADMINISTRATORS, withCredentials: true });
    expect(posts()[0].json).toEqual({
      action: "insertupdate",
      id: 2,
      email: "jonas.jonaitis@knf.vu.lt",
      enabled: 1,
      password: "",
    });
  });


  it.each([
    [2, "Ne", 0],
    [3, "Taip", 1],
  ])("sends a changed email and 'Įjungtas?' — administrator %i set to %s goes out as enabled %i", async (id, option, enabled) => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openEdit(user, id);

    await retypeEmail(user, "pakeistas@knf.vu.lt");
    await pickEnabled(user, option);
    await user.click(button("Išsaugoti"));
    await findToast("Išsaugota");

    expect(posts()[0].json).toEqual({
      action: "insertupdate",
      id,
      email: "pakeistas@knf.vu.lt",
      enabled,
      password: "",
    });
  });


  it("sends the new password after 'Keisti Slaptažodį'", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openEdit(user, 2);

    await user.click(button("Keisti Slaptažodį"));
    await user.type(passwordField(), "naujas-slaptazodis");
    await user.type(repeatField(), "naujas-slaptazodis");
    await user.click(button("Išsaugoti"));
    await findToast("Išsaugota");

    expect(posts()[0].json).toEqual({
      action: "insertupdate",
      id: 2,
      email: "jonas.jonaitis@knf.vu.lt",
      enabled: 1,
      password: "naujas-slaptazodis",
    });
  });


  it("on {type: 'ok'}: 'Išsaugota', the dialog closes, the refetched list shows the change", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    backend.on("GET", ADMINISTRATORS, reply.json([ADMIN, { ...JONAS, enabled: 0 }, ONA]));
    await openEdit(user, 2);
    await pickEnabled(user, "Ne");

    await user.click(button("Išsaugoti"));

    expect((await findToast("Išsaugota")).textContent).toBe("Išsaugota");
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(gets()).toHaveLength(2));
    await waitFor(() => expect(pill(2).textContent).toBe("Išjungtas"));
    expect(toastTexts()).toEqual(["Išsaugota"]);
  });


  it("disables 'Išsaugoti' and 'Ištrinti' while the update is on its way — one update however often clicked", async () => {
    const save = deferred();
    backend.on("POST", ADMINISTRATORS, () => save.promise);
    const { user } = await renderList();
    await openEdit(user, 2);

    await user.dblClick(button("Išsaugoti"));

    expect(button("Išsaugoti")).toBeDisabled();
    expect(deleteButton()).toBeDisabled();
    expect(posts()).toHaveLength(1);

    await act(async () => save.resolve(SAVED));
    await findToast("Išsaugota");
    await waitFor(() => expect(dialog()).toBeNull());
    expect(posts()).toHaveLength(1);
    expect(toastTexts()).toEqual(["Išsaugota"]);
  });


  it("shows the self-lockout refusal 'You cannot disable your own account' as 'Negalite išjungti savo paskyros' — the dialog stays open, 'Ne' still picked", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(OWN_ACCOUNT_DISABLED));
    const { user } = await renderList();
    await openEdit(user, 1);
    await pickEnabled(user, "Ne");

    await user.click(button("Išsaugoti"));

    expect((await findToast(shown(OWN_ACCOUNT_DISABLED))).textContent).toBe("Nepavyko:Negalite išjungti savo paskyros");
    await settle();
    expect(posts()[0].json).toEqual({ action: "insertupdate", id: 1, email: "admin@knf.vu.lt", enabled: 0, password: "" });
    expect(screen.getByRole("heading", { name: "Redaguoti Administratorių" })).toBeInTheDocument();
    expect(enabledSelect().textContent).toBe("Ne");
    expect(gets()).toHaveLength(1);
    expect(pill(1).textContent).toBe("Įjungtas");
  });


  it("shows 'Administrator with this email already exists', in Lithuanian, for an address someone else has — the dialog stays open", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(EMAIL_TAKEN));
    const { user } = await renderList();
    await openEdit(user, 2);
    await retypeEmail(user, "admin@knf.vu.lt");

    await user.click(button("Išsaugoti"));

    expect((await findToast(shown(EMAIL_TAKEN))).textContent).toBe(`Nepavyko:${shown(EMAIL_TAKEN)}`);
    await settle();
    expect(emailField()).toHaveValue("admin@knf.vu.lt");
    expect(gets()).toHaveLength(1);
  });


  it("forgets unsaved edits once closed — every row opens with its own data", async () => {
    const { user } = await renderList();
    await openEdit(user, 2);
    await retypeEmail(user, "neissaugotas@knf.vu.lt");
    await user.click(closeButton());

    await openEdit(user, 2);
    expect(emailField()).toHaveValue("jonas.jonaitis@knf.vu.lt");
    await user.click(closeButton());

    await openEdit(user, 3);
    expect(emailField()).toHaveValue("ona.onaityte@knf.vu.lt");
    expect(enabledSelect().textContent).toBe("Ne");

    await settle();
    expect(posts()).toHaveLength(0);
  });


  it("'Įterpti Naują' after an edit opens an empty create dialog", async () => {
    const { user } = await renderList();
    await openEdit(user, 2);
    await user.click(closeButton());

    await openCreate(user);

    expect(screen.getByRole("heading", { name: "Naujas Administratorius" })).toBeInTheDocument();
    expect(emailField()).toHaveValue("");
    expect(enabledSelect().textContent).toBe("Taip");
    expect(passwordField()).toHaveValue("");
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The edit form's rules
// -----------------------------------------------------------

describe("AddEditAdministrator — the edit form's rules", () => {

  it("blocks 'Išsaugoti' while the email is emptied", async () => {
    const { user } = renderDialog(rowClick(JONAS));

    await user.clear(emailField());
    expect(button("Išsaugoti")).toBeDisabled();

    await user.type(emailField(), "j.jonaitis@knf.vu.lt");
    expect(button("Išsaugoti")).toBeEnabled();
  });


  it("'Keisti Slaptažodį' opens both password fields empty — 'Išsaugoti' then needs them filled and equal", async () => {
    const { user } = renderDialog(rowClick(JONAS));

    await user.click(button("Keisti Slaptažodį"));

    expect(within(dialog()).queryByRole("button", { name: "Keisti Slaptažodį" })).toBeNull();
    expect(passwordField()).toHaveValue("");
    expect(repeatField()).toHaveValue("");
    expect(button("Išsaugoti")).toBeDisabled();

    await user.type(passwordField(), "naujas-slaptazodis");
    expect(button("Išsaugoti")).toBeDisabled();

    await user.type(repeatField(), "naujas-slaptazodi");
    expect(mismatchNote()).toBeInTheDocument();
    expect(button("Išsaugoti")).toBeDisabled();

    await user.type(repeatField(), "s");
    expect(mismatchNote()).toBeNull();
    expect(button("Išsaugoti")).toBeEnabled();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// Deleting an administrator
// -----------------------------------------------------------

describe("AdministratorsList — deleting an administrator", () => {

  it("a 1.5 s hold on 'Ištrinti' POSTs exactly {action: 'delete', id} with the session cookie", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);
    await waitFor(() => expect(gets()).toHaveLength(2));

    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject({ client: "axios", method: "POST", url: ADMINISTRATORS, withCredentials: true });
    expect(posts()[0].json).toEqual({ action: "delete", id: 3 });
  });


  it("on {type: 'ok'}: 'Įrašas ištrintas' as the only toast, the dialog closes, the refetched list is without the row", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    backend.on("GET", ADMINISTRATORS, reply.json([ADMIN, JONAS]));
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);

    expect((await findToast("Įrašas ištrintas")).textContent).toBe("Įrašas ištrintas");
    await waitFor(() => expect(dialog()).toBeNull());
    await waitForRows(["1", "2"]);
    expect(gets()).toHaveLength(2);
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(toastTexts()).toEqual(["Įrašas ištrintas"]);
  });


  it("says nothing until the delete has landed — 'Įrašas ištrintas' only with the backend's {type: 'ok'}", async () => {
    const deletion = deferred();
    backend.on("POST", ADMINISTRATORS, () => deletion.promise);
    const { user } = await renderList();
    backend.on("GET", ADMINISTRATORS, reply.json([ADMIN, JONAS]));
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);
    await settle();

    expect(posts()).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
    expect(dialog()).not.toBeNull();

    await act(async () => deletion.resolve(SAVED));

    await findToast("Įrašas ištrintas");
    await waitFor(() => expect(dialog()).toBeNull());
    await waitForRows(["1", "2"]);
  });


  it("a refused delete shows only the refusal — never 'Įrašas ištrintas'", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(OWN_ACCOUNT_DELETED));
    const { user } = await renderList();
    await openEdit(user, 1);

    longPress(deleteButton(), 1600);
    await findToast(shown(OWN_ACCOUNT_DELETED));
    await settle();

    expect(toastTexts()).toEqual(["Nepavyko:Negalite ištrinti savo paskyros"]);
  });


  it("ignores a second hold while the delete is on its way — 'Ištrinti' and 'Išsaugoti' disabled, one delete sent", async () => {
    const deletion = deferred();
    backend.on("POST", ADMINISTRATORS, () => deletion.promise);
    const { user } = await renderList();
    await openEdit(user, 3);
    const held = deleteButton();

    longPress(held, 1600);
    await settle();
    expect(held).toBeDisabled();
    expect(button("Išsaugoti")).toBeDisabled();

    longPress(held, 1600);
    await settle();
    expect(posts()).toHaveLength(1);

    await act(async () => deletion.resolve(SAVED));
    await findToast("Įrašas ištrintas");
    await settle();
    expect(posts()).toHaveLength(1);
    expect(toastTexts()).toEqual(["Įrašas ištrintas"]);
  });


  it("shows the self-lockout refusal 'You cannot delete your own account' as 'Negalite ištrinti savo paskyros' — the dialog stays open, its buttons usable again, the row stays", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(OWN_ACCOUNT_DELETED));
    const { user } = await renderList();
    await openEdit(user, 1);

    longPress(deleteButton(), 1600);

    expect((await findToast(shown(OWN_ACCOUNT_DELETED))).textContent).toBe(`Nepavyko:${shown(OWN_ACCOUNT_DELETED)}`);
    await settle();
    expect(posts()[0].json).toEqual({ action: "delete", id: 1 });
    expect(screen.getByRole("heading", { name: "Redaguoti Administratorių" })).toBeInTheDocument();
    expect(deleteButton()).toBeEnabled();
    expect(button("Išsaugoti")).toBeEnabled();
    expect(gets()).toHaveLength(1);
    expect(rowIds()).toEqual(["1", "2", "3"]);
  });


  it("sends a session that is not an admin's (the role gate 'Error: Not Admin') to '/' with a full page load — nothing toasted, no refetch", async () => {
    backend.on("POST", ADMINISTRATORS, ROLE_GATE);
    const { user } = await renderList();
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);

    await waitFor(() => expect(hardNavigations()).toContain("/"));
    await settle();
    expect([...new Set(hardNavigations())]).toEqual(["/"]);
    expect(toastTexts()).toEqual([]);
    expect(gets()).toHaveLength(1);
  });


  it.each(FAILURES)("answers %s with 'Nepavyko:Serverio klaida.' — the dialog stays open", async (_, failure) => {
    backend.on("POST", ADMINISTRATORS, failure);
    const { user } = await renderList();
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);

    expect((await findToast("Serverio klaida.")).textContent).toBe("Nepavyko:Serverio klaida.");
    await settle();
    expect(dialog()).not.toBeNull();
    expect(gets()).toHaveLength(1);
  });


  it("a release before 1.5 s toasts 'Laikykite nuspaudę, kad ištrintumėte' and deletes nothing", async () => {
    const { user } = await renderList();
    await openEdit(user, 3);

    longPress(deleteButton(), 1400);

    await findToast("Laikykite nuspaudę, kad ištrintumėte");
    await settle();
    expect(posts()).toHaveLength(0);
    expect(dialog()).not.toBeNull();
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// Closing the dialog
// -----------------------------------------------------------

describe("AdministratorsList — closing the dialog", () => {

  it.each(CLOSERS)("%s closes the create dialog with what was typed — nothing sent, the list as it was", async (_, close) => {
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await close(user);
    await settle();

    expect(dialog()).toBeNull();
    expect(backend.requests()).toHaveLength(1);
    expect(rowIds()).toEqual(["1", "2", "3"]);
  });


  it.each(CLOSERS)("%s closes the edit dialog without saving the changes", async (_, close) => {
    const { user } = await renderList();
    await openEdit(user, 2);
    await retypeEmail(user, "neissaugotas@knf.vu.lt");

    await close(user);
    await settle();

    expect(dialog()).toBeNull();
    expect(backend.requests()).toHaveLength(1);
    expect(cellText(2, "email")).toBe("jonas.jonaitis@knf.vu.lt");
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// What the dialog tells the list
// -----------------------------------------------------------

describe("AddEditAdministrator — what it tells the list", () => {

  it.each([
    ["a create", false, async (user) => {
      await fillNew(user);
      await user.click(button("Įterpti"));
    }],
    ["an update", true, (user) => user.click(button("Išsaugoti"))],
    ["a delete", true, () => longPress(deleteButton(), 1600)],
  ])("after %s answered {type: 'ok'}: getData() once to refresh the list, setOpen(false) once to close", async (_, editing, submit) => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user, setOpen, getData } = renderDialog(editing ? rowClick(ONA) : undefined);

    await submit(user);
    await waitFor(() => expect(setOpen).toHaveBeenCalled());
    await settle();

    expect(getData).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
  });


  it.each([
    ["a refusal", refusal(EMAIL_TAKEN), shown(EMAIL_TAKEN)],
    ["a 400 refusal", shapeRefusal(INVALID_EMAIL), shown(INVALID_EMAIL)],
    ["an unclear answer", reply.json({}, 200, { offContract: true }), "Neaiškus atsakymas."],
    ["a 500", reply.status(500, "Internal Server Error"), "Serverio klaida."],
    ["no connection", reply.networkError(), "Serverio klaida."],
  ])("after %s neither refreshes the list nor closes", async (_, answer, message) => {
    backend.on("POST", ADMINISTRATORS, answer);
    const { user, setOpen, getData } = renderDialog(undefined);
    await fillNew(user);

    await user.click(button("Įterpti"));
    await findToast(message);
    await settle();

    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });


  it.each([
    ["the role gate 'Error: Not Admin'", "/", ROLE_GATE],
    ["an expired session (401)", "/login", reply.status(401, "Unauthorized")],
  ])("after %s neither refreshes the list nor closes — the browser is sent to %s", async (_, target, answer) => {
    backend.on("POST", ADMINISTRATORS, answer);
    const { user, setOpen, getData } = renderDialog(rowClick(ONA));

    await user.click(button("Išsaugoti"));
    await waitFor(() => expect(hardNavigations()).toContain(target));
    await settle();

    expect([...new Set(hardNavigations())]).toEqual([target]);
    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual([]);
  });


  it.each(CLOSERS)("%s calls setOpen(false) — nothing sent, the list not refreshed", async (_, close) => {
    const { user, setOpen, getData } = renderDialog(rowClick(ONA));

    await close(user);
    await settle();

    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(getData).not.toHaveBeenCalled();
    expect(backend.requests()).toHaveLength(0);
  });
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The backend's reasons, in Lithuanian
// -----------------------------------------------------------

describe("AddEditAdministrator — the backend's reasons, in Lithuanian", () => {

  // The edit dialog saves at once — nothing to type
  it.each(REASONS)("shows '%s' (HTTP %i) as 'Nepavyko:%s'", async (reason, status, lithuanian) => {
    backend.on("POST", ADMINISTRATORS, reply.json({ type: "error", reason }, status));
    const { user } = renderDialog(rowClick(JONAS));

    await user.click(button("Išsaugoti"));

    expect((await findToast(lithuanian)).textContent).toBe(`Nepavyko:${lithuanian}`);
  });


  it.each([200, 400])("shows a reason it does not know as it came (HTTP %i)", async (status) => {
    backend.on("POST", ADMINISTRATORS, reply.json({ type: "error", reason: "Something unforeseen" }, status));
    const { user } = renderDialog(rowClick(JONAS));

    await user.click(button("Išsaugoti"));

    expect((await findToast("Something unforeseen")).textContent).toBe("Nepavyko:Something unforeseen");
  });
}, SLOW_UI_TIMEOUT);
