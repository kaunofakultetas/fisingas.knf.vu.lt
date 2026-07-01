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
//    StudentInformation — the page itself (default export)
// -----------------------------------------------------------

import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Tab, Tabs } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import StudentTestSummaryTable from "./StudentTestSummaryTable/StudentTestSummaryTable";
import StudentAnswers from "./StudentAnswers/StudentAnswers";

import SchoolIcon from '@mui/icons-material/School';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';


const CARD_SHADOW_STYLE = {
  WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
  boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
};

const TILE_ICON_STYLE = {
  backgroundColor: 'lightgrey',
  borderRadius: '15px',
  padding: '10px',
  display: 'block',
  margin: '0 auto',
};







// -----------------------------------------------------------
// SummaryTile
// -----------------------------------------------------------
//
// One cell of the summary strip: icon, two-line label, the
// count and the percentage. `title` shows as a tooltip
// explaining what is being counted.
//
// Used by:
//   - StudentInformation (below) — the three count tiles
//     (the grade tile is inlined, it has its own styling)
// -----------------------------------------------------------

function SummaryTile({ icon, label, value, percent, title }) {
  return (
    <div
      style={{
        display: 'table-cell',
        textAlign: 'center',
        padding: '30px',
        fontSize: '15px',
        verticalAlign: 'top',
        cursor: 'help',
      }}
      title={title}
    >
      {icon}
      <span className="block">{label}</span>
      <br/>
      <span className="block">{value}</span>
      <br/>
      <span className="block">{percent} %</span>
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

  // 0 = "Atsakymai", 1 = "Testo Apibendrinimas"
  const [tabIndex, setTabIndex] = useState(0);


  return (
    <AdminPageLayout>
      <div style={{ filter: loadingData ? 'blur(5px)' : undefined }}>

        <div className="p-5 flex gap-5">

          {/* Left — student details */}
          <div
            className="flex-1 p-5 relative rounded-[10px]"
            style={CARD_SHADOW_STYLE}
          >
            <div className="flex gap-5">
              <div style={{ backgroundColor: '#E8E8E8', padding: '10px', height: 'fit-content', borderRadius: '15px' }}>
                <img src={"/img/avatar.png"} alt="" className="w-[100px] h-[100px] rounded-full object-cover"/>
              </div>

              <div className="flex-1 flex flex-col">
                <h1 className="mb-2.5 text-[#555] text-2xl font-bold">{data.username}</h1>
                <div className="mb-2.5 text-sm">
                  <span className="font-bold text-gray-500 mr-1.5 min-w-[150px] inline-block">ID:</span>
                  <span className="font-light">{studentID}</span>
                </div>
                <div className="mb-2.5 text-sm">
                  <span className="font-bold text-gray-500 mr-1.5 min-w-[150px] inline-block">Prisijungimo kodas:</span>
                  <span className="font-light">{data.passcode}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — summary tiles */}
          <div
            className="relative rounded-[10px]"
            style={{
              display: 'table',
              width: '65%',
              tableLayout: 'fixed',
              ...CARD_SHADOW_STYLE,
            }}
          >

            {/* Grade — the headline tile */}
            <div style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top' }}>
              <SchoolIcon style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
              <span className="block" style={{ fontSize: 24 }}><b>Testo<br/>Įvertinimas:</b></span>
              <br/>
              <span className="block" style={{ fontSize: 35 }}><b><u>{data.testgrade || 0.0}</u></b></span>
            </div>

            <SummaryTile
              icon={<PiHandsClappingLight size={50} style={TILE_ICON_STYLE} />}
              label={<>Viskas <br/>Teisinga:</>}
              value={`${data.fullycorrectcount || 0} / ${data.questioncount || 0}`}
              percent={((data.fullycorrectcount * 100 || 0) / (data.questioncount || 1)).toFixed(2)}
              title="Klausimai kurie buvo visiškai teisingai atsakyti įskaitant ir pasirenkamas opcijas"
            />

            <SummaryTile
              icon={<BsHandThumbsUp size={50} style={TILE_ICON_STYLE} />}
              label={<>Teisingai<br/>Identifikuota:</>}
              value={`${data.totalidentifiedcorrectly || 0} / ${data.questioncount || 0}`}
              percent={((data.totalidentifiedcorrectly * 100 || 0) / (data.questioncount || 1)).toFixed(2)}
              title="Klausimai kurie buvo teisingai identifikuoti tačiau buvo bent viena klaidinga pasirenkama opcija"
            />

            <SummaryTile
              icon={<GrCheckboxSelected size={50} style={TILE_ICON_STYLE} />}
              label={<>Tesingos <br/>Opcijos:</>}
              value={`${data.totalcorrectoptionscount || 0} / ${data.totaloptionscount || 0}`}
              percent={((data.totalcorrectoptionscount * 100 || 0) / (data.totaloptionscount || 1)).toFixed(2)}
              title="Teisingų opcijų skaičius teisingai identifikuotuose klausimuose"
            />

          </div>
        </div>

        {/* Bottom — answers / summary tabs */}
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5" style={CARD_SHADOW_STYLE}>
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
          <Box sx={{ marginTop: 2, minHeight: 'calc(100vh - 440px)', display: tabIndex === 0 ? undefined : 'none' }}>
            {tabIndex === 0 &&
              <StudentAnswers studentID={studentID}/>
            }
          </Box>
          <Box sx={{ marginTop: 2, minHeight: 'calc(100vh - 440px)', display: tabIndex === 1 ? undefined : 'none' }}>
            {tabIndex === 1 &&
              <StudentTestSummaryTable studentID={studentID}/>
            }
          </Box>
        </div>

      </div>
    </AdminPageLayout>
  );
}
