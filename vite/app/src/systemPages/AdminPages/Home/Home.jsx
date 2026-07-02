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
//  Icon names arrive as strings from the backend and are
//  mapped to MUI icons via getIconFromName.
//
//  Split into (root component last):
//
//    TestSizePicker — the test-size dropdown inside the
//                     "Klausimai" widget
//    Home           — the page itself (default export)
// -----------------------------------------------------------

import axios from "axios";
import toast from 'react-hot-toast';
import { TextField, MenuItem } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import Widget from "@/components/Admin/Widget/Widget";
import StudentProgress from "@/components/Admin/Widget/StudentProgress";

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
// Styled as a quiet inset panel so it reads as part of the
// white widget card instead of competing with it.
//
// Used by:
//   - Home (below) — inside the "Klausimai" widget
// -----------------------------------------------------------

const TEST_SIZE_CHOICES = [9, 12, 15, 21, 30];

function TestSizePicker({ currentSize }) {

  const saveTestSize = (newSize) => {
    axios.post("/api/admin/update/phishingtestsize",
      { phishingtestsize: newSize }, { withCredentials: true })
      .then(() => {
        toast.success(<b>Išsaugota</b>, { duration: 3000 });
      })
      .catch(() => {
        toast.error(<b>Nepavyko išsaugoti</b>, { duration: 3000 });
      });
  };


  return (
    <div className="flex flex-col gap-1.5 h-full justify-center bg-[rgb(245,246,248)] border border-[rgb(231,228,228)] rounded-[10px] px-4 py-2">
      <span className="font-bold text-xs text-gray-400">Testo dydis</span>

      <TextField
        select
        size="small"
        variant="outlined"
        defaultValue={currentSize}
        onChange={(e) => saveTestSize(e.target.value)}
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

  const { data, loadingData } = useFetchData("/api/admin/home", 2);


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


  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className="flex flex-col pt-5 min-h-full">

        {/* Top widgets */}
        <div className="flex p-2.5 gap-2.5">
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
            <TestSizePicker currentSize={String(data.phishingtestsize)} />
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
