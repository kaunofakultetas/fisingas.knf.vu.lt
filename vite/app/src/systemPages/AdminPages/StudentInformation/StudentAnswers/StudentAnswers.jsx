// -----------------------------------------------------------
//  [*] Admin — StudentAnswers
//
//  The full per-question answer review: one card per question
//  with the email screenshot (hoverable link areas) next to a
//  table comparing the correct answers with what the student
//  picked.
//
//  Visual language:
//    - the "Teisingas" column is the answer key — neutral
//      grey, it is never judged
//    - the "Atsakyta" column carries the verdict — solid
//      green when it matches the key, solid red when not
//      (missed rows also get a faint red wash)
//    - each card has a colored left edge and a points chip:
//      green = full points, amber = partial, red = zero
//
//  "Neatsakė" shows when the question was never answered.
//
//  Data comes from GET /api/admin/students/<id>/answers —
//  the backend also allows students to read their own.
//
//  Split into (root component last):
//
//    ResultCell     — one ✓/— cell (neutral key or verdict)
//    IsPhishingRow  — the "Ar tai fišingas?" comparison row
//    OptionRow      — one checkbox-option comparison row
//    AnswerCard     — one question: header + image + table
//    StudentAnswers — the list (default export)
// -----------------------------------------------------------

import useFetchData from "@/hooks/useFetchData";

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';

import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";







// -----------------------------------------------------------
// ResultCell
// -----------------------------------------------------------
//
// One cell of the comparison table. Three variants:
//
//   key     — the answer key: quiet grey, never judged
//   correct — the student matched the key: solid green
//   wrong   — the student missed: solid red
//
// A check mark means "selected", a dash "not selected";
// arbitrary content (e.g. "Neatsakė") renders as a chip in
// the same style.
//
// Used by:
//   - IsPhishingRow, OptionRow (below)
// -----------------------------------------------------------

function ResultCell({ variant, checked, children }) {

  const styles = {
    key:     'bg-gray-100 text-gray-500',
    correct: 'bg-green-600 text-white shadow-[0_2px_6px_rgba(22,163,74,0.35)]',
    wrong:   'bg-red-500 text-white shadow-[0_2px_6px_rgba(239,68,68,0.35)]',
  };

  return (
    <td className="text-center py-2">
      {children !== undefined ? (
        <span className={`inline-block text-xs font-bold px-2.5 py-1.5 rounded-lg ${styles[variant]}`}>
          {children}
        </span>
      ) : (
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${styles[variant]}`}>
          {checked ? <CheckIcon sx={{ fontSize: 18 }} /> : <RemoveIcon sx={{ fontSize: 18 }} />}
        </span>
      )}
    </td>
  );
}







// -----------------------------------------------------------
// IsPhishingRow
// -----------------------------------------------------------
//
// The headline row of the comparison table: was the email
// identified as phishing correctly? Shows "Neatsakė" when the
// student never answered this question. Missed rows get a
// faint red wash.
//
// Used by:
//   - AnswerCard (below)
// -----------------------------------------------------------

function IsPhishingRow({ answer }) {

  const correct = answer.isphishing === answer.isphishinganswer;

  return (
    <tr className={`border-b border-gray-100 ${correct ? '' : 'bg-red-50/60'}`}>
      <td className="py-[15px] pl-2">
        <div className="text-lg font-bold text-[#333]">Ar tai fišingas?</div>
        <div className="text-[11px] text-gray-500 italic">{answer.questiontext}</div>
      </td>

      <ResultCell variant="key" checked={answer.isphishing === 1} />

      {answer.isphishinganswer !== null ? (
        <ResultCell variant={correct ? 'correct' : 'wrong'} checked={answer.isphishinganswer === 1} />
      ) : (
        <ResultCell variant="wrong">Neatsakė</ResultCell>
      )}
    </tr>
  );
}







// -----------------------------------------------------------
// OptionRow
// -----------------------------------------------------------
//
// One checkbox option: its text, the answer key and what the
// student selected. Missed rows get a faint red wash.
//
// Used by:
//   - AnswerCard (below)
// -----------------------------------------------------------

function OptionRow({ answeredoption }) {

  const correct = answeredoption.rightansweroption === answeredoption.selectedansweroption;

  return (
    <tr className={`border-b border-gray-100 ${correct ? '' : 'bg-red-50/60'}`}>
      <td className="text-sm text-[#333] py-2 pl-2 pr-3">{answeredoption.optiontext}</td>
      <ResultCell variant="key" checked={answeredoption.rightansweroption === 1} />
      <ResultCell variant={correct ? 'correct' : 'wrong'} checked={answeredoption.selectedansweroption === 1} />
    </tr>
  );
}







// -----------------------------------------------------------
// AnswerCard
// -----------------------------------------------------------
//
// One question's full review card: a colored left edge and a
// header strip with the question ID, the identified chip and
// the points chip (green = full points, amber = partial,
// red = zero); the body shows the email screenshot on the
// left and the correct-vs-answered comparison table on the
// right.
//
// Used by:
//   - StudentAnswers (below) — one per answered question
// -----------------------------------------------------------

function AnswerCard({ answer }) {

  const identified = answer.isphishing === answer.isphishinganswer;

  // answerpoints is a "0.00".."1.00" string — string
  // comparison happens to work for this range
  let accentEdge, pointsChip;
  if (answer.answerpoints === '1.00') {
    accentEdge = 'border-l-green-600';
    pointsChip = 'bg-green-600';
  } else if (answer.answerpoints > '0.00') {
    accentEdge = 'border-l-amber-500';
    pointsChip = 'bg-amber-500';
  } else {
    accentEdge = 'border-l-red-500';
    pointsChip = 'bg-red-500';
  }


  return (
    <div className={`bg-white border-l-4 ${accentEdge} rounded-[15px] overflow-hidden shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]`}>

      {/* Header — question ID + result chips */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-gray-50 border-b border-gray-100 px-5 py-3">
        <span className="font-bold text-[#333]">Klausimas #{answer.id}</span>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white
            ${identified ? 'bg-green-600' : 'bg-red-500'}`}
          >
            {identified ? <CheckIcon sx={{ fontSize: 14 }} /> : <CloseIcon sx={{ fontSize: 14 }} />}
            {identified ? 'Identifikuota teisingai' : 'Identifikuota neteisingai'}
          </span>
          <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg text-white ${pointsChip}`}>
            {answer.answerpoints} tšk.
          </span>
        </div>
      </div>

      {/* Body — screenshot + comparison table */}
      <div className="flex gap-6 p-5 items-start">

        {/* Left — the email screenshot */}
        <InteractiveImage
          src={"/api/phishingpictures/" + answer.id}
          clickableAreasUrl={"/api/phishingpictures/" + answer.id + "/links"}
          onImageClick={(e) => e.stopPropagation()}
          imageStyle={{
            maxWidth: '30vw',
            border: '1px solid rgb(229, 231, 235)',
            borderRadius: 10,
          }}
        />

        {/* Right — correct vs. answered comparison */}
        <table className="flex-1 table-fixed border-collapse">
          <colgroup>
            <col/>
            <col className="w-[100px]"/>
            <col className="w-[100px]"/>
          </colgroup>
          <thead>
            <tr className="border-b-2 border-gray-200">
              <td className="pb-2 pl-2 font-bold text-gray-500 text-sm uppercase tracking-wide">Klausimas</td>
              <td className="pb-2 font-bold text-gray-500 text-sm uppercase tracking-wide text-center">Teisingas</td>
              <td className="pb-2 font-bold text-gray-500 text-sm uppercase tracking-wide text-center">Atsakyta</td>
            </tr>
          </thead>
          <tbody>

            <IsPhishingRow answer={answer} />

            {answer.answeredoptions.map((answeredoption) => (
              <OptionRow key={answeredoption.optiontext} answeredoption={answeredoption} />
            ))}

          </tbody>
        </table>

      </div>
    </div>
  );
}







// -----------------------------------------------------------
// StudentAnswers (default export)
// -----------------------------------------------------------
//
// Used by:
//   - StudentInformation.jsx — the "Atsakymai" tab
//   - StudentPages/TestFinish — the student's own review
// -----------------------------------------------------------

export default function StudentAnswers({ studentID }) {

  const { data } = useFetchData("/api/admin/students/" + studentID + "/answers");

  return (
    <div className="flex flex-col gap-5">
      {data.map((answer) => (
        <AnswerCard key={answer.id} answer={answer} />
      ))}
    </div>
  );
}
