// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — the frontend's API contract itself
//
//  tests/contract/api.js is hand-kept, so its own consistency
//  is pinned here:
//    - the contract lists exactly the API paths src/ uses —
//      axios calls, fetch calls, useFetchData endpoints and the
//      <img src> / link-area URLs alike (string literals,
//      "…/" + id + "/…" concatenations and `${…}` templates);
//      direct axios.get/post, fetch and useFetchData calls must
//      also match the contract's METHOD
//    - every entry is well-formed (key, request and response
//      descriptors)
//    - every fixture builder (support/fixtures.js) produces an
//      answer the contract accepts exactly
//    - the guard (support/contractGuard.js) catches what it
//      promises to catch: unlisted endpoints and fields,
//      answers off the contract, reads of unlisted fields
//  The page tests then enforce the contract on every exchange.
// -----------------------------------------------------------

import "../support/setup";

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { API } from "./api.js";
import { checkShape, contractFor, contractViolations, guardReply, guardRequest, resetContractGuard } from "../support/contractGuard";
import * as fx from "../support/fixtures";


// vitest runs from the app root, so src/ is right there
const SRC = path.resolve(process.cwd(), "src");

// One spelling for a parameter segment on both sides
const normalise = (key) => key.replace(/:[A-Za-z_]+/g, ":id");

// Runs `exercise`, returns the violations it recorded and
// leaves the guard clean for the setup's afterEach check
const violationsOf = (exercise) => {
  resetContractGuard();
  try {
    exercise();
    return contractViolations();
  } finally {
    resetContractGuard();
  }
};

// A scripted answer as backend.js hands it to the guard
const jsonReply = (value, status = 200, offContract = false) => ({
  status,
  body: JSON.stringify(value),
  headers: { "content-type": "application/json" },
  offContract,
});
const textReply = (text, status = 200) => ({ status, body: text, headers: { "content-type": "text/html; charset=utf-8" } });
const imageReply = () => ({ status: 200, body: "bytes", headers: { "content-type": "image/png" } });

// A request as backend.js logs it
const request = (method, url, json = undefined, extra = {}) => ({
  method,
  path: url.split("?")[0],
  query: Object.fromEntries(new URLSearchParams(url.split("?")[1] ?? "").entries()),
  body: json === undefined ? undefined : JSON.stringify(json),
  json,
  formData: undefined,
  ...extra,
});







// -----------------------------------------------------------
// walk / stripComments / spaCalls
// -----------------------------------------------------------
//
// Every "/api/…" URL literal in src/ with its file and — for a
// direct axios.get/post, fetch or useFetchData call — the
// HTTP method. Comments are stripped first (whole `//` lines
// before `/* … */` blocks, so a "/*" inside a line comment —
// "AdminPages/* page" — cannot swallow code); a literal
// followed by `+ variable` gets a ":id" segment, optionally
// followed by the next literal (`"/api/x/" + id + "/links"`);
// `${…}` in a template literal becomes ":id".
//
// Used by:
//   - the endpoint-set tests (below)
// -----------------------------------------------------------

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.jsx?$/.test(entry.name)) files.push(full);
  }
  return files.sort();
}

function stripComments(text) {
  return text
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function spaCalls() {
  const calls = [];

  for (const file of walk(SRC)) {
    const text = stripComments(fs.readFileSync(file, "utf8"));
    const opening = /["'`]\/api\//g;
    let match;

    while ((match = opening.exec(text))) {
      const quote = text[match.index];
      const start = match.index + 1;

      let end = start;
      while (end < text.length && text[end] !== quote) {
        if (quote === "`" && text[end] === "$" && text[end + 1] === "{") {
          end = text.indexOf("}", end) + 1;
          continue;
        }
        end++;
      }

      let url = text.slice(start, end);
      if (quote === "`") {
        url = url.replace(/\$\{[^}]*\}/g, ":id");
      } else {
        const tail = /^\s*\+\s*[A-Za-z_$][\w$.]*(?:\s*\+\s*(["'])([^"']*)\1)?/.exec(text.slice(end + 1));
        if (tail) url += ":id" + (tail[2] ?? "");
      }

      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const before = text.slice(lineStart, match.index);
      let method = null;
      if (/axios\.post\(\s*$/.test(before)) method = "POST";
      else if (/axios\.get\(\s*$/.test(before) || /\bfetch\(\s*$/.test(before) || /useFetchData\(\s*$/.test(before)) method = "GET";

      calls.push({ file: path.relative(SRC, file), path: url.split("?")[0], method });
      opening.lastIndex = end + 1;
    }
  }

  return calls;
}







// -----------------------------------------------------------
// The endpoint set
// -----------------------------------------------------------

describe("the contract — the endpoint set", () => {

  it("lists exactly the API paths the SPA uses", () => {
    const used = [...new Set(spaCalls().map((call) => normalise(call.path)))].sort();
    const listed = [...new Set(Object.keys(API).map((key) => normalise(key.split(" ")[1])))].sort();

    expect(listed).toEqual(used);
    expect(used.length).toBeGreaterThanOrEqual(23);
  });


  it("lists the METHOD of every direct axios / fetch / useFetchData call", () => {
    const missing = spaCalls()
      .filter((call) => call.method)
      .filter((call) => !contractFor(call.method, call.path.replace(/:id/g, "1")))
      .map((call) => `${call.file}: ${call.method} ${call.path}`);

    expect(missing).toEqual([]);
  });


  it("matches the most specific entry for parameterised paths", () => {
    expect(contractFor("GET", "/api/admin/students/5").key).toBe("GET /api/admin/students/:id");
    expect(contractFor("GET", "/api/admin/students/5/answers").key).toBe("GET /api/admin/students/:id/answers");
    expect(contractFor("POST", "/api/admin/students/5/delete").key).toBe("POST /api/admin/students/:id/delete");
    expect(contractFor("GET", "/api/phishingpictures/21/links").key).toBe("GET /api/phishingpictures/:id/links");
    expect(contractFor("GET", "/api/admin/students").key).toBe("GET /api/admin/students");
    expect(contractFor("DELETE", "/api/admin/students/5")).toBeNull();
  });
});







// -----------------------------------------------------------
// Descriptor shapes
// -----------------------------------------------------------

describe("the contract — descriptor shapes", () => {

  const FIELD = /^[A-Za-z_][A-Za-z0-9_]*\??$/;

  const checkResponse = (shape, where) => {
    if (shape.oneOf) {
      expect(shape.oneOf.length, `${where}: oneOf lists alternatives`).toBeGreaterThan(1);
      shape.oneOf.forEach((variant, index) => checkResponse(variant, `${where}.oneOf[${index}]`));
      return;
    }
    const kinds = ["list", "object", "text", "blob"].filter((kind) => kind in shape);
    expect(kinds, `${where}: exactly one of list/object/text/blob`).toHaveLength(1);

    const fields = shape.list || shape.object || [];
    for (const field of fields) expect(field, `${where}: field names are identifiers`).toMatch(FIELD);
    expect(new Set(fields.map((field) => field.replace(/\?$/, ""))).size, `${where}: no duplicate fields`).toBe(fields.length);

    for (const [name, sub] of Object.entries(shape.nested || {})) {
      expect(fields.map((field) => field.replace(/\?$/, "")), `${where}: nested "${name}" is a listed field`).toContain(name);
      checkResponse(sub, `${where}.${name}`);
    }
    for (const name of [...(shape.virtual || []), ...Object.keys(shape.knownBugReads || {})]) {
      expect(fields, `${where}: "${name}" is not also a real field`).not.toContain(name);
    }
    for (const entry of Object.values(shape.knownBugReads || {})) {
      expect(entry, `${where}: knownBugReads name their ledger entry`).toMatch(/^KB-\d{2}$/);
    }
  };


  it("every key is 'METHOD /path' and every entry has a well-formed response", () => {
    for (const [key, entry] of Object.entries(API)) {
      expect(key).toMatch(/^(GET|POST) \/api(\/[a-z0-9_]+|\/:id)*$/);
      expect(entry.response, `${key}: response`).toBeTruthy();
      checkResponse(entry.response, `${key} response`);
    }
  });


  it("every POST has a request descriptor, no GET has one", () => {
    for (const [key, entry] of Object.entries(API)) {
      const method = key.split(" ")[0];
      const request = entry.request || {};
      const kinds = ["json", "jsonList", "form", "empty"].filter((kind) => kind in request);

      if (method === "POST") {
        expect(kinds, `${key}: one of json/jsonList/form/empty`).toHaveLength(1);
      } else {
        expect(kinds, `${key}: a GET sends no body`).toHaveLength(0);
      }

      for (const list of [request.json, request.jsonList, request.form]) {
        if (!list) continue;
        for (const field of list) expect(field).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
        expect(new Set(list).size).toBe(list.length);
      }
    }
  });
});







// -----------------------------------------------------------
// The fixtures against the contract
// -----------------------------------------------------------

describe("the contract — every fixture builder is on it", () => {

  // Findings of `value` against the endpoint's structured
  // descriptors — [] when at least one accepts it exactly
  const mismatches = (key, value) => {
    const variants = (API[key].response.oneOf || [API[key].response]).filter((variant) => variant.list || variant.object);
    const attempts = variants.map((variant) => {
      const found = [];
      checkShape(value, variant, "", found);
      return found;
    });
    return attempts.some((found) => found.length === 0) ? [] : attempts.flat();
  };


  it.each([
    ["GET /api/checkauth", "adminAuth", () => fx.adminAuth()],
    ["GET /api/checkauth", "studentAuth", () => fx.studentAuth()],
    ["GET /api/student/questions", "dealtTest", () => fx.dealtTest(3)],
    ["GET /api/student/questions", "the finished test's {}", () => ({})],
    ["GET /api/admin/questions", "questionBank", () => fx.questionBank([fx.adminQuestion(), fx.adminQuestion({ questionid: 22, isenabled: 0, isphishing: 0 })])],
    ["GET /api/admin/questions", "an empty questionBank", () => fx.questionBank([])],
    ["GET /api/phishingpictures/:id/links", "questionLink", () => [fx.questionLink(), fx.questionLink({ id: 2, x: null })]],
    ["GET /api/admin/students", "studentDetail + blankStudentDetail", () => [fx.studentDetail(), fx.blankStudentDetail({ id: 6 })]],
    ["GET /api/admin/students/:id", "studentDetail", () => fx.studentDetail()],
    ["GET /api/admin/students/:id", "blankStudentDetail", () => fx.blankStudentDetail()],
    ["GET /api/admin/students/:id/answers", "studentAnswer", () => [fx.studentAnswer(), fx.studentAnswer({ id: 12, isphishinganswer: null })]],
    ["GET /api/admin/administrators", "administrator", () => [fx.administrator(), fx.administrator({ id: 2, lastseen: null })]],
    ["GET /api/admin/home", "dashboard", () => fx.dashboard()],
    ["GET /api/admin/home", "a dashboard without active students", () => fx.dashboard({ studentsprogress: [], phishingtestsize: null })],
    ["GET /api/leaderboard", "leaderboardEntry + blankLeaderboardEntry", () => [fx.leaderboardEntry(), fx.blankLeaderboardEntry({ id: 6 })]],
  ])("%s accepts %s", (key, _name, build) => {
    expect(mismatches(key, build())).toEqual([]);
  });
});







// -----------------------------------------------------------
// The guard — requests
// -----------------------------------------------------------

describe("the contract guard — requests", () => {

  it("flags an endpoint the contract does not list", () => {
    expect(violationsOf(() => guardRequest(request("GET", "/api/nesamone")))).toEqual([
      "GET /api/nesamone: not in tests/contract/api.js",
    ]);
  });


  it("flags a method the contract does not list for a known path", () => {
    expect(violationsOf(() => guardRequest(request("POST", "/api/leaderboard", {})))).toHaveLength(1);
  });


  it("accepts listed JSON fields, also when some are omitted", () => {
    expect(violationsOf(() => guardRequest(request("POST", "/api/login", { username: "JONAS", password: "1" })))).toEqual([]);
    expect(violationsOf(() => guardRequest(request("POST", "/api/admin/administrators", { action: "delete", id: 3 })))).toEqual([]);
  });


  it("flags an unlisted JSON field", () => {
    const found = violationsOf(() => guardRequest(request("POST", "/api/login", { username: "JONAS", password: "1", remember: true })));

    expect(found).toHaveLength(1);
    expect(found[0]).toContain('"remember"');
  });


  it("checks every item of an array body and of nested lists", () => {
    const body = [
      { questionid: 11, selectedanswer: 1, question: "", questionoptions: [{ answeroptionid: 111, answeroption: "", isselected: 1, extra: 1 }] },
      { questionid: 12, selectedanswer: null, question: "", questionoptions: [], stray: true },
    ];
    const found = violationsOf(() => guardRequest(request("POST", "/api/student/questions", body)));

    expect(found).toHaveLength(2);
    expect(found.some((message) => message.includes('"extra"'))).toBe(true);
    expect(found.some((message) => message.includes('"stray"'))).toBe(true);
  });


  it("flags a body on an 'empty' POST and a missing body where one is expected", () => {
    expect(violationsOf(() => guardRequest(request("POST", "/api/logout", {})))).toHaveLength(1);
    expect(violationsOf(() => guardRequest(request("POST", "/api/logout")))).toEqual([]);
    expect(violationsOf(() => guardRequest(request("POST", "/api/login")))).toHaveLength(1);
  });


  it("checks multipart fields and flags query strings", () => {
    const upload = new FormData();
    upload.append("image", new Blob(["x"]), "a.png");
    expect(violationsOf(() => guardRequest(request("POST", "/api/phishingpictures", undefined, { body: upload, formData: upload })))).toEqual([]);

    const wrong = new FormData();
    wrong.append("file", new Blob(["x"]), "a.png");
    expect(violationsOf(() => guardRequest(request("POST", "/api/phishingpictures", undefined, { body: wrong, formData: wrong })))).toHaveLength(1);

    expect(violationsOf(() => guardRequest(request("GET", "/api/leaderboard?all=1")))).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// The guard — scripted answers
// -----------------------------------------------------------

describe("the contract guard — scripted answers", () => {

  const matchFor = (method, url) => contractFor(method, url);


  it("accepts an exact answer and flags missing and extra fields", () => {
    const key = ["GET", "/api/leaderboard"];
    expect(violationsOf(() => guardReply(matchFor(...key), jsonReply([fx.leaderboardEntry()])))).toEqual([]);

    const { testgrade: _dropped, ...missing } = fx.leaderboardEntry();
    expect(violationsOf(() => guardReply(matchFor(...key), jsonReply([missing])))).toHaveLength(1);
    expect(violationsOf(() => guardReply(matchFor(...key), jsonReply([{ ...fx.leaderboardEntry(), rank: 1 }])))).toHaveLength(1);
  });


  it("accepts either alternative of a oneOf, optional fields may be missing", () => {
    const register = matchFor("POST", "/api/student/register");
    expect(violationsOf(() => guardReply(register, jsonReply({ status: "OK", username: "JONAS", accessCode: "48291037" })))).toEqual([]);
    expect(violationsOf(() => guardReply(register, jsonReply({ status: "error", error: "Įveskite prisijungimo vardą" })))).toEqual([]);

    const checkauth = matchFor("GET", "/api/checkauth");
    expect(violationsOf(() => guardReply(checkauth, jsonReply(fx.adminAuth())))).toEqual([]);
  });


  it("allows plain text and bytes only where the contract says so", () => {
    expect(violationsOf(() => guardReply(matchFor("POST", "/api/login"), textReply("OK")))).toEqual([]);
    expect(violationsOf(() => guardReply(matchFor("GET", "/api/admin/students"), textReply("Error: Not Admin")))).toEqual([]);
    expect(violationsOf(() => guardReply(matchFor("GET", "/api/leaderboard"), textReply("OK")))).toHaveLength(1);
    expect(violationsOf(() => guardReply(matchFor("GET", "/api/leaderboard/nextslide"), imageReply()))).toEqual([]);
    expect(violationsOf(() => guardReply(matchFor("GET", "/api/leaderboard"), imageReply()))).toHaveLength(1);
  });


  it("leaves error statuses and answers marked offContract alone", () => {
    const leaderboard = matchFor("GET", "/api/leaderboard");

    expect(violationsOf(() => guardReply(leaderboard, jsonReply({ error: "x" }, 500)))).toEqual([]);
    expect(violationsOf(() => guardReply(leaderboard, jsonReply({ nonsense: true }, 200, true)))).toEqual([]);
  });
});







// -----------------------------------------------------------
// The guard — reads
// -----------------------------------------------------------

describe("the contract guard — reads", () => {

  // The wrapped answer a page would receive
  const received = (method, url, value) =>
    guardReply(contractFor(method, url), jsonReply(value)).wrap(JSON.parse(JSON.stringify(value)));


  it("lets listed fields through and records an unlisted read", () => {
    const found = violationsOf(() => {
      const [row] = received("GET", "/api/leaderboard", [fx.leaderboardEntry()]);
      expect(row.username).toBe("JONAS_JONAITIS");
      expect(row.rank).toBeUndefined();
    });

    expect(found).toHaveLength(1);
    expect(found[0]).toContain('"rank"');
  });


  it("tracks reads inside nested lists and inside array callbacks", () => {
    const found = violationsOf(() => {
      const bank = received("GET", "/api/admin/questions", fx.questionBank());
      bank.questions.map((question) => question.questionoptions.map((option) => option.optiontext + option.hint));
    });

    // One per option read (the default question has two)
    expect(found).toHaveLength(2);
    expect(found.every((message) => message.includes('"hint"'))).toBe(true);
    expect(found[0]).toContain("body.questions[0].questionoptions[0]");
  });


  it("allows the declared virtual reads and known-bug reads", () => {
    const found = violationsOf(() => {
      const [answer] = received("GET", "/api/admin/students/5/answers", [fx.studentAnswer()]);
      void answer.phishingpicture;
      void answer.identified;
      void answer.questionid;
    });

    expect(found).toEqual([]);
  });


  it("ignores non-data probes (promises, JSON, React, printing, symbols)", () => {
    const found = violationsOf(() => {
      const detail = received("GET", "/api/admin/students/5", fx.studentDetail());
      void detail.then;
      void detail.toJSON;
      void detail.$$typeof;
      void detail.hasAttribute;
      void detail[Symbol.iterator];
      JSON.stringify(detail);
      void { ...detail };
    });

    expect(found).toEqual([]);
  });


  it("keeps one proxy per object and lets writes through", () => {
    const found = violationsOf(() => {
      const questions = received("GET", "/api/student/questions", fx.dealtTest(2));

      expect(questions[0]).toBe(questions[0]);
      expect(questions.filter(() => true)[1]).toBe(questions[1]);

      questions[0].selectedanswer = 1;
      expect(questions[0].selectedanswer).toBe(1);
      expect(Array.isArray(questions)).toBe(true);
    });

    expect(found).toEqual([]);
  });


  it("keeps the wrapped items when the page sorts a list in place", () => {
    const found = violationsOf(() => {
      const questions = received("GET", "/api/student/questions", fx.dealtTest(2));
      const [first, second] = [questions[0], questions[1]];

      questions.sort((a, b) => b.questionid - a.questionid);

      expect(questions[0]).toBe(second);
      expect(questions[1]).toBe(first);
    });

    expect(found).toEqual([]);
  });


  it("survives a frozen list — the DataGrid freezes its rows in development builds", () => {
    const found = violationsOf(() => {
      const rows = received("GET", "/api/admin/administrators", [fx.administrator(), fx.administrator({ id: 2 })]);
      const first = rows[0];

      Object.freeze(rows);

      expect(rows[0]).toBe(first);
      expect(rows.map((row) => row.id)).toEqual([1, 2]);
    });

    expect(found).toEqual([]);
  });
});
