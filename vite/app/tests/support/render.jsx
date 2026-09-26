// -----------------------------------------------------------
//  [*] Test support — render helpers
//
//  Mount a page or component the way the app does:
//
//    renderPage(<StudentInformation />, {
//      path: "/admin/students/:studentID",   // route pattern
//      url: "/admin/students/5",             // where we start
//    })
//
//  → wrapped in a MemoryRouter (useParams / useNavigate work),
//  inside the app's MUI theme (like Providers does for every
//  page except /login — pass `theme: false` there), optionally
//  with a react-hot-toast <Toaster/> (`toaster: true`, ONLY for
//  components that do not mount their own — AdminPageLayout,
//  TestHome and TestFinish already do, a second one would
//  render every toast twice).
//
//  Any other URL the page navigates to (client-side) lands on
//  a catch-all route; `location()` reports where the router is.
//
//  renderApp(App, "/admin") mounts the real <App/> (BrowserRouter,
//  AuthProvider, Providers) at that URL instead — the test
//  imports App itself, so files that don't need the whole app
//  don't load every page.
//
//  Split into:
//
//    LocationProbe — records the router location
//    renderPage    — MemoryRouter + theme (+ toaster)
//    renderApp     — the whole app at a URL
//    settle        — flush pending promises inside act()
//    findToast / toastTexts — the visible toast messages
// -----------------------------------------------------------

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { Toaster } from "react-hot-toast";

import theme from "@/theme";


let lastLocation = null;







// -----------------------------------------------------------
// LocationProbe
// -----------------------------------------------------------
//
// Renders nothing; keeps the router's current location so
// tests can assert client-side navigations (useNavigate,
// <Link> clicks).
//
// Used by:
//   - renderPage (below)
// -----------------------------------------------------------

function LocationProbe() {
  lastLocation = useLocation();
  return null;
}







// -----------------------------------------------------------
// renderPage
// -----------------------------------------------------------
//
//   renderPage(ui)                              — at "/"
//   renderPage(ui, { path, url })               — route params
//   renderPage(ui, { theme: false })           — the login page
//   renderPage(ui, { toaster: true })           — bare components
//                                                 that toast
//
// Returns React Testing Library's render result plus
//   user      — a user-event instance (real timers)
//   location  — () => { pathname, search } of the router
//
// Used by:
//   - every page / component test
// -----------------------------------------------------------

export function renderPage(ui, { path = "/", url = path, theme: withTheme = true, toaster = false } = {}) {

  lastLocation = null;
  const user = userEvent.setup();

  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="*" element={<div data-testid="other-route" />} />
      </Routes>
      <LocationProbe />
      {/* After <Routes>: an unmounting Toaster removes the FIRST
          listener react-hot-toast registered, not its own — the
          page's Toaster must register before this one, or a page
          leaving the route would take this Toaster's with it */}
      {toaster && <Toaster />}
    </MemoryRouter>
  );

  const result = render(withTheme ? <ThemeProvider theme={theme}>{tree}</ThemeProvider> : tree);

  return {
    ...result,
    user,
    location: () => ({ pathname: lastLocation?.pathname, search: lastLocation?.search }),
  };
}







// -----------------------------------------------------------
// renderApp
// -----------------------------------------------------------
//
// The real <App/> (passed in by the test) — BrowserRouter +
// AuthProvider (its GET /api/checkauth goes to the fake
// backend's fetch side) + Providers — started at `url`. The
// router reads the real jsdom location, so
// window.location.pathname tells where the route guards sent
// the user.
//
// Used by:
//   - the routing / guard tests
// -----------------------------------------------------------

export function renderApp(App, url = "/") {
  window.history.replaceState(null, "", url);
  const user = userEvent.setup();
  const result = render(<App />);
  return { ...result, user };
}







// -----------------------------------------------------------
// settle
// -----------------------------------------------------------
//
// Lets every pending promise chain (fake backend replies,
// axios transforms, the state updates after them) run to the
// end inside act(). REAL timers only — under fake timers use
// `await act(() => vi.advanceTimersByTimeAsync(ms))` instead.
//
// Used by:
//   - tests asserting that something did NOT happen, or
//     reading the request log right after an interaction
// -----------------------------------------------------------

export async function settle() {
  // A faked setTimeout never fires on its own: say so instead of
  // hanging until vitest's test timeout
  if (Object.prototype.hasOwnProperty.call(globalThis.setTimeout, "clock")) {
    throw new Error("settle() needs the real setTimeout — under fake timers use `await act(() => vi.advanceTimersByTimeAsync(ms))`");
  }

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}







// -----------------------------------------------------------
// findToast / toastTexts
// -----------------------------------------------------------
//
// react-hot-toast renders every message in an element with
// role="status"; the app's messages are JSX (<b>…<br/>…</b>),
// so they are matched on the element's whole textContent.
//
//   await findToast("Nepavyko išsaugoti")   — waits for it
//   toastTexts()                            — every visible
//                                             message right now
//
// `hidden: true` because an open MUI dialog marks every other
// child of <body> aria-hidden — the Toaster's container among
// them (react-hot-toast has no portal) — which would hide
// exactly the toasts the dialogs raise from role queries.
//
// Used by:
//   - tests of save / delete / upload feedback
// -----------------------------------------------------------

export function toastTexts() {
  return screen.queryAllByRole("status", { hidden: true }).map((element) => element.textContent);
}

export async function findToast(text, { timeout = 1000 } = {}) {
  let found;
  await waitFor(() => {
    found = screen.queryAllByRole("status", { hidden: true }).find((element) => element.textContent.includes(text));
    if (!found) {
      throw new Error(`No toast containing "${text}". Visible toasts: ${JSON.stringify(toastTexts())}`);
    }
  }, { timeout });
  return found;
}
