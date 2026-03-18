import React, { useState, useEffect } from "react";
import axios from "axios";

import Navbar from "@/components/Navbar/Navbar";
import StudentAnswers from '@/systemPages/admin/students/StudentInformation/StudentAnswers/StudentAnswers';


import SchoolIcon from '@mui/icons-material/School';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';


export default function TestFinish() {
  const [authData, setAuthData] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const authResponse = await axios.get('/api/checkauth', { withCredentials: true });
        setAuthData(authResponse.data);

        const studentResponse = await axios.get("/api/admin/students/" + authResponse.data.userid, { withCredentials: true });
        setData(studentResponse.data);

        await axios.get("/api/student/finish", { withCredentials: true });
      } catch (error) {
        console.error("Error fetching test finish data:", error);
      }
    }
    fetchData();
  }, []);

  if (!authData || !data) {
    return <div>Kraunasi...</div>;
  }

  return (
    <div >
      <Navbar />
      <div style={{display: 'flex', flexDirection: 'row'}}>
        <div style={{ width: '100%', background: '#EBECEF', display: 'flex', justifyContent: 'center', paddingTop: 30 }}>


          <div 
            style={{
              width: '75%',
              position: 'relative',
              WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
              boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
              backgroundColor: 'white',
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div 
              style={{
                width: 'fit-content',
                fontSize: 20,
                display: 'block',
                border: '1px solid lightgrey',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <b>Vardas: </b>{authData.id} <br/>
              <b>Kodas: </b>{authData.passcode}
            </div>
            
            <div 
              style={{ 
                display: 'table', 
                width: '100%',
                height: 250,
                tableLayout: 'fixed',
              }}
            >
              
              <div
                style={{
                  display: 'table-cell',
                  textAlign: 'center',
                  padding: '30px',
                  fontSize: '15px',
                }}
              >
                <SchoolIcon style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
                <span 
                  style={{
                    fontSize: 24, 
                    paddingBottom: 0,
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

              <div 
                style={{
                  display: 'table-cell',
                  textAlign: 'center',
                  padding: '30px',
                  fontSize: '15px',
                }}
              >
                <PiHandsClappingLight style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
                <span style={{display: 'block'}}>
                  Viskas <br/>Teisinga:
                </span>
                <br/>
                <span style={{display: 'block'}}>{data.fullycorrectcount || 0} / {data.questioncount || 0}</span>
                <br/>
                <span style={{display: 'block'}}>{Math.round((data.fullycorrectcount * 100 || 0) / (data.questioncount || 1))} %</span>
              </div>

              <div 
                style={{
                  display: 'table-cell',
                  textAlign: 'center',
                  padding: '30px',
                  fontSize: '15px',
                }}
              >
                <BsHandThumbsUp style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
                <span style={{display: 'block'}}>Teisingai<br/>Identifikuota:</span>
                <br/>
                <span style={{display: 'block'}}>{data.totalidentifiedcorrectly || 0} / {data.questioncount || 0}</span>
                <br/>
                <span style={{display: 'block'}}>{Math.round((data.totalidentifiedcorrectly * 100 || 0) / (data.questioncount || 1))} %</span>
              </div>

              <div 
                style={{
                  display: 'table-cell',
                  textAlign: 'center',
                  padding: '30px',
                  fontSize: '15px',
                }}
              >
                <GrCheckboxSelected style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
                <span style={{display: 'block'}}>Tesingos <br/>Opcijos:</span>
                <br/>
                <span style={{display: 'block'}}>{data.totalcorrectoptionscount || 0} / {data.totaloptionscount || 0}</span>
                <br/>
                <span style={{display: 'block'}}>{Math.round((data.totalcorrectoptionscount * 100 || 0) / (data.totaloptionscount || 1))} %</span>
              </div>


            </div>


          </div>
        </div>
      </div>

      <div style={{display: 'flex', flexDirection: 'row'}}>
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


      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
};
