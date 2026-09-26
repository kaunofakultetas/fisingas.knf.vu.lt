// -----------------------------------------------------------
//  [*] Test support — the fake backend
//
//  An in-memory stand-in for the Django API that BOTH network
//  clients of the app are routed to:
//
//    - axios — setup.js installs `axiosAdapter` as
//      axios.defaults.adapter. The adapter runs AFTER axios's
//      request transforms (a posted object arrives as the exact
//      JSON string that would go over the wire) and BEFORE its
//      response handling (replies are status-checked and
//      JSON-parsed by axios itself, like with the real server)
//    - fetch — setup.js stubs globalThis.fetch with `fakeFetch`
//
//  A test declares routes, drives the UI, then inspects the
//  request log:
//
//    backend.on("GET", "/api/leaderboard", reply.json([...]))
//    backend.once("POST", "/api/login", reply.text("OK"))
//    backend.requests("POST", "/api/login")[0].json
//
//  Routes: `once` routes are consumed first (in declaration
//  order); otherwise the LATEST matching `on` route answers,
//  so re-declaring a route changes the answer from then on.
//  A handler is a reply object or a function
//  (request) => reply | Promise<reply> — return a pending
//  promise (see `deferred`) to hold a request in flight.
//
//  Unrouted requests are answered 404 AND recorded — setup.js
//  fails the test when any are left, so every request a
//  component makes has to be declared (and pinned) by its test.
//  A route handler that throws, rejects or returns no reply is
//  recorded the same way (the request fails too).
//
//  Every exchange also passes the API contract guard
//  (support/contractGuard.js, tests/contract/api.js): the
//  request must be on the contract, a scripted 2xx answer must
//  match it exactly, and a 2xx JSON answer reaches the page
//  wrapped so that reading an unlisted field is recorded. A
//  reply that is off-contract ON PURPOSE (robustness tests)
//  says so: reply.json(value, 200, { offContract: true }).
//
//  Split into:
//
//    reply          — reply builders (json/text/status/...)
//    deferred       — a promise the test settles by hand
//    backend        — routes + request log (the test API)
//    axiosAdapter   — axios entry point
//    fakeFetch      — fetch entry point
// -----------------------------------------------------------

import { AxiosError, AxiosHeaders } from "axios";

import { guardReply, guardRequest } from "./contractGuard";


const STATUS_TEXT = {
  200: "OK", 201: "Created", 204: "No Content",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed",
  500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
};

const NETWORK_ERROR = Symbol("network error");

const state = {
  routes: [],
  log: [],
  unhandled: [],
  allowUnhandled: false,
};







// -----------------------------------------------------------
// reply
// -----------------------------------------------------------
//
// What the fake server answers. Bodies are kept as TEXT (like
// on the wire) — axios and fetch parse them the way they parse
// real responses:
//
//   reply.json(value, status = 200)  — JSON body
//   reply.text(text, status = 200)   — plain-text body (Django's
//                                       HttpResponse: text/html)
//   reply.status(code, text = "")    — a bare status, e.g. 500
//   reply.image(type = "image/png")  — a small binary-ish body
//   reply.networkError()             — no response at all
//                                       (connection refused)
//
// json / text / image take a last { offContract: true } option
// for answers that break the contract on purpose (the contract
// guard then leaves them alone).
//
// Used by:
//   - every test declaring backend routes
// -----------------------------------------------------------

export const reply = {
  json: (value, status = 200, { offContract = false } = {}) => ({
    status,
    body: JSON.stringify(value),
    headers: { "content-type": "application/json" },
    offContract,
  }),

  text: (text, status = 200, { offContract = false } = {}) => ({
    status,
    body: String(text),
    headers: { "content-type": "text/html; charset=utf-8" },
    offContract,
  }),

  status: (status, text = "") => reply.text(text, status),

  image: (type = "image/png", status = 200, { offContract = false } = {}) => ({
    status,
    body: "fake image bytes",
    headers: { "content-type": type },
    offContract,
  }),

  networkError: () => ({ [NETWORK_ERROR]: true }),
};







// -----------------------------------------------------------
// deferred
// -----------------------------------------------------------
//
// A promise plus its resolve/reject, for holding a request in
// flight until the test decides:
//
//   const save = deferred();
//   backend.once("POST", "/api/student/questions", () => save.promise);
//   ... the UI waits ...
//   await act(async () => save.resolve(reply.text("OK")));
//
// Used by:
//   - tests of loading states, ordering and in-flight races
// -----------------------------------------------------------

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}







// -----------------------------------------------------------
// backend
// -----------------------------------------------------------
//
// The test-facing API:
//
//   on(method, path, handler)    — answer every matching request
//   once(method, path, handler)  — answer the next one only
//   requests(method?, path?)     — the log, in call order; each
//                                   entry: { client ("axios" |
//                                   "fetch"), method, url (path +
//                                   query), path, query (object),
//                                   headers (lower-case names),
//                                   body (raw), json (parsed JSON
//                                   body or undefined), formData
//                                   (FormData body or undefined),
//                                   withCredentials (axios config),
//                                   credentials (fetch option) }
//   lastRequest(method, path)    — the newest matching entry
//   unhandled()                  — requests no route answered
//                                   (or whose handler failed)
//   allowUnhandled()             — this test tolerates them
//   reset()                      — setup.js, between tests
//
// `path` matches the URL path without the query string: a
// string (exact), a RegExp, or a predicate function.
//
// Used by:
//   - every component/page test
//   - setup.js (reset + the unhandled-request check)
// -----------------------------------------------------------

const pathMatches = (pattern, path) => {
  if (typeof pattern === "string") return pattern === path;
  if (pattern instanceof RegExp) return pattern.test(path);
  return Boolean(pattern(path));
};

const routeMatches = (route, method, path) =>
  route.method === method && pathMatches(route.path, path);

const logMatches = (entry, method, path) =>
  (method === undefined || entry.method === method.toUpperCase())
  && (path === undefined || pathMatches(path, entry.path));

export const backend = {

  on(method, path, handler) {
    state.routes.push({ method: method.toUpperCase(), path, handler, once: false });
  },

  once(method, path, handler) {
    state.routes.push({ method: method.toUpperCase(), path, handler, once: true });
  },

  requests(method, path) {
    return state.log.filter((entry) => logMatches(entry, method, path));
  },

  lastRequest(method, path) {
    const matching = backend.requests(method, path);
    return matching[matching.length - 1];
  },

  unhandled() {
    return [...state.unhandled];
  },

  allowUnhandled() {
    state.allowUnhandled = true;
  },

  unhandledAllowed() {
    return state.allowUnhandled;
  },

  reset() {
    state.routes = [];
    state.log = [];
    state.unhandled = [];
    state.allowUnhandled = false;
  },
};







// -----------------------------------------------------------
// answer (internal)
// -----------------------------------------------------------
//
// Logs one request, runs it past the contract guard and
// produces its reply: the first unconsumed `once` route, else
// the latest matching `on` route, else an unhandled 404.
// Handlers may return a promise. Resolves with { result,
// guard } — guard.wrap(parsed) gives a 2xx JSON answer its
// read-tracking proxies.
//
// A handler that throws, rejects or produces no reply is a
// broken test, not a server failure: it is recorded with the
// unhandled requests (setup.js fails the test on it) — the
// request itself still fails, but the page's own error
// handling can no longer hide the mistake.
//
// Used by:
//   - axiosAdapter, fakeFetch (below)
// -----------------------------------------------------------

async function answer(request) {

  state.log.push(request);
  const contract = guardRequest(request);

  const onceRoute = state.routes.find((route) => route.once && routeMatches(route, request.method, request.path));
  const onRoute = [...state.routes].reverse().find((route) => !route.once && routeMatches(route, request.method, request.path));
  const route = onceRoute ?? onRoute;

  if (!route) {
    state.unhandled.push(`${request.method} ${request.url}`);
    const result = reply.status(404, "Not Found");
    return { result, guard: guardReply(contract, result) };
  }

  if (route.once) {
    state.routes.splice(state.routes.indexOf(route), 1);
  }

  let result;
  try {
    result = typeof route.handler === "function" ? await route.handler(request) : route.handler;
  } catch (error) {
    state.unhandled.push(`${request.method} ${request.url} — the route's handler failed: ${error?.message ?? error}`);
    throw error;
  }

  if (!result || (result.status === undefined && !result[NETWORK_ERROR])) {
    const problem = `fake backend: the handler for ${request.method} ${request.path} returned no reply`;
    state.unhandled.push(`${request.method} ${request.url} — ${problem}`);
    throw new Error(problem);
  }

  const guard = result[NETWORK_ERROR] ? null : guardReply(contract, result);
  return { result, guard };
}


// A 2xx JSON answer as the page receives it — parsed and in
// its read-tracking proxies; anything else stays text
function receivedJson(result, guard) {
  const isJson = String(result.headers?.["content-type"] ?? "").includes("application/json");
  if (!isJson || result.status < 200 || result.status >= 300) return undefined;
  try {
    return { value: guard.wrap(JSON.parse(result.body)) };
  } catch {
    return undefined;
  }
}


// "/api/x?a=1" (relative, as the app writes it) → parts
function splitUrl(rawUrl) {
  const url = new URL(rawUrl, "http://localhost");
  return {
    url: url.pathname + url.search,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
  };
}


// JSON.parse when the body is JSON text, else undefined
function parseJson(body) {
  if (typeof body !== "string" || body === "") return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}


const isFormData = (body) => typeof FormData !== "undefined" && body instanceof FormData;


const lowerCaseKeys = (headers) =>
  Object.fromEntries(Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));







// -----------------------------------------------------------
// axiosAdapter
// -----------------------------------------------------------
//
// Installed as axios.defaults.adapter. Mirrors what the real
// XHR adapter hands back to axios:
//   - a reply → { data: <body text>, status, statusText,
//     headers, config, request }; axios then JSON-parses the
//     text (a non-JSON body such as "OK" stays a string). A 2xx
//     JSON answer is handed over already parsed, in the
//     contract guard's read-tracking proxies — axios passes
//     non-string data through untouched, so the page receives
//     exactly what it would, only watched
//   - a non-2xx status → rejected with an AxiosError carrying
//     `response` (ERR_BAD_REQUEST for 4xx, ERR_BAD_RESPONSE
//     for anything else) — exactly what axios's own settle()
//     does
//   - reply.networkError() → AxiosError "Network Error"
//     (ERR_NETWORK) without a response — what the XHR
//     adapter's onerror rejects with
//
// Used by:
//   - setup.js (axios.defaults.adapter = axiosAdapter)
// -----------------------------------------------------------

export async function axiosAdapter(config) {

  const headers = config.headers instanceof AxiosHeaders ? config.headers.toJSON() : config.headers;
  const body = config.data;

  const request = {
    client: "axios",
    method: (config.method ?? "get").toUpperCase(),
    ...splitUrl(config.url),
    headers: lowerCaseKeys(headers),
    body,
    json: parseJson(body),
    formData: isFormData(body) ? body : undefined,
    withCredentials: config.withCredentials,
    credentials: undefined,
  };

  // What the real adapter exposes as error.request / response.request
  const xhr = { fake: true, url: request.url };

  const { result, guard } = await answer(request);

  if (result[NETWORK_ERROR]) {
    const error = new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, xhr);
    error.event = null;
    throw error;
  }

  const parsed = receivedJson(result, guard);

  const response = {
    data: parsed ? parsed.value : result.body,
    status: result.status,
    statusText: STATUS_TEXT[result.status] ?? "",
    headers: AxiosHeaders.from(result.headers),
    config,
    request: xhr,
  };

  const validateStatus = config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    return response;
  }

  throw new AxiosError(
    `Request failed with status code ${response.status}`,
    response.status >= 400 && response.status < 500 ? AxiosError.ERR_BAD_REQUEST : AxiosError.ERR_BAD_RESPONSE,
    config,
    xhr,
    response
  );
}







// -----------------------------------------------------------
// FakeResponse (internal)
// -----------------------------------------------------------
//
// The small slice of the Fetch Response the app uses: ok,
// status, statusText, headers.get, text(), json() (rejects on
// a non-JSON body, like the real one — a 2xx JSON answer comes
// back in the contract guard's read-tracking proxies) and
// blob(). Reading the body of a request whose signal was
// aborted rejects, as it does in a browser.
//
// Used by:
//   - fakeFetch (below)
// -----------------------------------------------------------

class FakeResponse {

  constructor(result, url, guard, signal) {
    this.status = result.status;
    this.statusText = STATUS_TEXT[result.status] ?? "";
    this.url = url;
    this.body = result.body;
    this.result = result;
    this.guard = guard;
    this.signal = signal;

    const headers = lowerCaseKeys(result.headers);
    this.headers = {
      get: (name) => headers[name.toLowerCase()] ?? null,
      has: (name) => name.toLowerCase() in headers,
    };
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  async text() {
    this.throwIfAborted();
    return this.body;
  }

  async json() {
    this.throwIfAborted();
    const parsed = receivedJson(this.result, this.guard);
    return parsed ? parsed.value : JSON.parse(this.body);
  }

  async blob() {
    this.throwIfAborted();
    return new Blob([this.body], { type: this.headers.get("content-type") ?? "" });
  }

  throwIfAborted() {
    if (this.signal?.aborted) {
      throw abortReason(this.signal);
    }
  }
}


// What fetch rejects with once its signal is aborted: the
// signal's reason (an AbortError DOMException by default)
const abortReason = (signal) => signal.reason ?? new DOMException("This operation was aborted", "AbortError");


// Settles like `pending` — unless the signal aborts first; then
// it rejects the way fetch does and the late reply is dropped
function unlessAborted(pending, signal) {
  if (!signal) return pending;

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}







// -----------------------------------------------------------
// fakeFetch
// -----------------------------------------------------------
//
// Stubbed in as globalThis.fetch. A reply resolves to a
// FakeResponse whatever its status (fetch never rejects on
// HTTP errors); reply.networkError() rejects with the
// TypeError a browser throws when the server is unreachable.
// An AbortSignal (init.signal) is honoured like a browser does:
// already aborted → rejected before anything is sent; aborted
// while the reply is pending → rejected, the reply dropped.
//
// Used by:
//   - setup.js (vi.stubGlobal("fetch", fakeFetch))
// -----------------------------------------------------------

export async function fakeFetch(input, init = {}) {

  const rawUrl = typeof input === "string" ? input : (input?.url ?? String(input));
  const body = init.body;
  const signal = init.signal ?? input?.signal ?? null;

  if (signal?.aborted) {
    throw abortReason(signal);
  }

  const request = {
    client: "fetch",
    method: (init.method ?? input?.method ?? "GET").toUpperCase(),
    ...splitUrl(rawUrl),
    headers: lowerCaseKeys(init.headers),
    body,
    json: parseJson(body),
    formData: isFormData(body) ? body : undefined,
    withCredentials: undefined,
    credentials: init.credentials,
  };

  const { result, guard } = await unlessAborted(answer(request), signal);

  if (result[NETWORK_ERROR]) {
    throw new TypeError("Failed to fetch");
  }

  return new FakeResponse(result, request.url, guard, signal);
}
