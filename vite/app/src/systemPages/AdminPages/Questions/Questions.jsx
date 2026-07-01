// -----------------------------------------------------------
//  [*] Admin — Questions
//
//  The question bank page (/admin/questions):
//    - top: title card + summary tiles (total questions,
//      real vs. phishing split, option count — the last one
//      is a "XXX" placeholder, the backend doesn't send it)
//    - below: QuestionsList — every question with its inline
//      editor
//
//  Data comes from GET /api/admin/questions; `refetch` is
//  passed down so the list can refresh itself after adding
//  a question or editing link areas.
//
//  Split into (root component last):
//
//    SummaryTile — one icon + label + value tile
//    Questions   — the page itself (default export)
// -----------------------------------------------------------

import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import QuestionsList from "./QuestionsList/QuestionsList";

import { FaQuestion } from 'react-icons/fa';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';
import { MdPhishing } from 'react-icons/md';







// -----------------------------------------------------------
// SummaryTile
// -----------------------------------------------------------
//
// One cell of the summary strip: a big icon, a two-line
// label and a value underneath.
//
// Used by:
//   - Questions (below) — all four tiles
// -----------------------------------------------------------

function SummaryTile({ icon, label, value }) {
  return (
    <div className="table-cell text-center p-[30px] text-[15px] align-top">
      {icon}
      <span className="block">{label}</span>
      <br/>
      <span className="block">{value}</span>
    </div>
  );
}







// -----------------------------------------------------------
// Questions (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /admin/questions
// -----------------------------------------------------------

export default function Questions() {

  const { data, loadingData, refetch: triggerQuestionListUpdate } = useFetchData("/api/admin/questions");


  if (loadingData) {
    return null;
  }


  return (
    <AdminPageLayout>
      <div>

        <div className="p-5 flex gap-5">

          {/* Left — title card */}
          <div className="flex-1 p-5 relative rounded-[10px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
            <div className="flex gap-5">
              <div className="bg-[#E8E8E8] p-2.5 h-fit rounded-[15px]">
                <MdPhishing size={170} className="rounded-[15px] p-2.5" />
              </div>

              <div className="flex-1 flex flex-col">
                <h1 className="mb-2.5 text-[#555] text-2xl font-bold">Testo Klausimai</h1>
              </div>
            </div>
          </div>

          {/* Right — summary tiles */}
          <div className="relative rounded-[10px] table w-[65%] table-fixed shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

            <SummaryTile
              icon={<FaQuestion size={50} className="bg-[lightgrey] rounded-[15px] p-2.5 block mx-auto" />}
              label={<>Viso <br/> Klausimų:</>}
              value={data.questioncount}
            />

            <SummaryTile
              icon={<BsHandThumbsUp size={50} className="bg-[lightgrey] rounded-[15px] p-2.5 block mx-auto" />}
              label={<>Tikri<br/>Pavyzdžiai:</>}
              value={`${data.goodcount} / ${(data.goodcount * 100 / data.questioncount).toFixed(2)}%`}
            />

            <SummaryTile
              icon={<MdPhishing size={50} className="bg-[lightgrey] rounded-[15px] p-2.5 block mx-auto" />}
              label={<>Fišingo<br/>Pavyzdžiai:</>}
              value={`${data.phishingcount} / ${(data.phishingcount * 100 / data.questioncount).toFixed(2)}%`}
            />

            <SummaryTile
              icon={<GrCheckboxSelected size={50} className="bg-[lightgrey] rounded-[15px] p-2.5 block mx-auto" />}
              label={<>Opcijų<br/>Skaičius:</>}
              value="XXX"
            />

          </div>
        </div>

        {/* The question list with inline editors */}
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5 min-h-[calc(100vh-353px)] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
          <QuestionsList data={data} triggerQuestionListUpdate={triggerQuestionListUpdate}/>
        </div>

      </div>
    </AdminPageLayout>
  );
}
