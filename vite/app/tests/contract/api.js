// -----------------------------------------------------------
//  [*] Test contract — the API as the SPA knows it
//
//  The frontend's own, hand-kept copy of the backend's
//  contract (swagger/swagger.yaml): for every endpoint the SPA
//  calls, exactly which fields the request carries and exactly
//  which fields the answer holds. support/contractGuard.js
//  enforces it on every exchange with the fake backend: a
//  request to an unlisted endpoint or with an unlisted field,
//  a scripted success answer whose objects do not have exactly
//  these fields, or a page READING a field not listed here
//  fails the test. The backend keeps its own copy in its own
//  suite (test_contract.py); when an endpoint changes, both
//  copies move by hand — that is the point of having two.
//
//  Descriptors:
//    request  { json: [...] }      — a JSON object body: allowed
//                                    top-level fields
//             { jsonList: [...] }  — a JSON ARRAY body: allowed
//                                    fields of every item
//             { form: [...] }      — multipart fields, in order
//             { empty: true }      — a POST that sends no body
//             `nested` — per field holding a list of objects,
//             its own { list: [...] } of allowed item fields
//    response { list: [...] }      — an array of objects with
//                                    exactly these fields
//             { object: [...] }    — one such object
//                                    ({ object: [] } is `{}`)
//             { text: true }       — a plain-text body (Django's
//                                    HttpResponse: "OK", messages,
//                                    the "Error: Not Admin" gate)
//             { blob: true }       — bytes (an image)
//             { oneOf: [...] }     — any one of these descriptors
//    "field?" is optional; `nested` describes a field holding a
//    list or an object with its own descriptor; `virtual` names
//    fields a page may READ although the answer never carries
//    them (DataGrid columns without data); `knownBugReads` maps
//    a field the page wrongly reads to its known-bug entry
//    (tests/knownBugs.test.jsx) — allowed until fixed.
//
//  Only 2xx answers are shape-checked: the error conventions
//  of this API are mixed (plain text, {type, reason},
//  {status, error}, {error}) and are pinned by the page tests.
//  Types are not checked here either — integer 0/1 flags,
//  string grades ("7.50"), percent strings ("15%") and ISO
//  timestamps are pinned by the fixtures (support/fixtures.js).
// -----------------------------------------------------------


// Row shapes shared by several endpoints — one definition each
const STUDENT_DETAIL = [
  "id", "username", "passcode", "questioncount", "answeredquestioncount",
  "totalidentifiedcorrectly", "fullycorrectcount", "fullycorrectpercentage",
  "totaloptionscount", "totalcorrectoptionscount", "testgrade", "isfinished",
  "lastseen", "registrationtime", "status",
];

const STUDENT_QUESTION = {
  list: ["questionid", "selectedanswer", "question", "questionoptions"],
  nested: { questionoptions: { list: ["answeroptionid", "answeroption", "isselected"] } },
};

const QUESTION_LINK = ["id", "url", "x", "y", "width", "height"];

// The admin GETs answer a NON-admin session with this plain
// text and HTTP 200 (swagger: "Role-gate quirk")
const ROLE_GATE = { text: true };







// -----------------------------------------------------------
// API
// -----------------------------------------------------------
//
// "METHOD /path" → { request?, response }. A ":id" segment
// matches any one path segment; the guard picks the most
// specific key for a request.
//
// Used by:
//   - support/contractGuard.js — every fake-backend exchange
//   - contract/api.test.js — the endpoint set, the shapes and
//     the fixtures
// -----------------------------------------------------------

export const API = {

  // ---- session and identity
  "POST /api/login": {
    request: { json: ["username", "password"] },
    response: { text: true },
  },
  "POST /api/logout": {
    request: { empty: true },
    response: { text: true },
  },
  "GET /api/checkauth": {
    // AdminAuth / StudentAuth — the student-only fields are
    // optional; the route guards read phishingtestfinished on
    // whatever session there is
    response: { object: ["id", "userid", "admin", "passcode?", "phishingtestfinished?"] },
  },

  // ---- registration
  "POST /api/student/register": {
    request: { json: ["username"] },
    response: {
      oneOf: [
        { object: ["status", "username", "accessCode"] },
        { object: ["status", "error"] },
      ],
    },
  },

  // ---- the test
  "GET /api/student/questions": {
    // `{}` once the test is finished (or for an admin session)
    response: { oneOf: [STUDENT_QUESTION, { object: [] }] },
  },
  "POST /api/student/questions": {
    // The page POSTs back the very objects the GET delivered —
    // `question` and `answeroption` (the display texts) ride
    // along; the backend reads only the ids and the answers
    request: {
      jsonList: ["questionid", "selectedanswer", "question", "questionoptions"],
      nested: { questionoptions: { list: ["answeroptionid", "answeroption", "isselected"] } },
    },
    response: { oneOf: [{ text: true }, { object: [] }] },
  },
  "GET /api/student/finish": {
    response: { object: [] },
  },

  // ---- the question bank
  "GET /api/admin/questions": {
    response: {
      oneOf: [
        {
          object: ["questioncount", "phishingcount", "goodcount", "enabledcount", "optionscount", "phishingtestsize", "questions"],
          nested: {
            questions: {
              list: ["questionid", "isenabled", "isphishing", "questiontext", "questionoptions", "created"],
              nested: { questionoptions: { list: ["optionid", "optiontext", "rightoptionanswer"] } },
            },
          },
        },
        ROLE_GATE,
      ],
    },
  },
  "POST /api/admin/questions/createnewoption": {
    request: { json: ["questionid"] },
    response: { object: ["new_option_id"] },
  },
  "POST /api/admin/questions/updatequestion": {
    request: {
      json: ["questionid", "isenabled", "isphishing", "questiontext", "questionoptions"],
      nested: { questionoptions: { list: ["optionid", "optiontext", "rightoptionanswer"] } },
    },
    response: { object: ["status"] },
  },
  "POST /api/admin/questions/deleteoption": {
    request: { json: ["optionid"] },
    response: { object: ["status"] },
  },
  "POST /api/admin/questions/deletequestion": {
    request: { json: ["questionid"] },
    response: { object: ["status"] },
  },

  // ---- question images and their link areas
  "POST /api/phishingpictures": {
    request: { form: ["image"] },
    response: { object: ["type", "message"] },
  },
  "GET /api/phishingpictures/:id": {
    // Only ever loaded by <img src> — never through axios/fetch
    response: { blob: true },
  },
  "GET /api/phishingpictures/:id/links": {
    response: { list: QUESTION_LINK },
  },
  "POST /api/phishingpictures/:id/links": {
    // Each area carries its `id` too (the stored one, or a
    // Date.now() one for a new area) — the backend replaces all
    // areas and ignores it
    request: {
      json: ["areas"],
      nested: { areas: { list: ["id", "url", "x", "y", "width", "height"] } },
    },
    response: { text: true },
  },

  // ---- students
  "GET /api/admin/students": {
    response: { oneOf: [{ list: STUDENT_DETAIL }, ROLE_GATE] },
  },
  "GET /api/admin/students/:id": {
    response: { oneOf: [{ object: STUDENT_DETAIL }, ROLE_GATE] },
  },
  "POST /api/admin/students/:id/delete": {
    // The page posts an empty object
    request: { json: [] },
    response: { object: ["status"] },
  },
  "GET /api/admin/students/:id/answers": {
    response: {
      oneOf: [
        {
          list: ["id", "questiontext", "isphishinganswer", "isphishing", "totaloptionscount", "correctoptionscount", "answerpoints", "answeredoptions"],
          nested: { answeredoptions: { list: ["optiontext", "rightansweroption", "selectedansweroption"] } },
          // StudentTestSummaryTable's picture and verdict columns
          // are render-only — the grid still reads row[field]
          virtual: ["phishingpicture", "identified"],
          knownBugReads: { questionid: "KB-17" },
        },
        ROLE_GATE,
      ],
    },
  },

  // ---- administrators
  "GET /api/admin/administrators": {
    response: { oneOf: [{ list: ["id", "email", "enabled", "lastseen"] }, ROLE_GATE] },
  },
  "POST /api/admin/administrators": {
    // insertupdate sends all five, delete only action + id
    request: { json: ["action", "id", "email", "enabled", "password"] },
    response: { oneOf: [{ object: ["type", "reason?"] }, ROLE_GATE] },
  },

  // ---- dashboard
  "GET /api/admin/home": {
    response: {
      oneOf: [
        {
          object: ["studentscount", "enabledquestionscount", "totalquestionscount", "phishingtestsize", "studentsprogress"],
          nested: {
            studentsprogress: { list: ["studentid", "username", "questioncount", "answeredquestioncount", "isfinished", "lastseen"] },
          },
        },
        ROLE_GATE,
      ],
    },
  },
  "POST /api/admin/update/phishingtestsize": {
    request: { json: ["phishingtestsize"] },
    response: { object: ["status"] },
  },

  // ---- public: leaderboard and projector slides
  "GET /api/leaderboard": {
    response: { list: ["id", "username", "questioncount", "answeredquestioncount", "testgrade", "isfinished", "lastseen"] },
  },
  "GET /api/leaderboard/nextslide": {
    response: { blob: true },
  },
};
