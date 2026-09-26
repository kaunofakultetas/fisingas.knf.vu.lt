// -----------------------------------------------------------
//  [*] Test support — the API contract guard
//
//  Enforces tests/contract/api.js on every exchange with the
//  fake backend (support/backend.js), so a page test cannot
//  drift from the contract without failing:
//    - the endpoint must be listed (method + path)
//    - a JSON body may only carry the listed fields (items of
//      an array body, and of nested lists, likewise); a
//      multipart body only the listed fields, in order, once
//      each; an "empty" POST no body at all; no query string
//      the contract does not list
//    - a scripted 2xx answer must match one of the endpoint's
//      descriptors EXACTLY (every object has exactly the
//      listed fields, optional ones may be missing); a plain-
//      text or binary answer only where the contract says so
//    - every field the page then READS from a JSON answer must
//      be listed (or declared `virtual` / a `knownBugReads`
//      entry) — an unknown read is recorded with the endpoint
//      and the field
//  setup.js fails the test on any recorded violation. A test
//  that deliberately scripts an off-contract answer (a proxy's
//  HTML error page, a garbled body) marks that reply with
//  { offContract: true } — see reply.* in backend.js.
//
//  Split into:
//
//    NOT_DATA / looksLikeData — which reads can be data
//    contractViolations / resetContractGuard
//    contractFor   — the entry for METHOD + path
//    guardRequest  — the request checks
//    guardReply    — the answer checks + read tracking
//    checkShape / checkObject — exact-fields comparison
//    trackReads    — the read-recording wrappers (proxies)
// -----------------------------------------------------------

import { API } from "../contract/api.js";


// Violations recorded since the last reset — one string each
const violations = [];

// Property names read on answer objects that are not data:
// React probing children, JSON serialisation, promise
// unwrapping, vitest's equality / printing (pretty-format's
// DOM-element test probes hasAttribute), Object.prototype
const NOT_DATA = new Set([
  "then", "toJSON", "constructor", "valueOf", "toString", "hasOwnProperty",
  "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "__proto__",
  "key", "ref", "props", "type", "_owner", "_store", "length",
  "nodeType", "nodeName", "tagName", "ownerDocument", "asymmetricMatch",
  "hasAttribute", "$$typeof", "$$isMockFunction",
]);

// Only identifier-like names can be API fields — symbols,
// "$$…"/"@@…" markers and the like are never tracked
const looksLikeData = (property) => /^[a-z][A-Za-z0-9_]*$/.test(property) && !NOT_DATA.has(property);







// -----------------------------------------------------------
// contractViolations / resetContractGuard
// -----------------------------------------------------------
//
// The violations recorded so far (deduplicated), and the
// reset setup.js runs between tests.
//
// Used by:
//   - support/setup.js
//   - contract/api.test.js
// -----------------------------------------------------------

export function contractViolations() {
  return [...new Set(violations)];
}

export function resetContractGuard() {
  violations.length = 0;
}







// -----------------------------------------------------------
// contractFor
// -----------------------------------------------------------
//
// contractFor("GET", "/api/admin/students/5/answers") → the
// contract entry and its key. ":id" segments match any one
// path segment; the most specific key (fewest parameters)
// wins. null when nothing matches.
//
// Used by:
//   - guardRequest (below)
//   - contract/api.test.js
// -----------------------------------------------------------

export function contractFor(method, path) {
  let best = null;

  for (const [key, entry] of Object.entries(API)) {
    const [keyMethod, pattern] = key.split(" ");
    if (keyMethod !== method.toUpperCase()) continue;

    const params = (pattern.match(/:[A-Za-z_]+/g) || []).length;
    const regex = new RegExp(
      "^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z_]+/g, "[^/]+") + "$"
    );
    if (regex.test(path) && (!best || params < best.params)) {
      best = { key, entry, params };
    }
  }

  return best ? { key: best.key, entry: best.entry } : null;
}







// -----------------------------------------------------------
// guardRequest
// -----------------------------------------------------------
//
// Checks one request (a backend.js log entry: method, path,
// query, body, json, formData) against the contract. Returns
// the contract match, which guardReply needs — null for an
// endpoint the contract does not list.
//
// Used by:
//   - support/backend.js — every request
// -----------------------------------------------------------

export function guardRequest({ method, path, query, body, json, formData }) {

  const match = contractFor(method, path);
  if (!match) {
    violations.push(`${method} ${path}: not in tests/contract/api.js`);
    return null;
  }

  const { key, entry } = match;
  const request = entry.request || {};

  for (const name of Object.keys(query || {})) {
    if (!(request.query || []).includes(name)) {
      violations.push(`${key}: query parameter "${name}" is not in the contract`);
    }
  }

  const hasBody = body !== undefined && body !== null && body !== "";

  if (request.empty) {
    if (hasBody) violations.push(`${key}: the contract says no body, one was sent`);
    return match;
  }

  if (formData) {
    const names = [...formData.keys()];
    const allowed = request.form || [];
    for (const name of names) {
      if (!allowed.includes(name)) violations.push(`${key}: multipart field "${name}" is not in the contract (${allowed.join(", ")})`);
    }
    const positions = names.filter((name) => allowed.includes(name)).map((name) => allowed.indexOf(name));
    if (positions.some((position, index) => index > 0 && position < positions[index - 1])) {
      violations.push(`${key}: multipart fields out of the contract's order: ${names.join(", ")}`);
    }
    if (new Set(names).size !== names.length) {
      violations.push(`${key}: a multipart field is sent twice: ${names.join(", ")}`);
    }
    return match;
  }

  if (!hasBody) {
    if (request.json || request.jsonList || request.form) {
      violations.push(`${key}: the contract expects a body, none was sent`);
    }
    return match;
  }

  if (json === undefined) {
    violations.push(`${key}: a non-JSON body was sent`);
    return match;
  }

  if (request.jsonList) {
    if (!Array.isArray(json)) {
      violations.push(`${key}: the body must be a JSON array`);
    } else {
      json.forEach((item, index) => checkRequestObject(item, request.jsonList, request.nested, key, `body[${index}]`));
    }
  } else if (request.json) {
    checkRequestObject(json, request.json, request.nested, key, "body");
  } else {
    violations.push(`${key}: the contract lists no request body, one was sent`);
  }

  return match;
}


// Allowed-fields check of one request object and its nested
// lists (requests may omit fields — only extras are wrong)
function checkRequestObject(value, fields, nested, key, where) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${key}: ${where} must be an object`);
    return;
  }

  for (const name of Object.keys(value)) {
    if (!fields.includes(name)) violations.push(`${key}: ${where} field "${name}" is not in the contract (${fields.join(", ")})`);
  }

  for (const [name, sub] of Object.entries(nested || {})) {
    if (!Array.isArray(value[name])) continue;
    value[name].forEach((item, index) => checkRequestObject(item, sub.list, sub.nested, key, `${where}.${name}[${index}]`));
  }
}







// -----------------------------------------------------------
// guardReply
// -----------------------------------------------------------
//
// Checks a scripted answer — { status, body, headers,
// offContract } from backend.js — against the endpoint's
// response descriptor(s), and returns { wrap } for the JSON
// the page will receive: wrap(parsed) gives the value with
// its objects in read-tracking proxies (see trackReads — or
// unchanged when there is nothing to track). Only 2xx answers
// are checked.
//
// Used by:
//   - support/backend.js — axiosAdapter and fakeFetch
// -----------------------------------------------------------

const passThrough = { wrap: (value) => value };

export function guardReply(match, result) {

  if (!match || result.offContract || result.status < 200 || result.status >= 300) {
    return passThrough;
  }

  const { key, entry } = match;
  const variants = entry.response.oneOf || [entry.response];
  const contentType = String(result.headers?.["content-type"] ?? "");

  if (contentType.includes("application/json")) {
    let parsed;
    try {
      parsed = JSON.parse(result.body);
    } catch {
      violations.push(`${key}: the scripted JSON answer does not parse`);
      return passThrough;
    }

    const structured = variants.filter((variant) => variant.list || variant.object);
    if (structured.length === 0) {
      violations.push(`${key}: the contract says ${describe(variants)}, JSON was scripted`);
      return passThrough;
    }

    // The first descriptor the answer matches exactly decides
    // how its reads are tracked
    const attempts = structured.map((variant) => {
      const found = [];
      checkShape(parsed, variant, "", found);
      return { variant, found };
    });
    const matching = attempts.find((attempt) => attempt.found.length === 0);
    if (!matching) {
      violations.push(`${key}: the scripted answer matches no contract shape — ${attempts.map((attempt) => attempt.found.join("; ")).join(" | ")}`);
      return passThrough;
    }

    return { wrap: (value) => trackReads(value, matching.variant, key, "") };
  }

  if (contentType.startsWith("text/")) {
    if (!variants.some((variant) => variant.text)) {
      violations.push(`${key}: the contract says ${describe(variants)}, plain text was scripted`);
    }
    return passThrough;
  }

  if (!variants.some((variant) => variant.blob)) {
    violations.push(`${key}: the contract says ${describe(variants)}, bytes (${contentType || "no content type"}) were scripted`);
  }
  return passThrough;
}


const describe = (variants) =>
  variants.map((variant) => (variant.list ? "a list" : variant.object ? "an object" : variant.text ? "text" : "bytes")).join(" or ");







// -----------------------------------------------------------
// checkShape / checkObject
// -----------------------------------------------------------
//
// Recursive exact-fields check of a scripted value against a
// descriptor; every mismatch is pushed to `found` naming the
// path inside the value.
//
// Used by:
//   - guardReply (above)
//   - contract/api.test.js — the fixtures against the contract
// -----------------------------------------------------------

export function checkShape(value, shape, at, found) {
  const where = at || "body";

  if (shape.list) {
    if (!Array.isArray(value)) {
      found.push(`${where} must be a list`);
      return;
    }
    value.forEach((item, index) => checkObject(item, shape.list, shape.nested, `${where}[${index}]`, found));
    return;
  }

  if (shape.object) {
    checkObject(value, shape.object, shape.nested, where, found);
  }
}

function checkObject(value, fields, nested, where, found) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    found.push(`${where} must be an object`);
    return;
  }

  const required = fields.filter((field) => !field.endsWith("?"));
  const allowed = fields.map((field) => field.replace(/\?$/, ""));
  const keys = Object.keys(value);

  for (const name of keys) {
    if (!allowed.includes(name)) found.push(`${where} has a field not in the contract: "${name}"`);
  }
  for (const name of required) {
    if (!keys.includes(name)) found.push(`${where} lacks the contract field "${name}"`);
  }
  for (const [name, sub] of Object.entries(nested || {})) {
    if (value[name] !== null && value[name] !== undefined) checkShape(value[name], sub, `${where}.${name}`, found);
  }
}







// -----------------------------------------------------------
// trackReads
// -----------------------------------------------------------
//
// Wraps a JSON answer so that every listed field reads
// through (nested values wrapped with their own descriptor)
// and a read of any other data-like field is recorded as a
// violation — the page relies on something the contract does
// not promise.
//
//   - an object becomes a Proxy (one per object, cached, so
//     identity checks in React and the DataGrid see stable
//     objects); writes go straight to the object (the test
//     page edits answers in place)
//   - a list becomes a REAL array of wrapped items (one per
//     list, cached) — not a Proxy: the DataGrid freezes its
//     `rows` in development builds, and a frozen Proxy target
//     may not report wrapped items (every later rows[i] would
//     throw a TypeError). map/filter/sort/freeze behave as on
//     any array; writes land in that array, which is the one
//     the page holds
//   - anything already wrapped (a wrapped item the page wrote
//     back into an answer) is handed out as it is, never
//     wrapped a second time
//
// Used by:
//   - guardReply (above)
// -----------------------------------------------------------

const tracked = new WeakMap();   // answer object / list → its wrapped version
const wrapped = new WeakSet();   // every wrapped version handed out

// A Proxy must report a non-writable, non-configurable data
// property (a frozen answer object) with its real value
const isFrozenField = (target, property) => {
  const own = Object.getOwnPropertyDescriptor(target, property);
  return Boolean(own && own.configurable === false && own.writable === false);
};

function trackReads(value, shape, key, at) {

  if (value === null || typeof value !== "object") return value;
  if (wrapped.has(value)) return value;
  if (tracked.has(value)) return tracked.get(value);

  let result;

  if (Array.isArray(value)) {
    if (!shape.list) return value;
    const itemShape = { object: shape.list, nested: shape.nested, virtual: shape.virtual, knownBugReads: shape.knownBugReads };
    result = value.map((item, index) => trackReads(item, itemShape, key, `${at || "body"}[${index}]`));
  } else {
    const fields = shape.object || shape.list || [];
    const allowed = new Set(fields.map((field) => field.replace(/\?$/, "")));
    const virtual = new Set(shape.virtual || []);
    const knownBugs = shape.knownBugReads || {};
    const nested = shape.nested || {};

    result = new Proxy(value, {
      get(target, property, receiver) {
        if (typeof property !== "string" || !looksLikeData(property)) {
          return Reflect.get(target, property, receiver);
        }
        if (!allowed.has(property) && !virtual.has(property) && !(property in knownBugs)) {
          violations.push(`${key}: the page read "${property}" on ${at || "body"}, which the contract does not list (${[...allowed].join(", ")})`);
          return Reflect.get(target, property, receiver);
        }
        const field = Reflect.get(target, property, receiver);
        if (!nested[property] || isFrozenField(target, property)) return field;
        return trackReads(field, nested[property], key, `${at || "body"}.${property}`);
      },
    });
  }

  tracked.set(value, result);
  wrapped.add(result);
  return result;
}
