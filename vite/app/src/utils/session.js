// -----------------------------------------------------------
//  [*] Session — what a lost session means for a request
//
//  The backend turns a request without the right session away
//  in two ways, and both mean the page cannot go on as it is:
//    - HTTP 401 (no session, or it expired) → a full page load
//      of /login, where the user signs in again
//    - HTTP 200 with the plain-text role gate "Error: Not
//      Admin" (the admin GETs, the administrators save and the
//      link areas save, when the session is not an admin's —
//      e.g. a student logged in from another tab of the same
//      browser) → a full page load of "/", where the router
//      sends the user to their real home
//
//  Split into:
//
//    redirectOnExpiredSession — a 401 → /login
//    redirectOnRoleGate       — the role-gate reply → "/"
// -----------------------------------------------------------

// The admin endpoints' role-gate body (HTTP 200, text/html)
const ROLE_GATE_REPLY = "Error: Not Admin";







// -----------------------------------------------------------
// redirectOnExpiredSession
// -----------------------------------------------------------
//
//   catch (error) {
//     if (redirectOnExpiredSession(error)) return;
//     …the page's own failure handling
//   }
//
// A failed request whose session is gone → /login (true); any
// other failure is left to the caller (false).
//
// Used by:
//   - useFetchData — every GET of the admin pages, the
//     leaderboard and the results page
//   - TestHome — the questions GET and the answer saves
//   - the admin saves — AddQuestion, QuestionCard,
//     InteractiveImageEditor, AddEditAdministrator, Home's
//     test-size picker, StudentInformation's delete
// -----------------------------------------------------------

export function redirectOnExpiredSession(error) {
  if (error?.response?.status !== 401) return false;

  window.location.href = "/login";
  return true;
}







// -----------------------------------------------------------
// redirectOnRoleGate
// -----------------------------------------------------------
//
//   if (redirectOnRoleGate(response.data)) return;
//
// A 200 reply carrying the role gate instead of data → "/"
// (true); a real reply is left to the caller (false).
//
// Used by:
//   - useFetchData — the admin GETs
//   - InteractiveImageEditor — the link areas save
//   - AddEditAdministrator — the administrators save
// -----------------------------------------------------------

export function redirectOnRoleGate(replyData) {
  if (typeof replyData !== "string" || !replyData.startsWith(ROLE_GATE_REPLY)) return false;

  window.location.href = "/";
  return true;
}
