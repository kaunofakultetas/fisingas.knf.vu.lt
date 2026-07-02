// -----------------------------------------------------------
//  [*] Admin — StudentInformation
//
//  One student's results page (/admin/students/:studentID):
//    - top left:  avatar, username, login code and the
//                 registration / last login times
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
//  The "Ištrinti Studentą" button in the page heading row
//  removes the account with its test — hold-to-confirm
//  (LongPressButton), no confirm dialog.
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
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from 'react-hot-toast';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import StudentTestSummaryTable from "./StudentTestSummaryTable/StudentTestSummaryTable";
import StudentAnswers from "./StudentAnswers/StudentAnswers";
import { LongPressDeleteButton } from "@/components/Other/LongPressButton";

import SchoolIcon from '@mui/icons-material/School';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import KeyIcon from '@mui/icons-material/Key';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
      className="flex-1 min-w-[150px] flex flex-col items-center justify-center gap-1.5 p-5 text-center cursor-help border-l border-gray-100"
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
// avatar overlapping it, the username, and the account rows —
// ID, the login code the student uses to get back into the
// test (in a monospace pill, it's meant to be copied/
// dictated), the registration time and the last login time
// ("—" when unknown, e.g. accounts registered before the
// column existed).
//
// Used by:
//   - StudentInformation (below)
// -----------------------------------------------------------

function StudentDetailsCard({ studentID, data }) {
  return (
    <div className="flex-1 bg-white rounded-[15px] overflow-hidden shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

      {/* Burgundy banner with the avatar overlapping it */}
      <div className="h-[60px] bg-linear-to-r from-[rgb(123,0,63)] to-[rgb(75,0,38)]" />
      <div className="px-5 pb-5 -mt-[45px]">
        <img
          src={"/img/avatar.png"}
          alt=""
          className="w-[90px] h-[90px] rounded-full object-cover border-4 border-white bg-white shadow-md"
        />

        <h1 className="mt-2 text-2xl font-bold text-[#333]">{data.username}</h1>

        {/* Account rows */}
        <div className="mt-3 flex flex-col gap-2.5 text-sm">
          <div className="flex items-center gap-2">
            <FingerprintIcon sx={{ fontSize: 18 }} className="text-[rgb(123,0,63)]" />
            <span className="font-semibold text-gray-500 w-[185px]">ID:</span>
            <span>{studentID}</span>
          </div>
          <div className="flex items-center gap-2">
            <KeyIcon sx={{ fontSize: 18 }} className="text-[rgb(123,0,63)]" />
            <span className="font-semibold text-gray-500 w-[185px]">Prisijungimo kodas:</span>
            <span className="font-mono bg-gray-100 border border-gray-200 rounded px-2 py-0.5">{data.passcode}</span>
          </div>
          <div className="flex items-center gap-2">
            <EventIcon sx={{ fontSize: 18 }} className="text-[rgb(123,0,63)]" />
            <span className="font-semibold text-gray-500 w-[185px]">Registracijos laikas:</span>
            <span>{data.registrationtime || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <ScheduleIcon sx={{ fontSize: 18 }} className="text-[rgb(123,0,63)]" />
            <span className="font-semibold text-gray-500 w-[185px]">Paskutinis prisijungimas:</span>
            <span>{data.lastseen || "—"}</span>
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
    <div className="w-full xl:w-[65%] flex flex-wrap bg-white rounded-[15px] overflow-hidden shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

      {/* Grade — the headline tile */}
      <div className="w-full sm:w-[25%] sm:min-w-[150px] bg-linear-to-br from-[rgb(123,0,63)] to-[rgb(75,0,38)] text-white flex flex-col items-center justify-center gap-1.5 p-5 text-center">
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
    <div className="bg-white rounded-[15px] p-5 pb-2.5 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
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

  const navigate = useNavigate();
  const { studentID } = useParams();
  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID);


  // Remove the account for good, then back to the students list
  const handleDeleteStudent = async () => {
    try {
      await axios.post(`/api/admin/students/${studentID}/delete`, {}, { withCredentials: true });
      toast.success(<b>Studentas ištrintas</b>, { duration: 4000 });
      navigate("/admin/students");
    } catch {
      toast.error(<b>Nepavyko ištrinti studento</b>, { duration: 5000 });
    }
  };


  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className={`flex-1 p-5 ${loadingData ? "blur-[5px]" : ""}`}>

        {/* Page heading + the destructive admin actions */}
        <Box className="flex items-center flex-wrap gap-2 mb-4">
          <PersonOutlineIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Studento Informacija
          </Typography>

          <Box className="ml-auto flex flex-wrap gap-2">
            <LongPressDeleteButton
              onComplete={handleDeleteStudent}
              duration={1500}
              variant="contained"
              tooltip="Laikykite mygtuką, kad ištrintumėte studentą"
              uncompletedToastMessage="Laikykite mygtuką ilgiau, kad ištrintumėte studentą"
              progressColor="white"
              progressBgColor="rgba(211,47,47,0.25)"
            >
              <>
                <DeleteOutlineIcon />
                <span className="ml-2">Ištrinti Studentą</span>
              </>
            </LongPressDeleteButton>
          </Box>
        </Box>

        {/* Top row — profile card + summary tiles, stacked on
            narrow screens */}
        <div className="flex flex-col xl:flex-row gap-5 items-stretch mb-5">
          <StudentDetailsCard studentID={studentID} data={data} />
          <TestSummaryPanel data={data} />
        </div>

        <ResultsTabs studentID={studentID} />

      </div>
    </AdminPageLayout>
  );
}
