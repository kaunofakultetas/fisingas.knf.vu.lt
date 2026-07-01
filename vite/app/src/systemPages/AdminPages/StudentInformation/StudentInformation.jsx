// -----------------------------------------------------------
//  [*] Admin — StudentInformation
//
//  One student's results page (/admin/students/:studentID):
//    - top left:  avatar, username and login code
//    - top right: summary tiles — grade, fully correct,
//                 correctly identified, correct options
//                 (with percentages; hover for an explanation)
//    - bottom:    tabs switching between the full answer
//                 review (StudentAnswers) and the compact
//                 summary grid (StudentTestSummaryTable)
//
//  Data comes from GET /api/admin/students/<id>; while it
//  loads the page renders blurred instead of empty.
//
//  Split into (root component last):
//
//    SummaryTile        — one icon + label + value + % tile
//    StudentDetailsCard — avatar, username and login code
//    TestSummaryPanel   — the grade + count tiles strip
//    ResultsTabs        — answers / summary tab switcher
//    StudentInformation — the page itself (default export)
// -----------------------------------------------------------

import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Tab, Tabs, Typography } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import StudentTestSummaryTable from "./StudentTestSummaryTable/StudentTestSummaryTable";
import StudentAnswers from "./StudentAnswers/StudentAnswers";

import SchoolIcon from '@mui/icons-material/School';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import KeyIcon from '@mui/icons-material/Key';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';







// -----------------------------------------------------------
// SummaryTile
// -----------------------------------------------------------
//
// One tile of the summary strip: the icon in a burgundy-
// tinted circle, a small uppercase label, the count, and a
// thin progress bar visualizing the percentage. `title`
// shows as a tooltip explaining what is being counted.
//
// Used by:
//   - TestSummaryPanel (below) — the three count tiles
//     (the grade tile is inlined, it has its own styling)
// -----------------------------------------------------------

function SummaryTile({ icon, label, value, percent, title }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-1.5 p-5 text-center cursor-help border-l border-gray-100"
      title={title}
    >
      <div className="bg-[rgba(123,0,63,0.08)] text-[rgb(123,0,63)] rounded-full p-3.5 flex items-center justify-center">
        {icon}
      </div>

      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</span>
      <span className="text-2xl font-bold text-[#333]">{value}</span>

      {/* Percent bar */}
      <div className="w-full max-w-[120px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[rgb(123,0,63)] rounded-full"
          style={{ width: `${Math.min(parseFloat(percent), 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{percent} %</span>
    </div>
  );
}







// -----------------------------------------------------------
// StudentDetailsCard
// -----------------------------------------------------------
//
// The top-left profile card: a burgundy banner with the
// avatar overlapping it, the username, and the credential
// rows — ID and the login code the student uses to get back
// into the test (in a monospace pill, it's meant to be
// copied/dictated).
//
// Used by:
//   - StudentInformation (below)
// -----------------------------------------------------------

function StudentDetailsCard({ studentID, data }) {
  return (
    <div className="flex-1 bg-white rounded-[10px] overflow-hidden shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

      {/* Burgundy banner with the avatar overlapping it */}
      <div className="h-[60px] bg-linear-to-r from-[rgb(123,0,63)] to-[rgb(75,0,38)]" />
      <div className="px-5 pb-5 -mt-[45px]">
        <img
          src={"/img/avatar.png"}
          alt=""
          className="w-[90px] h-[90px] rounded-full object-cover border-4 border-white bg-white shadow-md"
        />

        <h1 className="mt-2 text-2xl font-bold text-[#333]">{data.username}</h1>

        {/* Credential rows */}
        <div className="mt-3 flex flex-col gap-2.5 text-sm">
          <div className="flex items-center gap-2">
            <FingerprintIcon sx={{ fontSize: 18 }} className="text-[rgb(123,0,63)]" />
            <span className="font-semibold text-gray-500 w-[140px]">ID:</span>
            <span>{studentID}</span>
          </div>
          <div className="flex items-center gap-2">
            <KeyIcon sx={{ fontSize: 18 }} className="text-[rgb(123,0,63)]" />
            <span className="font-semibold text-gray-500 w-[140px]">Prisijungimo kodas:</span>
            <span className="font-mono bg-gray-100 border border-gray-200 rounded px-2 py-0.5">{data.passcode}</span>
          </div>
        </div>
      </div>

    </div>
  );
}







// -----------------------------------------------------------
// TestSummaryPanel
// -----------------------------------------------------------
//
// The top-right strip: the headline grade tile on a burgundy
// gradient, plus the three count tiles (fully correct /
// correctly identified / correct options), each with its
// percentage bar and tooltip.
//
// Used by:
//   - StudentInformation (below)
// -----------------------------------------------------------

function TestSummaryPanel({ data }) {
  return (
    <div className="w-[65%] flex bg-white rounded-[10px] overflow-hidden shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

      {/* Grade — the headline tile */}
      <div className="w-[25%] bg-linear-to-br from-[rgb(123,0,63)] to-[rgb(75,0,38)] text-white flex flex-col items-center justify-center gap-1.5 p-5 text-center">
        <div className="bg-white/15 rounded-full p-3.5 flex items-center justify-center">
          <SchoolIcon sx={{ fontSize: 30 }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-white/80 mt-1">Testo<br/>Įvertinimas</span>
        <span className="text-4xl font-bold">{data.testgrade || 0.0}</span>
      </div>

      <SummaryTile
        icon={<PiHandsClappingLight size={30} />}
        label={<>Viskas<br/>Teisinga</>}
        value={`${data.fullycorrectcount || 0} / ${data.questioncount || 0}`}
        percent={((data.fullycorrectcount * 100 || 0) / (data.questioncount || 1)).toFixed(2)}
        title="Klausimai kurie buvo visiškai teisingai atsakyti įskaitant ir pasirenkamas opcijas"
      />

      <SummaryTile
        icon={<BsHandThumbsUp size={30} />}
        label={<>Teisingai<br/>Identifikuota</>}
        value={`${data.totalidentifiedcorrectly || 0} / ${data.questioncount || 0}`}
        percent={((data.totalidentifiedcorrectly * 100 || 0) / (data.questioncount || 1)).toFixed(2)}
        title="Klausimai kurie buvo teisingai identifikuoti tačiau buvo bent viena klaidinga pasirenkama opcija"
      />

      <SummaryTile
        icon={<GrCheckboxSelected size={30} />}
        label={<>Teisingos<br/>Opcijos</>}
        value={`${data.totalcorrectoptionscount || 0} / ${data.totaloptionscount || 0}`}
        percent={((data.totalcorrectoptionscount * 100 || 0) / (data.totaloptionscount || 1)).toFixed(2)}
        title="Teisingų opcijų skaičius teisingai identifikuotuose klausimuose"
      />

    </div>
  );
}







// -----------------------------------------------------------
// ResultsTabs
// -----------------------------------------------------------
//
// The bottom card: a full-width burgundy pill tab switcher
// between the full answer review and the compact summary
// grid. Owns the tab index; the inactive tab is unmounted so
// it doesn't fetch until first opened.
//
// Used by:
//   - StudentInformation (below)
// -----------------------------------------------------------

function ResultsTabs({ studentID }) {

  // 0 = "Atsakymai", 1 = "Testo Apibendrinimas"
  const [tabIndex, setTabIndex] = useState(0);


  return (
    <div className="bg-white rounded-[10px] p-5 pb-2.5 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
      <Box>
        <Tabs
          className="border-2 border-solid rounded-[20px] border-[rgb(123,0,63)]"
          indicatorColor="primary"
          value={tabIndex}
          onChange={(event, newTabIndex) => setTabIndex(newTabIndex)}
          TabIndicatorProps={{
            style: {
              backgroundColor: "rgb(123, 0, 63)",
              height: "100%",
              borderRadius: "15px",
            }
          }}
          variant="fullWidth"
          sx={{
            position: 'relative',
            '& .MuiTabs-indicator': {
              backgroundColor: "rgb(123, 0, 63) !important",
              zIndex: 0,
            },
            '& .MuiTab-root': {
              zIndex: 1,
              color: "black",
              fontWeight: "bold",
              flex: 1,
              maxWidth: 'none',
            },
            '& .Mui-selected': {
              color: "white !important",
            },
          }}
        >
          <Tab value={0} disableRipple label="Atsakymai" />
          <Tab value={1} disableRipple label="Testo Apibendrinimas" />
        </Tabs>
      </Box>

      <Box className="mt-4 min-h-[calc(100vh-440px)]" sx={{ display: tabIndex === 0 ? undefined : 'none' }}>
        {tabIndex === 0 &&
          <StudentAnswers studentID={studentID}/>
        }
      </Box>

      <Box className="mt-4 min-h-[calc(100vh-440px)]" sx={{ display: tabIndex === 1 ? undefined : 'none' }}>
        {tabIndex === 1 &&
          <StudentTestSummaryTable studentID={studentID}/>
        }
      </Box>
    </div>
  );
}







// -----------------------------------------------------------
// StudentInformation (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /admin/students/:studentID
// -----------------------------------------------------------

export default function StudentInformation() {

  const { studentID } = useParams();
  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID);


  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className={`flex-1 p-5 ${loadingData ? "blur-[5px]" : ""}`}>

        {/* Page heading */}
        <Box className="flex items-center gap-2 mb-4">
          <PersonOutlineIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Studento Informacija
          </Typography>
        </Box>

        {/* Top row — profile card + summary tiles */}
        <div className="flex gap-5 items-stretch mb-5">
          <StudentDetailsCard studentID={studentID} data={data} />
          <TestSummaryPanel data={data} />
        </div>

        <ResultsTabs studentID={studentID} />

      </div>
    </AdminPageLayout>
  );
}
