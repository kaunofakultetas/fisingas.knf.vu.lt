// -----------------------------------------------------------
//  [*] Test support — API payload fixtures
//
//  Builders for every JSON shape the frontend receives,
//  mirroring swagger/swagger.yaml field by field: the same
//  names, the 0/1 integer flags, the ""-vs-null blank-field
//  contract of the grading fields, string grades ("7.50"),
//  string points ("1.00"), percent-string link coordinates
//  ("15%") and ISO-8601 timestamps carrying the Vilnius
//  offset ("2026-08-26T19:09:07+03:00", null = never).
//
//  Every builder returns a realistic default and takes
//  overrides, so a test only spells out the fields it is
//  about. ID conventions keep payloads readable:
//    - student test questions 11, 12, ...; their options
//      111, 112 / 121, 122 (question ID × 10 + n)
//    - bank questions 21, 22, ...; their options 211, 212 ...
//
//  Split into:
//
//    apiTimestamp            — Date → the API's timestamp string
//    minutesAgo / daysAgo    — relative API timestamps
//    adminAuth / studentAuth — GET /api/checkauth
//    studentOption / studentQuestion / dealtTest
//                            — GET /api/student/questions
//    adminOption / adminQuestion / questionBank
//                            — GET /api/admin/questions
//    questionLink            — GET /api/phishingpictures/{id}/links
//    studentDetail / blankStudentDetail
//                            — GET /api/admin/students(/{id})
//    answeredOption / studentAnswer
//                            — GET /api/admin/students/{id}/answers
//    administrator           — GET /api/admin/administrators
//    progressEntry / dashboard
//                            — GET /api/admin/home
//    leaderboardEntry / blankLeaderboardEntry
//                            — GET /api/leaderboard
// -----------------------------------------------------------


const VILNIUS_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Vilnius",
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  timeZoneName: "longOffset",
});







// -----------------------------------------------------------
// apiTimestamp
// -----------------------------------------------------------
//
// A Date as the API publishes it: Vilnius wall time with the
// explicit offset ("+03:00" in summer, "+02:00" in winter),
// e.g. "2026-08-26T19:09:07+03:00".
//
// Used by:
//   - minutesAgo / daysAgo (below)
//   - tests that need a timestamp relative to a pinned clock
// -----------------------------------------------------------

export function apiTimestamp(date) {
  const parts = Object.fromEntries(
    VILNIUS_PARTS.formatToParts(date).map((part) => [part.type, part.value])
  );

  // "GMT+03:00" → "+03:00"
  const offset = parts.timeZoneName.replace("GMT", "") || "+00:00";

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}







// -----------------------------------------------------------
// minutesAgo / daysAgo
// -----------------------------------------------------------
//
// API timestamps relative to "now" — Date.now(), so they
// follow a clock pinned with vi.setSystemTime.
//
// Used by:
//   - the last-month / last-day filter tests (students list,
//     leaderboard)
// -----------------------------------------------------------

export const minutesAgo = (minutes) => apiTimestamp(new Date(Date.now() - minutes * 60 * 1000));

export const daysAgo = (days) => apiTimestamp(new Date(Date.now() - days * 24 * 60 * 60 * 1000));







// -----------------------------------------------------------
// adminAuth / studentAuth
// -----------------------------------------------------------
//
// GET /api/checkauth replies (AdminAuth / StudentAuth). `id`
// is the login name, `userid` the numeric key; only students
// carry passcode + phishingtestfinished.
//
// Used by:
//   - the routing / AuthProvider tests (fetch replies)
//   - pages that take authData as a prop (TestFinish)
// -----------------------------------------------------------

export const adminAuth = (overrides = {}) => ({
  id: "admin@knf.vu.lt",
  userid: 1,
  admin: 1,
  ...overrides,
});

export const studentAuth = (overrides = {}) => ({
  id: "JONAS_JONAITIS",
  userid: 5,
  admin: 0,
  passcode: "48291037",
  phishingtestfinished: 0,
  ...overrides,
});







// -----------------------------------------------------------
// studentOption / studentQuestion / dealtTest
// -----------------------------------------------------------
//
// GET /api/student/questions entries (StudentQuestion).
// selectedanswer: 1 = Phishing, 0 = Real, null = unanswered;
// isselected: 1 = ticked, 0 = unticked, null = never touched.
// `question` is the optional "Papildomai" text — "" when
// unset. The frontend POSTs these very objects back as the
// answer state, so their shape is the save payload's shape.
//
// dealtTest(n) builds questions 11..(10+n), each with two
// options (question ID × 10 + 1 / + 2).
//
// Used by:
//   - the TestHome tests (GET replies and POST expectations)
// -----------------------------------------------------------

export const studentOption = (overrides = {}) => ({
  answeroptionid: 111,
  answeroption: "Siuntėjo adresas neatitinka įmonės domeno",
  isselected: null,
  ...overrides,
});

export const studentQuestion = (overrides = {}) => {
  const questionid = overrides.questionid ?? 11;

  return {
    questionid,
    selectedanswer: null,
    question: "",
    questionoptions: [
      studentOption({ answeroptionid: questionid * 10 + 1, answeroption: "Siuntėjo adresas neatitinka įmonės domeno" }),
      studentOption({ answeroptionid: questionid * 10 + 2, answeroption: "Nuoroda veda į svetimą svetainę" }),
    ],
    ...overrides,
  };
};

export const dealtTest = (count) =>
  Array.from({ length: count }, (_, index) => studentQuestion({ questionid: 11 + index }));







// -----------------------------------------------------------
// adminOption / adminQuestion / questionBank
// -----------------------------------------------------------
//
// GET /api/admin/questions (AdminQuestion + the counters).
// rightoptionanswer: 1 = should be ticked, 0 = should not,
// null = never set. questionBank() derives the counters from
// the questions like the backend does — and, per the
// contract, an EMPTY bank has phishingcount / goodcount /
// enabledcount / optionscount null, not 0.
// phishingtestsize is null until an admin saves it once.
//
// Used by:
//   - the Questions / QuestionsList / QuestionCard tests
// -----------------------------------------------------------

export const adminOption = (overrides = {}) => ({
  optionid: 211,
  optiontext: "Siuntėjo adresas neatitinka įmonės domeno",
  rightoptionanswer: 1,
  ...overrides,
});

export const adminQuestion = (overrides = {}) => {
  const questionid = overrides.questionid ?? 21;

  return {
    questionid,
    isenabled: 1,
    isphishing: 1,
    questiontext: "",
    questionoptions: [
      adminOption({ optionid: questionid * 10 + 1, optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightoptionanswer: 1 }),
      adminOption({ optionid: questionid * 10 + 2, optiontext: "Nuoroda veda į svetimą svetainę", rightoptionanswer: 0 }),
    ],
    created: "2026-08-26T19:09:07+03:00",
    ...overrides,
  };
};

export const questionBank = (questions = [adminQuestion()], overrides = {}) => {
  const empty = questions.length === 0;
  const count = (predicate) => (empty ? null : questions.filter(predicate).length);

  return {
    questioncount: questions.length,
    phishingcount: count((question) => question.isphishing === 1),
    goodcount: count((question) => question.isphishing === 0),
    enabledcount: count((question) => question.isenabled === 1),
    optionscount: empty ? null : questions.reduce((sum, question) => sum + question.questionoptions.length, 0),
    phishingtestsize: 12,
    questions,
    ...overrides,
  };
};







// -----------------------------------------------------------
// questionLink
// -----------------------------------------------------------
//
// GET /api/phishingpictures/{id}/links entries (QuestionLink):
// coordinates as whole-number PERCENT STRINGS relative to the
// image ("15%"), null when a stored value cannot be parsed.
// (The POST sends 0–1 fractions instead.)
//
// Used by:
//   - the InteractiveImage / InteractiveImageEditor tests
// -----------------------------------------------------------

export const questionLink = (overrides = {}) => ({
  id: 1,
  url: "http://example.com",
  x: "15%",
  y: "42%",
  width: "20%",
  height: "3%",
  ...overrides,
});







// -----------------------------------------------------------
// studentDetail / blankStudentDetail
// -----------------------------------------------------------
//
// GET /api/admin/students entries and /api/admin/students/{id}
// (StudentDetail). testgrade is a fixed 2-decimal STRING.
// blankStudentDetail is the blank-field contract of a student
// without a dealt test: grading fields "" (not 0),
// answeredquestioncount null.
//
// Used by:
//   - the students list, StudentInformation and TestFinish
//     tests
// -----------------------------------------------------------

export const studentDetail = (overrides = {}) => ({
  id: 5,
  username: "JONAS_JONAITIS",
  passcode: "48291037",
  questioncount: 12,
  answeredquestioncount: 12,
  totalidentifiedcorrectly: 10,
  fullycorrectcount: 8,
  fullycorrectpercentage: 66,
  totaloptionscount: 30,
  totalcorrectoptionscount: 27,
  testgrade: "7.50",
  isfinished: 1,
  lastseen: "2026-08-26T19:09:07+03:00",
  registrationtime: "2026-08-26T18:55:00+03:00",
  status: 1,
  ...overrides,
});

export const blankStudentDetail = (overrides = {}) => studentDetail({
  questioncount: "",
  answeredquestioncount: null,
  totalidentifiedcorrectly: "",
  fullycorrectcount: "",
  fullycorrectpercentage: "",
  totaloptionscount: "",
  totalcorrectoptionscount: "",
  testgrade: "",
  isfinished: 0,
  ...overrides,
});







// -----------------------------------------------------------
// answeredOption / studentAnswer
// -----------------------------------------------------------
//
// GET /api/admin/students/{id}/answers entries
// (StudentAnswer). NOTE the question ID field is `id` — this
// payload has NO `questionid`. answerpoints is a "0.00".."1.00"
// STRING; isphishinganswer null = never answered.
//
// Used by:
//   - the StudentAnswers / StudentTestSummaryTable / TestFinish
//     tests
// -----------------------------------------------------------

export const answeredOption = (overrides = {}) => ({
  optiontext: "Siuntėjo adresas neatitinka įmonės domeno",
  rightansweroption: 1,
  selectedansweroption: 1,
  ...overrides,
});

export const studentAnswer = (overrides = {}) => ({
  id: 11,
  questiontext: "",
  isphishinganswer: 1,
  isphishing: 1,
  totaloptionscount: 2,
  correctoptionscount: 2,
  answerpoints: "1.00",
  answeredoptions: [
    answeredOption({ optiontext: "Siuntėjo adresas neatitinka įmonės domeno", rightansweroption: 1, selectedansweroption: 1 }),
    answeredOption({ optiontext: "Nuoroda veda į svetimą svetainę", rightansweroption: 0, selectedansweroption: 0 }),
  ],
  ...overrides,
});







// -----------------------------------------------------------
// administrator
// -----------------------------------------------------------
//
// GET /api/admin/administrators entries (Administrator);
// password hashes are never part of the payload.
//
// Used by:
//   - the AdministratorsList / AddEditAdministrator tests
// -----------------------------------------------------------

export const administrator = (overrides = {}) => ({
  id: 1,
  email: "admin@knf.vu.lt",
  enabled: 1,
  lastseen: "2026-08-26T19:09:07+03:00",
  ...overrides,
});







// -----------------------------------------------------------
// progressEntry / dashboard
// -----------------------------------------------------------
//
// GET /api/admin/home (DashboardData). studentsprogress only
// lists students active in the last 30 minutes WITH a dealt
// test, so questioncount is always a number there.
// phishingtestsize is null until an admin saves it once.
//
// Used by:
//   - the admin Home (dashboard) tests
// -----------------------------------------------------------

export const progressEntry = (overrides = {}) => ({
  studentid: 5,
  username: "JONAS_JONAITIS",
  questioncount: 12,
  answeredquestioncount: 6,
  isfinished: 0,
  lastseen: "2026-08-26T19:09:07+03:00",
  ...overrides,
});

export const dashboard = (overrides = {}) => ({
  studentscount: 42,
  enabledquestionscount: 18,
  totalquestionscount: 20,
  phishingtestsize: 12,
  studentsprogress: [progressEntry()],
  ...overrides,
});







// -----------------------------------------------------------
// leaderboardEntry / blankLeaderboardEntry
// -----------------------------------------------------------
//
// GET /api/leaderboard entries (LeaderboardEntry) — public,
// no passcodes. Same blank-field contract as the admin list:
// a student without a dealt test has questioncount "",
// answeredquestioncount null and testgrade "".
//
// Used by:
//   - the LeaderboardTable tests
// -----------------------------------------------------------

export const leaderboardEntry = (overrides = {}) => ({
  id: 5,
  username: "JONAS_JONAITIS",
  questioncount: 12,
  answeredquestioncount: 12,
  testgrade: "7.50",
  isfinished: 1,
  lastseen: "2026-08-26T19:09:07+03:00",
  ...overrides,
});

export const blankLeaderboardEntry = (overrides = {}) => leaderboardEntry({
  questioncount: "",
  answeredquestioncount: null,
  testgrade: "",
  isfinished: 0,
  ...overrides,
});
