// -----------------------------------------------------------
//  [*] Student — TestFinish (results page)
//
//  Shown when the student ends the test (or comes back after
//  finishing). Marks the test as finished on the backend
//  (GET /api/student/finish — the student can no longer
//  return to the questions), then shows:
//    - the login credentials (to check results again later)
//    - four summary tiles: grade, fully correct, correctly
//      identified, correct options
//    - the full per-question answer review (green/red), the
//      same StudentAnswers the admin sees
//
//  The student's results come from /api/admin/students/<id> —
//  the backend allows students to read their own record.
//
//  Split into (root component last):
//
//    SummaryTile — one icon + label + value tile
//    TestFinish  — the page itself (default export)
// -----------------------------------------------------------

import { useEffect } from "react";
import axios from "axios";
import useFetchData from "@/hooks/useFetchData";

import Navbar from "@/components/Navbar/Navbar";
import StudentAnswers from '@/systemPages/AdminPages/StudentInformation/StudentAnswers/StudentAnswers';

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
// One cell of the summary strip: a big icon, a two-line
// label and a value underneath.
//
// Used by:
//   - TestFinish (below) — the three count tiles (the grade
//     tile is inlined, it has its own emphasis styling)
// -----------------------------------------------------------

function SummaryTile({ icon, label, value }) {
  return (
    <div
      style={{
        display: 'table-cell',
        textAlign: 'center',
        padding: '30px',
        fontSize: '15px',
        verticalAlign: 'top',
      }}
    >
      {icon}
      <span style={{ display: 'block' }}>{label}</span>
      <br/>
      <span style={{ display: 'block' }}>{value}</span>
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
  // straight back here
  useEffect(() => {
    axios.get("/api/student/finish", { withCredentials: true });
  }, []);


  if (loadingData) {
    return <div>Kraunasi...</div>;
  }


  return (
    <div>
      <Navbar />

      {/* Credentials + summary tiles */}
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ width: '100%', background: '#EBECEF', display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div
            style={{
              width: '75%',
              borderRadius: 10,
              backgroundColor: 'white',
              ...CARD_SHADOW_STYLE,
            }}
          >

            {/* The credentials to write down */}
            <div
              style={{
                margin: 30,
                marginBottom: 0,
                width: 'fit-content',
                border: '2px solid lightgrey',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <b>Vardas: </b>{authData.id} <br/>
              <b>Kodas: </b>{authData.passcode}
            </div>

            {/* Summary tiles */}
            <div
              style={{
                display: 'table',
                width: '100%',
                height: 250,
                tableLayout: 'fixed',
              }}
            >

              {/* Grade — the headline tile */}
              <div
                style={{
                  display: 'table-cell',
                  textAlign: 'center',
                  padding: '30px',
                  fontSize: '15px',
                  verticalAlign: 'top',
                }}
              >
                <SchoolIcon style={{ fontSize: 80, ...TILE_ICON_STYLE }}/>
                <span
                  style={{
                    fontSize: 24,
                    display: 'block',
                  }}
                >
                  <b>Testo<br/>Įvertinimas:</b>
                </span>
                <br/>
                <span
                  style={{
                    fontSize: 35,
                    display: 'block',
                  }}
                >
                  <b><u>{data.testgrade || 0.0}</u></b>
                </span>
              </div>

              <SummaryTile
                icon={<PiHandsClappingLight size={80} style={TILE_ICON_STYLE} />}
                label={<>Viskas <br/>Teisinga:</>}
                value={`${data.fullycorrectcount || 0} / ${data.questioncount || 0}`}
              />

              <SummaryTile
                icon={<BsHandThumbsUp size={80} style={TILE_ICON_STYLE} />}
                label={<>Teisingai<br/>Identifikuota:</>}
                value={`${data.totalidentifiedcorrectly || 0} / ${data.questioncount || 0}`}
              />

              <SummaryTile
                icon={<GrCheckboxSelected size={80} style={TILE_ICON_STYLE} />}
                label={<>Tesingos <br/>Opcijos:</>}
                value={`${data.totalcorrectoptionscount || 0} / ${data.totaloptionscount || 0}`}
              />

            </div>
          </div>
        </div>
      </div>

      {/* Per-question answer review */}
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ width: '100%', background: '#EBECEF', display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div
            style={{
              width: '75%',
              minHeight: 'calc(100vh - 445px)',
              borderRadius: 10,
              backgroundColor: 'white',
              marginBottom: 30,
            }}
          >
            <StudentAnswers studentID={authData.userid} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em" }}>
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
}
