'use client';
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

import Navbar from "@/components/Navbar/Navbar";
import StudentSidebar from "@/components/Student/Sidebar/Sidebar";
import InteractiveImage from "@/components/other/InteractiveImage/InteractiveImage";

import { Button, Checkbox } from '@mui/material';

import { BsHandThumbsUp } from 'react-icons/bs';
import { MdPhishing } from 'react-icons/md';

import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';





const TestHome = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(undefined);
  const [questionsData, setQuestionsData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);


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



  // Send results to the server after each click
  useEffect(() => {
    console.log(questionsData);
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



  const handleQuestionAnswerClick = (selectedanswer) => {
    const updatedQuestionsData = [...questionsData];
    updatedQuestionsData[currentQuestionIndex].selectedanswer = selectedanswer;
    setQuestionsData(updatedQuestionsData);

    // Scroll to the bottom of the page
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };



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





  return (
    <div>
      <Navbar/>

      <FullScreenImage
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        url={`/api/phishingpictures/${questionsData[currentQuestionIndex].questionid}`}
        clickableAreasUrl={`/api/phishingpictures/${questionsData[currentQuestionIndex].questionid}/links`}
      />

      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ minHeight: 'calc(100vh - 135px)', width: '100%', background: '#EBECEF', display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div style={{ backgroundColor: 'white', width: 'calc(100vw - 400px)', border: '1px lightgrey solid', borderRadius: 15, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '3px solid lightgrey', margin: 20, borderRadius: 15 }}>

              {/* Interactive Image */}
              <div style={{ position: 'relative', padding: 20 }}>
                <InteractiveImage
                  src={`/api/phishingpictures/${questionsData[currentQuestionIndex].questionid}`}
                  clickableAreasUrl={`/api/phishingpictures/${questionsData[currentQuestionIndex].questionid}/links`}
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

              {/* Phishing/Not-Phishing buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', padding: 20, margin: 20, marginTop: 0, paddingTop: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>

                  <div style={{ margin: 15 }}>
                    <Button
                      style={{ background: 'rgb(123, 0, 63)', color: 'white' }}
                      onClick={() => handleQuestionAnswerClick(0)}
                    >
                      <BsHandThumbsUp style={{ fontSize: 30, padding: 10 }} />
                      <div style={{ fontSize: 25, marginRight: 15 }}>Tikras</div>
                      {questionsData[currentQuestionIndex].selectedanswer === 0 ? (
                        <CheckBoxOutlinedIcon style={{ fontSize: 30, padding: 10 }} />
                      ) : (
                        <CheckBoxOutlineBlankIcon style={{ fontSize: 30, padding: 10 }} />
                      )}
                    </Button>
                  </div>

                  <div style={{ margin: 15 }}>
                    <Button
                      style={{ background: 'rgb(123, 0, 63)', color: 'white' }}
                      onClick={() => handleQuestionAnswerClick(1)}
                    >
                      <MdPhishing style={{ fontSize: 30, padding: 10 }} />
                      <div style={{ fontSize: 25, marginRight: 15 }}>Fišingas</div>
                      {questionsData[currentQuestionIndex].selectedanswer === 1 ? (
                        <CheckBoxOutlinedIcon style={{ fontSize: 30, padding: 10 }} />
                      ) : (
                        <CheckBoxOutlineBlankIcon style={{ fontSize: 30, padding: 10 }} />
                      )}
                    </Button>
                  </div>

                </div>

                {/* Additional Info */}
                <div style={{ display: 'flex', flexDirection: 'row'}}>
                  {questionsData[currentQuestionIndex].question !== "" &&
                    <span style={{ marginTop: 20, marginBottom: 20 }}>
                      <b style={{ marginRight: 5 }}>
                        Papildomai:
                      </b>
                      {questionsData[currentQuestionIndex].question}
                    </span>
                  }
                </div>

                {/* Options for answers */}
                <table style={{ width: '100%', tableLayout: 'fixed', paddingLeft: 20, borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 100 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '2px solid lightgrey' }}>
                      <td><h3><b>Klausimai</b></h3></td>
                      <td style={{ textAlign: 'center' }}><h3><b></b></h3></td>
                    </tr>
                  </thead>
                  <tbody>
                    {questionsData[currentQuestionIndex].questionoptions.map((questionOption, index) => (
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


        {/* Sidebar */}
        <StudentSidebar
          currentQuestionIndex={currentQuestionIndex}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
          questionsData={questionsData}
          style={{
            marginTop: 100,
          }}
        />
      </div>



      {/* Footer */}
      <div style={{ background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em" }}>
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
};



// **FullScreenImage Component**
const FullScreenImage = ({ isModalOpen, setIsModalOpen, url, clickableAreasUrl }) => {
  return (
    <>
      {isModalOpen && (
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
              padding: '20px', // Consistent padding around the image
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
      )}
    </>
  );
};

export default TestHome;
