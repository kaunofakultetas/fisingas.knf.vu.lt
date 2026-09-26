// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — timestamp parsing and display
//
//  src/utils/timestamps.js — the one place the API's
//  timestamps are turned into Dates and display strings:
//
//    parseTimestamp  — ISO-8601 with offset → Date (null for
//                      null / "" / garbage)
//    formatDateTime  — → "YYYY-MM-DD HH:MM:SS" in Vilnius time,
//                      whatever the viewer's own timezone
//    dateTimeColumn  — the DataGrid column fragment (sorts on
//                      the Date, prints the Vilnius string)
//
//  The API publishes every timestamp in Europe/Vilnius with
//  the explicit offset ("+03:00" in summer, "+02:00" in
//  winter), so the DST switch days get their own tests.
// -----------------------------------------------------------

import "./support/setup";

import { afterEach, describe, it, expect } from "vitest";

import { TIME_ZONE, dateTimeColumn, formatDateTime, parseTimestamp } from "@/utils/timestamps";


const ORIGINAL_TZ = process.env.TZ;







// -----------------------------------------------------------
// parseTimestamp
// -----------------------------------------------------------

describe("parseTimestamp", () => {

  it("parses a summer (+03:00) timestamp to the exact instant", () => {
    const date = parseTimestamp("2026-08-26T19:09:07+03:00");

    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe("2026-08-26T16:09:07.000Z");
  });


  it("parses a winter (+02:00) timestamp to the exact instant", () => {
    expect(parseTimestamp("2026-01-15T10:00:00+02:00").toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });


  it("keeps the two 03:30 of the autumn DST switch apart", () => {
    // 2026-10-25 03:30 happens twice in Vilnius (EEST, then EET)
    // — the offsets make them two different instants an hour apart
    const first = parseTimestamp("2026-10-25T03:30:00+03:00");
    const second = parseTimestamp("2026-10-25T03:30:00+02:00");

    expect(second.getTime() - first.getTime()).toBe(60 * 60 * 1000);
  });


  it("returns null for 'never' and for values that are no date", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("garbage")).toBeNull();
    expect(parseTimestamp("2026-13-45T99:99:99+03:00")).toBeNull();
  });
});







// -----------------------------------------------------------
// formatDateTime
// -----------------------------------------------------------

describe("formatDateTime", () => {

  afterEach(() => {
    if (ORIGINAL_TZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = ORIGINAL_TZ;
    }
  });


  it("prints a summer timestamp as Vilnius wall time", () => {
    expect(formatDateTime("2026-08-26T19:09:07+03:00")).toBe("2026-08-26 19:09:07");
  });


  it("prints a winter timestamp as Vilnius wall time", () => {
    expect(formatDateTime("2026-01-15T10:00:00+02:00")).toBe("2026-01-15 10:00:00");
  });


  it("converts an instant written in another offset to Vilnius time", () => {
    expect(formatDateTime("2026-08-26T16:09:07Z")).toBe("2026-08-26 19:09:07");
    expect(formatDateTime("2026-01-15T08:00:00+00:00")).toBe("2026-01-15 10:00:00");
  });


  it("zero-pads every field", () => {
    expect(formatDateTime("2026-01-05T07:08:09+02:00")).toBe("2026-01-05 07:08:09");
  });


  it("prints the hour after midnight as 00, never 24", () => {
    expect(formatDateTime("2026-08-26T00:05:00+03:00")).toBe("2026-08-26 00:05:00");
  });


  it("follows the spring DST jump (03:00 EET → 04:00 EEST)", () => {
    // 2026-03-29 01:00 UTC is the switch moment in the EU
    expect(formatDateTime("2026-03-29T00:30:00Z")).toBe("2026-03-29 02:30:00");
    expect(formatDateTime("2026-03-29T01:30:00Z")).toBe("2026-03-29 04:30:00");
  });


  it("prints both 03:30 of the autumn DST switch as the same wall time", () => {
    expect(formatDateTime("2026-10-25T03:30:00+03:00")).toBe("2026-10-25 03:30:00");
    expect(formatDateTime("2026-10-25T03:30:00+02:00")).toBe("2026-10-25 03:30:00");
  });


  it("accepts a Date as well as a string", () => {
    expect(formatDateTime(new Date("2026-08-26T16:09:07Z"))).toBe("2026-08-26 19:09:07");
  });


  it("prints nothing for 'never' and for values that are no date", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("garbage")).toBe("");
  });


  it("prints Vilnius time whatever the viewer's own timezone is", () => {
    // Node re-reads TZ when it is assigned at runtime. Each first
    // assertion proves the local clock really moved — without
    // it the test would also pass on a machine that already runs
    // on Vilnius time, where it proves nothing
    process.env.TZ = "America/New_York";
    expect(new Date("2026-08-26T16:09:07Z").getHours()).toBe(12);
    expect(formatDateTime("2026-08-26T19:09:07+03:00")).toBe("2026-08-26 19:09:07");

    process.env.TZ = "Asia/Tokyo";
    expect(new Date("2026-01-15T08:00:00Z").getHours()).toBe(17);
    expect(formatDateTime("2026-01-15T10:00:00+02:00")).toBe("2026-01-15 10:00:00");
  });
});







// -----------------------------------------------------------
// dateTimeColumn
// -----------------------------------------------------------

describe("dateTimeColumn", () => {

  it("is a dateTime column", () => {
    expect(dateTimeColumn.type).toBe("dateTime");
  });


  it("hands the grid a Date to sort on (null for 'never')", () => {
    expect(dateTimeColumn.valueGetter("2026-08-26T19:09:07+03:00").toISOString()).toBe("2026-08-26T16:09:07.000Z");
    expect(dateTimeColumn.valueGetter(null)).toBeNull();
  });


  it("orders by the instant, not by the text", () => {
    // As strings the later instant ("…+02:00") would sort first
    const earlier = dateTimeColumn.valueGetter("2026-10-25T03:30:00+03:00");
    const later = dateTimeColumn.valueGetter("2026-10-25T03:30:00+02:00");

    expect("2026-10-25T03:30:00+02:00" < "2026-10-25T03:30:00+03:00").toBe(true);
    expect(earlier < later).toBe(true);
  });


  it("prints the Vilnius string (empty for 'never')", () => {
    const value = dateTimeColumn.valueGetter("2026-08-26T19:09:07+03:00");

    expect(dateTimeColumn.valueFormatter(value)).toBe("2026-08-26 19:09:07");
    expect(dateTimeColumn.valueFormatter(null)).toBe("");
  });
});







// -----------------------------------------------------------
// TIME_ZONE
// -----------------------------------------------------------

describe("TIME_ZONE", () => {

  it("is the platform's home zone", () => {
    expect(TIME_ZONE).toBe("Europe/Vilnius");
  });
});
