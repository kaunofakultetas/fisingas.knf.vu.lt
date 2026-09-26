// -----------------------------------------------------------
//  [*] Admin — Home (dashboard)
//
//  The admin landing page, polling /api/admin/home every 2 s:
//    - "Studentų" widget    — student count, links to the list
//    - "Klausimai" widget   — enabled/total question count,
//                             links to the questions page, and
//                             the test-size picker (how many
//                             questions each student gets)
//    - StudentProgress card — live progress bars of everyone
//                             currently taking the test
//
//  Nothing renders before the first reply. While no dashboard
//  has arrived because the loading failed, the admin frame
//  shows a load error with a retry button instead; the polling
//  goes on meanwhile, so the dashboard replaces the error as
//  soon as the backend answers. A failed poll after that keeps
//  the last dashboard on screen.
//
//  Icon names arrive as strings from the backend and are
//  mapped to MUI icons via getIconFromName.
//
//  Split into (root component last):
//
//    TestSizePicker — the test-size dropdown inside the
//                     "Klausimai" widget
//    Home           — the page itself (default export)
// -----------------------------------------------------------

import { useState, useRef, useId } from "react";
import axios from "axios";
import toast from 'react-hot-toast';
import { TextField, MenuItem } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";
import { redirectOnExpiredSession } from "@/utils/session";
import { TEST_SIZE_CHOICES, DEFAULT_TEST_SIZE } from "@/utils/testSize";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import Widget from "@/components/Admin/Widget/Widget";
import StudentProgress from "@/components/Admin/Widget/StudentProgress";
import LoadError from "@/components/Other/LoadError/LoadError";

import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import QuestionMarkOutlinedIcon from '@mui/icons-material/QuestionMarkOutlined';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import EngineeringIcon from '@mui/icons-material/Engineering';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import CastForEducationOutlinedIcon from '@mui/icons-material/CastForEducationOutlined';







// -----------------------------------------------------------
// TestSizePicker
// -----------------------------------------------------------
//
// The dropdown deciding how many questions a NEW test deals
// to a student (already-dealt tests keep their size). Saves
// on every change — no save button — and confirms with a
// toast.
//
// It shows the size the dashboard reports (`storedSize`) —
// DEFAULT_TEST_SIZE while none was ever saved, the size the
// backend then deals — so the polls keep it up to date. The
// admin's pick shows at once and is held only while its save
// is in flight: a saved pick until the dashboard reload that
// reports it has landed, a failed one gives way to the
// stored size again.
//
// The "Testo dydis" caption is the select's label, so
// assistive tech names the picker — and the menu it opens —
// after it.
//
// Styled as a quiet inset panel so it reads as part of the
// white widget card instead of competing with it.
//
// Used by:
//   - Home (below) — inside the "Klausimai" widget
// -----------------------------------------------------------

function TestSizePicker({ storedSize, reloadDashboard }) {

  // Ties the "Testo dydis" caption to the select as its label
  const captionId = useId();

  // The admin's pick while its save is in flight (null: none)
  const [pendingSize, setPendingSize] = useState(null);

  // Only the newest pick's outcome may drop the held pick — an
  // earlier save settling late must not undo a newer pick
  const latestPick = useRef(0);

  // A string like the option values — a number would make MUI
  // take a re-pick of the shown size for a change
  const shownSize = pendingSize ?? String(storedSize ?? DEFAULT_TEST_SIZE);


  const saveTestSize = (newSize) => {
    const pick = ++latestPick.current;
    setPendingSize(newSize);

    axios.post("/api/admin/update/phishingtestsize",
      { phishingtestsize: newSize }, { withCredentials: true })
      .then(() => {
        toast.success(<b>Išsaugota</b>, { duration: 3000 });

        // Hold the pick until the dashboard reports the saved
        // size — letting go now would flash the old size until
        // the next poll
        return reloadDashboard();
      })
      .catch((error) => {
        if (redirectOnExpiredSession(error)) return;
        toast.error(<b>Nepavyko išsaugoti</b>, { duration: 3000 });
      })
      .finally(() => {
        if (pick === latestPick.current) {
          setPendingSize(null);
        }
      });
  };


  return (
    <div className="flex flex-col gap-1.5 h-full justify-center bg-[rgb(245,246,248)] border border-[rgb(231,228,228)] rounded-[10px] px-4 py-2">
      <span id={captionId} className="font-bold text-xs text-gray-400">Testo dydis</span>

      <TextField
        select
        size="small"
        variant="outlined"
        value={shownSize}
        onChange={(e) => saveTestSize(e.target.value)}
        slotProps={{ select: { labelId: captionId } }}
        sx={{
          width: '160px',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            backgroundColor: 'white',
            fontSize: '0.875rem',
            '& fieldset': { borderColor: 'rgb(231,228,228)' },
            '&:hover fieldset': { borderColor: 'rgb(123,0,63)' },
            '&.Mui-focused fieldset': { borderColor: 'rgb(123,0,63)' },
          },
        }}
      >
        {TEST_SIZE_CHOICES.map((size) => (
          <MenuItem key={size} value={String(size)}>
            {size} klausimų
          </MenuItem>
        ))}
      </TextField>
    </div>
  );
}







// -----------------------------------------------------------
// Home (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /admin
// -----------------------------------------------------------

export default function Home() {

  const { data, loadingData, refetch } = useFetchData("/api/admin/home", 2);


  // Backend sends icon names as strings — map them to the
  // actual MUI icon components
  const getIconFromName = (iconName) => {
    const icons = {
      PersonOutlinedIcon: PersonOutlinedIcon,
      QuestionMarkOutlinedIcon: QuestionMarkOutlinedIcon,
      CreditCardOutlinedIcon: CreditCardOutlinedIcon,
      DirectionsCarOutlinedIcon: DirectionsCarOutlinedIcon,
      PeopleOutlinedIcon: PeopleOutlinedIcon,
      RecordVoiceOverIcon: RecordVoiceOverIcon,
      ElectricBoltIcon: ElectricBoltIcon,
      EngineeringIcon: EngineeringIcon,
      TerminalOutlinedIcon: TerminalOutlinedIcon,
      SchoolOutlinedIcon: SchoolOutlinedIcon,
      CastForEducationOutlinedIcon: CastForEducationOutlinedIcon,
    };
    const Icon = icons[iconName] || CreditCardOutlinedIcon;
    return <Icon className="text-[18px] p-[5px] rounded-[5px] self-end text-white bg-[rgb(230,65,100)]" />;
  }


  if (loadingData) {
    return null;
  }


  // Loaded, yet `data` is still the hook's initial [] — the
  // loading failed before any dashboard arrived. The error sits
  // in a white card like the other admin pages' load errors
  if (Array.isArray(data)) {
    return (
      <AdminPageLayout backgroundColor="#EBECEF">
        <div className="m-5 bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
          <LoadError message="Nepavyko įkelti pradžios puslapio" onRetry={refetch} />
        </div>
      </AdminPageLayout>
    );
  }


  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className="flex flex-col pt-5 min-h-full">

        {/* Top widgets — side by side, stacked on narrow screens */}
        <div className="flex flex-col md:flex-row p-2.5 gap-2.5">
          <Widget
            text="Studentų"
            count={data.studentscount}
            icon={getIconFromName("PeopleOutlinedIcon")}
            link="/admin/students"
          />
          <Widget
            text="Klausimai"
            count={data.enabledquestionscount + "/" + data.totalquestionscount}
            icon={getIconFromName("QuestionMarkOutlinedIcon")}
            link="/admin/questions"
          >
            <TestSizePicker storedSize={data.phishingtestsize} reloadDashboard={refetch} />
          </Widget>
        </div>

        {/* Live progress of active students */}
        <div className="flex p-2.5 gap-2.5">
          <StudentProgress text="Testą Sprendžia:" studentsprogress={data.studentsprogress}/>
        </div>

      </div>
    </AdminPageLayout>
  );
}
