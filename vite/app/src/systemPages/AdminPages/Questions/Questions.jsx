// -----------------------------------------------------------
//  [*] Admin — Questions
//
//  The question bank page (/admin/questions):
//    - top: title card + summary tiles (total questions,
//      enabled count, real vs. phishing split, option count)
//    - below: QuestionsList — every question with its inline
//      editor
//
//  Data comes from GET /api/admin/questions; `refetch` is
//  passed down so the list can refresh itself after adding
//  or deleting a question or editing link areas.
//
//  Split into (root component last):
//
//    SummaryTile     — one icon + label + value tile
//    TestSizeWarning — banner when too few questions enabled
//    Questions       — the page itself (default export)
// -----------------------------------------------------------

import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import QuestionsList from "./QuestionsList/QuestionsList";

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FaQuestion } from 'react-icons/fa';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';
import { MdPhishing } from 'react-icons/md';
import { IoMdEye } from 'react-icons/io';







// -----------------------------------------------------------
// SummaryTile
// -----------------------------------------------------------
//
// One cell of the summary strip: an icon in a soft rounded
// square, a label and the value underneath. An empty bank
// (value null/undefined) renders as "—".
//
// Used by:
//   - Questions (below) — all four tiles
// -----------------------------------------------------------

function SummaryTile({ icon, label, value }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6 px-2 text-center">
      <div className="bg-[rgb(245,246,248)] border border-[rgb(231,228,228)] rounded-[12px] p-3">
        {icon}
      </div>
      <span className="text-xs font-bold text-gray-400 leading-tight">{label}</span>
      <span className="text-xl font-light text-[#333]">{value ?? "—"}</span>
    </div>
  );
}







// -----------------------------------------------------------
// TestSizeWarning
// -----------------------------------------------------------
//
// Amber banner shown when fewer questions are enabled than
// the configured test size — new tests would then deal fewer
// questions than intended. Hidden while everything is fine.
//
// Used by:
//   - Questions (below)
// -----------------------------------------------------------

function TestSizeWarning({ enabledCount, testSize }) {

  if (testSize == null || (enabledCount ?? 0) >= testSize) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 bg-[#FFF7E6] border border-[#F2C063] rounded-[15px] px-5 py-3">
      <WarningAmberIcon sx={{ color: '#B7791F' }} />
      <span className="text-sm text-[#7A5A13]">
        <b>Įjungtų klausimų per mažai:</b> testo dydis yra {testSize},
        bet įjungti tik {enabledCount ?? 0} klausimai — nauji testai gaus
        mažiau klausimų nei numatyta. Įjunkite daugiau klausimų arba
        sumažinkite testo dydį pagrindiniame puslapyje.
      </span>
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


  // Percentage of the bank, guarded against an empty bank
  const percentOfBank = (count) => {
    if (!data.questioncount || count == null) return null;
    return `${count} / ${(count * 100 / data.questioncount).toFixed(0)}%`;
  };


  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className="flex flex-col p-5 gap-5 min-h-full">

        {/* Header row — title card + tiles, stacked on narrow screens */}
        <div className="flex flex-col xl:flex-row gap-5">

          {/* Left — title card */}
          <div className="flex items-center gap-5 p-5 bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] w-full xl:w-[35%]">
            <div className="bg-[rgb(245,246,248)] border border-[rgb(231,228,228)] p-4 rounded-[15px] shrink-0">
              <MdPhishing size={64} className="text-[rgb(123,0,63)]" />
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-[#555]">Testo Klausimai</h1>
              <span className="text-sm text-gray-400">
                Klausimų bankas — čia sukuriami, redaguojami ir išjungiami
                testo klausimai. Studentams dalinami tik įjungti klausimai.
              </span>
            </div>
          </div>

          {/* Right — summary tiles, wrapping into rows when tight */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 flex-1 bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

            <SummaryTile
              icon={<FaQuestion size={28} className="text-[rgb(123,0,63)]" />}
              label={<>Viso<br/>Klausimų</>}
              value={data.questioncount || null}
            />

            <SummaryTile
              icon={<IoMdEye size={28} className="text-[rgb(123,0,63)]" />}
              label={<>Įjungtų<br/>Klausimų</>}
              value={percentOfBank(data.enabledcount)}
            />

            <SummaryTile
              icon={<BsHandThumbsUp size={28} className="text-[rgb(123,0,63)]" />}
              label={<>Tikri<br/>Pavyzdžiai</>}
              value={percentOfBank(data.goodcount)}
            />

            <SummaryTile
              icon={<MdPhishing size={28} className="text-[rgb(123,0,63)]" />}
              label={<>Fišingo<br/>Pavyzdžiai</>}
              value={percentOfBank(data.phishingcount)}
            />

            <SummaryTile
              icon={<GrCheckboxSelected size={28} className="text-[rgb(123,0,63)]" />}
              label={<>Opcijų<br/>Skaičius</>}
              value={data.optionscount}
            />

          </div>
        </div>

        <TestSizeWarning enabledCount={data.enabledcount} testSize={data.phishingtestsize} />

        {/* The question list with inline editors */}
        <QuestionsList data={data} triggerQuestionListUpdate={triggerQuestionListUpdate}/>

      </div>
    </AdminPageLayout>
  );
}
