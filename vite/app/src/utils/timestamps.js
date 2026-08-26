// -----------------------------------------------------------
//  [*] Timestamps — parsing and display
//
//  The API publishes every timestamp as ISO-8601 in
//  Europe/Vilnius with the explicit offset, e.g.
//  "2026-08-26T19:09:07+03:00", and null for "never".
//  new Date() parses that unambiguously in every browser,
//  whatever the viewer's own timezone — comparisons are done
//  on Date objects, never on strings.
//
//  Display is always in Vilnius time (the platform's home),
//  as "YYYY-MM-DD HH:MM:SS" — the format the tables always
//  showed.
//
//  Used by:
//    - StudentsListTable, AdministratorsList — grid columns
//      (type "dateTime") and the "last month" filter
//    - StudentInformation, LeaderboardTable, QuestionCard —
//      plain display
// -----------------------------------------------------------

export const TIME_ZONE = "Europe/Vilnius";


// ISO string → Date, or null for null/""/garbage
export function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


// Date or ISO string → "2026-08-26 19:09:07" in Vilnius time,
// "" when there is nothing to show
export function formatDateTime(value) {
  const date = value instanceof Date ? value : parseTimestamp(value);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("lt-LT", {
    timeZone: TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}


// A DataGrid column definition fragment for a timestamp
// field: sorts on the Date, prints the Vilnius string
export const dateTimeColumn = {
  type: "dateTime",
  valueGetter: (value) => parseTimestamp(value),
  valueFormatter: (value) => formatDateTime(value),
};
