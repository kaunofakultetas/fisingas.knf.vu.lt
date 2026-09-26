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
//      load of /login
//    - the DataGrid: ID, El. Paštas, Įjungtas? (a green
//      "Įjungtas" / grey "Išjungtas" pill for 1 / 0) and
//      Paskutinįkart Pastebėtas (Vilnius wall time, sorted by
//      the instant, empty for null = never); 100 rows a page
//      on the numbered pager
//    - the toolbar: "Ieškoti..." (debounced; the trimmed input
//      is ONE phrase, matched case-insensitively inside every
//      column's printed value — the Vilnius time for last
//      seen, hidden columns too; the pill column has no
//      printed value, only its 1 / 0), STULPELIAI (the column
//      picker) and "Įterpti Naują"
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
//    - {type: "ok"} → "Išsaugota", the grid refetches, the
//      dialog closes; 200 {type: "error", reason} →
//      "Nepavyko:" + the reason, the dialog stays as it was;
//      any other 200 body (e.g. the role gate "Error: Not
//      Admin") → "Nepavyko:Neaiškus atsakymas."; a failed
//      request → "Nepavyko:Serverio klaida."
//    - ×, Escape and the backdrop close it, sending nothing
//
//  Left to knownBugs.test.jsx, and so NOT exercised here:
//  KB-03 (no test scripts a 400 refusal), KB-04 (the delete
//  button's own "Įrašas ištrintas" toast is never asserted,
//  present or absent), KB-10 (the GET is never answered with
//  the role-gate text), KB-36 (no save is answered 401), KB-37
//  (no hold ends within a frame of the 1.5 s), KB-39 (the
//  picker is only ever closed by a click on STULPELIAI,
//  which closes it with and without the fix), KB-41 (the
//  only failed first load here is the 401) and KB-42 (no
//  save is clicked twice). The grid's built-in texts are
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

// Any other 200 body. The role gate is the contract's own
// answer to a non-admin session; the rest are off the
// contract on purpose
const UNCLEAR_ANSWERS = [
  ["the role-gate text 'Error: Not Admin'", reply.text("Error: Not Admin")],
  ["an empty object", reply.json({}, 200, { offContract: true })],
  ["the question endpoints' {status: 'ok'}", reply.json({ status: "ok" }, 200, { offContract: true })],
  ["a plain-text 'OK'", reply.text("OK", 200, { offContract: true })],
];

// Requests that fail outright — never a 400 (that is KB-03)
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

const closeButton = () => within(dialog()).getByTestId("CloseIcon").closest("button");
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
    // The target, not the count: a shared 401 interceptor (the
    // fix of KB-21 / KB-36) may redirect besides useFetchData
    expect([...new Set(hardNavigations())]).toEqual(["/login"]);
    expect(screen.queryByText(/^\(\d+\)$/)).toBeNull();
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
}, SLOW_UI_TIMEOUT);







// -----------------------------------------------------------
// The column picker
// -----------------------------------------------------------

describe("AdministratorsList — the column picker (STULPELIAI)", () => {

  const columnToggle = (title) => screen.getByRole("checkbox", { name: title });

  // Resolves with the picker's "El. Paštas" checkbox
  const openPicker = async (user) => {
    await user.click(button("STULPELIAI"));
    return screen.findByRole("checkbox", { name: "El. Paštas" });
  };

  const hideEmailColumn = async (user) => {
    await user.click(await openPicker(user));
    await waitFor(() => expect(columnFields()).toEqual(["id", "enabled", "lastseen"]));
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
  ])("shows the refusal '%s' as 'Nepavyko:' + the reason — the dialog stays open with what was typed, no refetch", async (reason) => {
    backend.on("POST", ADMINISTRATORS, refusal(reason));
    const { user } = await renderList();
    await openCreate(user);
    await fillNew(user);

    await user.click(button("Įterpti"));

    expect((await findToast(reason)).textContent).toBe(`Nepavyko:${reason}`);
    await settle();
    expect(toastTexts()).toEqual([`Nepavyko:${reason}`]);
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
    await findToast(EMAIL_TAKEN);

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


  it("shows the self-lockout refusal 'You cannot disable your own account' — the dialog stays open, 'Ne' still picked", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(OWN_ACCOUNT_DISABLED));
    const { user } = await renderList();
    await openEdit(user, 1);
    await pickEnabled(user, "Ne");

    await user.click(button("Išsaugoti"));

    expect((await findToast(OWN_ACCOUNT_DISABLED)).textContent).toBe(`Nepavyko:${OWN_ACCOUNT_DISABLED}`);
    await settle();
    expect(posts()[0].json).toEqual({ action: "insertupdate", id: 1, email: "admin@knf.vu.lt", enabled: 0, password: "" });
    expect(screen.getByRole("heading", { name: "Redaguoti Administratorių" })).toBeInTheDocument();
    expect(enabledSelect().textContent).toBe("Ne");
    expect(gets()).toHaveLength(1);
    expect(pill(1).textContent).toBe("Įjungtas");
  });


  it("shows 'Administrator with this email already exists' for an address someone else has — the dialog stays open", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(EMAIL_TAKEN));
    const { user } = await renderList();
    await openEdit(user, 2);
    await retypeEmail(user, "admin@knf.vu.lt");

    await user.click(button("Išsaugoti"));

    expect((await findToast(EMAIL_TAKEN)).textContent).toBe(`Nepavyko:${EMAIL_TAKEN}`);
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


  // Only the reply's own "Išsaugota" is looked for — the hold's
  // early "Įrašas ištrintas" is KB-04
  it("on {type: 'ok'}: 'Išsaugota', the dialog closes, the refetched list is without the row", async () => {
    backend.on("POST", ADMINISTRATORS, SAVED);
    const { user } = await renderList();
    backend.on("GET", ADMINISTRATORS, reply.json([ADMIN, JONAS]));
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);

    expect((await findToast("Išsaugota")).textContent).toBe("Išsaugota");
    await waitFor(() => expect(dialog()).toBeNull());
    await waitForRows(["1", "2"]);
    expect(gets()).toHaveLength(2);
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });


  it("shows the self-lockout refusal 'You cannot delete your own account' — the dialog stays open, the row stays", async () => {
    backend.on("POST", ADMINISTRATORS, refusal(OWN_ACCOUNT_DELETED));
    const { user } = await renderList();
    await openEdit(user, 1);

    longPress(deleteButton(), 1600);

    expect((await findToast(OWN_ACCOUNT_DELETED)).textContent).toBe(`Nepavyko:${OWN_ACCOUNT_DELETED}`);
    await settle();
    expect(posts()[0].json).toEqual({ action: "delete", id: 1 });
    expect(screen.getByRole("heading", { name: "Redaguoti Administratorių" })).toBeInTheDocument();
    expect(gets()).toHaveLength(1);
    expect(rowIds()).toEqual(["1", "2", "3"]);
  });


  it("answers the role-gate text with 'Nepavyko:Neaiškus atsakymas.' — the dialog stays open", async () => {
    backend.on("POST", ADMINISTRATORS, reply.text("Error: Not Admin"));
    const { user } = await renderList();
    await openEdit(user, 3);

    longPress(deleteButton(), 1600);

    expect((await findToast("Neaiškus atsakymas.")).textContent).toBe("Nepavyko:Neaiškus atsakymas.");
    await settle();
    expect(dialog()).not.toBeNull();
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
    ["a refusal", refusal(EMAIL_TAKEN), EMAIL_TAKEN],
    ["the role-gate text", reply.text("Error: Not Admin"), "Neaiškus atsakymas."],
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
