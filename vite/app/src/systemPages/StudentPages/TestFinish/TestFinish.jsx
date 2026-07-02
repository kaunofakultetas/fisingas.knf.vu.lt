// -----------------------------------------------------------
//  [*] Student — TestFinish (results page)
//
//  Shown when the student ends the test (or comes back after
//  finishing). Marks the test as finished on the backend
//  (GET /api/student/finish — the student can no longer
//  return to the questions), then shows:
//    - the login credentials (to check results again later)
//    - the summary card: the grade headline tile plus three
//      count tiles (fully correct, correctly identified,
//      correct options)
//    - the full per-question answer review (green/red), the
//      same StudentAnswers the admin sees
//
//  The student's results come from /api/admin/students/<id> —
//  the backend allows students to read their own record.
//
//  Split into (root component last):
//
//    CredentialPill — one "label: value" credential chip
//    SummaryTile    — one icon + label + value tile
//    TestFinish     — the page itself (default export)
// -----------------------------------------------------------

import { useEffect } from "react";
import axios from "axios";
import toast, { Toaster } from 'react-hot-toast';
import useFetchData from "@/hooks/useFetchData";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Other/Footer/Footer";
import StudentAnswers from '@/systemPages/AdminPages/StudentInformation/StudentAnswers/StudentAnswers';

import SchoolIcon from '@mui/icons-material/School';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';







// -----------------------------------------------------------
// CredentialPill
// -----------------------------------------------------------
//
// One credential chip of the "write these down" strip: a
// small grey label and the value in bold monospace.
//
// Used by:
//   - TestFinish (below) — "Vardas" and "Kodas"
// -----------------------------------------------------------

function CredentialPill({ label, value }) {
  return (
    <div className="inline-flex items-baseline gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="font-mono font-bold text-gray-800">{value}</span>
    </div>
  );
}







// -----------------------------------------------------------
// SummaryTile
// -----------------------------------------------------------
//
// One count tile of the summary strip: a burgundy-tinted icon
// circle, the value in large bold digits and a small label.
//
// Used by:
//   - TestFinish (below) — the three count tiles (the grade
//     tile is inlined, it has its own emphasis styling)
// -----------------------------------------------------------

function SummaryTile({ icon, label, value }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-[rgba(123,0,63,0.08)] text-[rgb(123,0,63)] flex items-center justify-center">
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</div>
    </div>
  );
}







// -----------------------------------------------------------
// TestFinish (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /student/finish (behind the student
//     guard, which passes authData)
// -----------------------------------------------------------

export default function TestFinish({ authData }) {

  // The student may read their own record on this endpoint
  const { data, loadingData } = useFetchData("/api/admin/students/" + authData.userid);


  // Mark the test as finished — from now on /student redirects
  // straight back here. The call is idempotent, so a page
  // refresh repeating it is harmless
  useEffect(() => {
    axios.get("/api/student/finish", { withCredentials: true })
      .catch(() => {
        toast.error(<b>Nepavyko užbaigti testo — perkraukite puslapį</b>, { duration: 6000 });
      });
  }, []);


  // Loading — centered brand spinner
  if (loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#EBECEF]">
        <div className="w-10 h-10 rounded-full border-4 border-gray-300 border-t-[rgb(123,0,63)] animate-spin" />
        <div className="text-gray-500">Kraunasi...</div>
      </div>
    );
  }


  return (
    <div>
      <Toaster position="top-center" />
      <Navbar />

      {/* Summary card — heading, credentials, grade + counts */}
      <div className="w-full bg-[#EBECEF] flex justify-center pt-[30px]">
        <div className="w-3/4 rounded-[15px] bg-white shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] overflow-hidden">

          {/* Header — congratulations + the credentials to write down */}
          <div className="px-8 py-6 border-b border-gray-100 flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Testas baigtas!</h2>
              <p className="mt-1 text-sm text-gray-400">
                Užsirašykite prisijungimo duomenis — su jais galėsite peržiūrėti rezultatus vėliau.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CredentialPill label="Vardas" value={authData.id} />
              <CredentialPill label="Kodas" value={authData.passcode} />
            </div>
          </div>

          {/* Grade + count tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-8">

            {/* Grade — the headline tile */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[rgb(123,0,63)] p-6 text-center text-white shadow-[0_4px_14px_rgba(123,0,63,0.35)]">
              <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
                <SchoolIcon sx={{ fontSize: 32 }} />
              </div>
              <div className="text-4xl font-bold">{data.testgrade || 0.0}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Testo Įvertinimas</div>
            </div>

            <SummaryTile
              icon={<PiHandsClappingLight size={28} />}
              label="Teisingai Identifikuota bei Teisingos Opcijos"
              value={`${data.fullycorrectcount || 0} / ${data.questioncount || 0}`}
            />

            <SummaryTile
              icon={<BsHandThumbsUp size={26} />}
              label="Teisingai Identifikuota"
              value={`${data.totalidentifiedcorrectly || 0} / ${data.questioncount || 0}`}
            />

            <SummaryTile
              icon={<GrCheckboxSelected size={24} />}
              label="Teisingos Opcijos"
              value={`${data.totalcorrectoptionscount || 0} / ${data.totaloptionscount || 0}`}
            />

          </div>
        </div>
      </div>

      {/* Per-question answer review — the cards bring their own
          white background, so they sit straight on the grey */}
      <div className="w-full bg-[#EBECEF] flex justify-center pt-[30px]">
        <div className="w-3/4 min-h-[calc(100vh-445px)] mb-[30px]">
          <StudentAnswers studentID={authData.userid} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
