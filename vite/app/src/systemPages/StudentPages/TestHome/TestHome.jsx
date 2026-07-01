// -----------------------------------------------------------
//  [*] Student — TestHome (the phishing test)
//
//  The test itself. The student sees one email screenshot at
//  a time and answers:
//    - "Tikras" / "Fišingas" — is this email phishing?
//    - the question's checkboxes (why / what gives it away)
//
//  Questions come from GET /api/student/questions (the
//  backend assigns each student a random subset on first
//  request). Every click POSTs the whole answer state back,
//  so progress survives a page reload and the admin dashboard
//  sees it live. The sidebar jumps between questions and ends
//  the test.
//
//  Clicking the email opens it fullscreen; hovering a link
//  area shows its URL in both views (via InteractiveImage).
//
//  Split into (root component last):
//
//    FullScreenImage — the zoomed-in email overlay
//    TestHome        — the page itself (default export)
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";

import Navbar from "@/components/Navbar/Navbar";
import StudentSidebar from "@/components/Student/Sidebar/Sidebar";
import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";

import { Button, Checkbox } from '@mui/material';

import { BsHandThumbsUp } from 'react-icons/bs';
import { MdPhishing } from 'react-icons/md';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';


const ANSWER_BUTTON_SX = {
  background: 'rgb(123, 0, 63)',
  color: 'white',
  '&:hover': { backgroundColor: 'rgb(230, 65, 100)' },
};







// -----------------------------------------------------------
// FullScreenImage
// -----------------------------------------------------------
//
// Fullscreen view of the current email: dark backdrop, a grey
// top bar with an "Atgal" button, and the email centered on
// black. Clicking anywhere closes it. Link areas keep working
// (transparent overlays + URL tooltips).
//
// Used by:
//   - TestHome (below)
// -----------------------------------------------------------

function FullScreenImage({ isModalOpen, setIsModalOpen, url, clickableAreasUrl }) {

  if (!isModalOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'zoom-out',
      }}
      onClick={() => setIsModalOpen(false)}
    >
      {/* Top grey bar */}
      <div style={{
        height: 50,
        backgroundColor: 'lightgrey',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: 10,
      }}>
        <button
          onClick={() => setIsModalOpen(false)}
          style={{
            width: 80,
            height: 30,
            cursor: 'zoom-out',
            border: '1px solid black',
            borderRadius: 5,
            background: 'darkgrey',
          }}
        >
          Atgal
        </button>
      </div>

      {/* Image container */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'black',
          flexGrow: 1,
          padding: '20px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <InteractiveImage
          src={url}
          clickableAreasUrl={clickableAreasUrl}
          clickablAreaColor='rgba(0, 0, 0, 0.0)'
          containerStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          imageStyle={{
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}







// -----------------------------------------------------------
// TestHome (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /student (behind the student guard;
//     finished students are redirected to /student/finish)
// -----------------------------------------------------------

export default function TestHome() {

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(undefined);
  const [questionsData, setQuestionsData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);


  // Load the student's questions (assigned server-side)
  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get("/api/student/questions", { withCredentials: true });
        setQuestionsData(response.data);
        setCurrentQuestionIndex(0);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          window.location.href = '/login';
        }
      }
    }
    getData();
  }, []);


  // Autosave — POST the whole answer state after every change
  useEffect(() => {
    async function sendData() {
      try {
        await axios.post("/api/student/questions", questionsData, { withCredentials: true });
      } catch (error) {
        console.error("Error sending data to the server:", error);
      }
    }
    if (questionsData.length > 0) {
      sendData();
    }
  }, [questionsData]);


  // "Tikras" (0) / "Fišingas" (1) answer for the open question
  const handleQuestionAnswerClick = (selectedanswer) => {
    const updatedQuestionsData = [...questionsData];
    updatedQuestionsData[currentQuestionIndex].selectedanswer = selectedanswer;
    setQuestionsData(updatedQuestionsData);

    // Bring the follow-up checkboxes into view
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };


  // Toggle one of the question's follow-up checkboxes
  const handleQuestionOptionClick = (optionIndex) => {
    const updatedQuestionsData = [...questionsData];
    updatedQuestionsData[currentQuestionIndex].questionoptions[optionIndex].isselected =
      updatedQuestionsData[currentQuestionIndex].questionoptions[optionIndex].isselected === 1 ? 0 : 1;
    setQuestionsData(updatedQuestionsData);
  };


  if (questionsData.length === 0 || currentQuestionIndex === undefined) {
    return (
      <div>Kraunasi...</div>
    );
  }

  const currentQuestion = questionsData[currentQuestionIndex];


  return (
    <div>
      <Navbar/>

      <FullScreenImage
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        url={`/api/phishingpictures/${currentQuestion.questionid}`}
        clickableAreasUrl={`/api/phishingpictures/${currentQuestion.questionid}/links`}
      />

      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ minHeight: 'calc(100vh - 135px)', width: '100%', background: '#EBECEF', display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div style={{ backgroundColor: 'white', width: 'calc(100vw - 400px)', border: '1px lightgrey solid', borderRadius: 15, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '3px solid lightgrey', margin: 20, borderRadius: 15 }}>

              {/* The email — click to zoom in */}
              <div style={{ position: 'relative', padding: 20 }}>
                <InteractiveImage
                  src={`/api/phishingpictures/${currentQuestion.questionid}`}
                  clickableAreasUrl={`/api/phishingpictures/${currentQuestion.questionid}/links`}
                  clickablAreaColor='rgba(0, 0, 0, 0.0)'
                  onImageClick={() => setIsModalOpen(true)}
                  containerStyle={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '50vh',
                    cursor: 'zoom-in',
                  }}
                  imageStyle={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    border: '1px solid lightgrey',
                    borderRadius: '10px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', padding: 20, margin: 20, marginTop: 0, paddingTop: 0 }}>

                {/* Tikras / Fišingas buttons */}
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>

                  <div style={{ margin: 15 }}>
                    <Button sx={ANSWER_BUTTON_SX} onClick={() => handleQuestionAnswerClick(0)}>
                      <BsHandThumbsUp style={{ fontSize: 40, padding: 5 }} />
                      <div style={{ fontSize: 25, marginRight: 15 }}>Tikras</div>
                      {currentQuestion.selectedanswer === 0 ? (
                        <CheckBoxOutlinedIcon style={{ fontSize: 40, padding: 5 }} />
                      ) : (
                        <CheckBoxOutlineBlankIcon style={{ fontSize: 40, padding: 5 }} />
                      )}
                    </Button>
                  </div>

                  <div style={{ margin: 15 }}>
                    <Button sx={ANSWER_BUTTON_SX} onClick={() => handleQuestionAnswerClick(1)}>
                      <MdPhishing style={{ fontSize: 40, padding: 5 }} />
                      <div style={{ fontSize: 25, marginRight: 15 }}>Fišingas</div>
                      {currentQuestion.selectedanswer === 1 ? (
                        <CheckBoxOutlinedIcon style={{ fontSize: 40, padding: 5 }} />
                      ) : (
                        <CheckBoxOutlineBlankIcon style={{ fontSize: 40, padding: 5 }} />
                      )}
                    </Button>
                  </div>

                </div>

                {/* Additional info from the question */}
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                  {currentQuestion.question !== "" &&
                    <span style={{ marginTop: 20, marginBottom: 20 }}>
                      <b style={{ marginRight: 5 }}>
                        Papildomai:
                      </b>
                      {currentQuestion.question}
                    </span>
                  }
                </div>

                {/* Follow-up checkboxes */}
                <table style={{ width: '100%', tableLayout: 'fixed', paddingLeft: 20, borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 100 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '2px solid lightgrey' }}>
                      <td><h3><b>Klausimai</b></h3></td>
                      <td style={{ textAlign: 'center' }}></td>
                    </tr>
                  </thead>
                  <tbody>
                    {currentQuestion.questionoptions.map((questionOption, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid lightgrey' }}>
                        <td>{questionOption.answeroption}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={questionOption.isselected === 1}
                            onClick={() => handleQuestionOptionClick(index)}
                            style={{ color: "rgb(123, 0, 63)" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </div>
            </div>
          </div>
        </div>

        {/* Question navigation + finish */}
        <StudentSidebar
          currentQuestionIndex={currentQuestionIndex}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
          questionsData={questionsData}
        />
      </div>

      {/* Footer */}
      <div style={{ background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em" }}>
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
}
