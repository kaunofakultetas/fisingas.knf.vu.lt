// -----------------------------------------------------------
//  [*] Student — Sidebar
//
//  Right-hand panel of the test page: a grid of numbered
//  buttons (one per question) for jumping around the test,
//  an answered-counter, and the "Užbaigti testą" button.
//
//  Button colors show progress: burgundy = answered, white
//  with a border = not answered yet; the current question
//  gets a pink ring.
//
//  Finishing navigates with a full page load on purpose — the
//  session is re-checked and the finished student can no
//  longer return to the test.
//
//  Used by:
//    - TestHome — the student test page
// -----------------------------------------------------------


export default function StudentSidebar({ currentQuestionIndex, setCurrentQuestionIndex, questionsData }) {

  const answeredCount = questionsData.filter((question) => question.selectedanswer !== null).length;

  return (
    <div className="w-1/5 max-w-[250px] shrink-0 bg-white pt-[100px] pb-10 px-6 border-l border-gray-200">

      {/* Progress summary */}
      <h2 className="text-lg font-bold text-gray-800 mb-1">Klausimai</h2>
      <div className="text-sm text-gray-400 mb-2">
        Atsakyta: {answeredCount} / {questionsData.length}
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-[rgb(123,0,63)] transition-[width] duration-300"
          style={{ width: `${(answeredCount / questionsData.length) * 100}%` }}
        />
      </div>

      {/* Question jump buttons */}
      <div className="grid grid-cols-3 gap-2">
        {questionsData.map((question, index) => {
          const answered = question.selectedanswer !== null;
          const current = currentQuestionIndex === index;

          return (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentQuestionIndex(index)}
              className={`h-9 rounded-lg text-sm font-semibold cursor-pointer transition-all
                ${answered
                  ? 'bg-[rgb(123,0,63)] text-white hover:bg-[rgb(230,65,100)]'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-[rgb(230,65,100)] hover:text-[rgb(123,0,63)]'
                }
                ${current ? 'ring-2 ring-[rgb(230,65,100)] ring-offset-1' : ''}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      {/* Finish the test */}
      <button
        type="button"
        onClick={() => { window.location.href = "/student/finish" }}
        className="mt-8 w-full py-2.5 rounded-xl bg-[rgb(123,0,63)] text-white font-semibold
          hover:bg-[rgb(230,65,100)] transition-colors cursor-pointer shadow-[0_4px_14px_rgba(123,0,63,0.25)]"
      >
        Užbaigti testą
      </button>

    </div>
  );
}
