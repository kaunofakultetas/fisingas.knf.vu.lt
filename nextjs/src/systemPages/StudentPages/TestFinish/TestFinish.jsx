import React from "react";
import axios from "axios";
import { cookies } from 'next/headers'

import Navbar from "@/components/Navbar/Navbar";
import StudentAnswers from '@/systemPages/AdminPages/StudentInformation/StudentAnswers/StudentAnswers';


import styles from "./TestFinish.module.scss";


import SchoolIcon from '@mui/icons-material/School';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';







export default async function TestFinish() {

  let authResponse = await axios.get(process.env.BACKEND_API_URL+'/api/checkauth', { 
    headers: { Cookie: "session=" + cookies().get("session").value }
  });

  
  let data = await axios.get(process.env.BACKEND_API_URL+"/api/admin/students/" + authResponse.data.userid, { 
    headers: { Cookie: "session=" + cookies().get("session").value }
  });
  data = data.data;


  // Mark student as finished phishing test
  await axios.get(process.env.BACKEND_API_URL+"/api/student/finish", { 
    headers: { Cookie: "session=" + cookies().get("session").value }
  });



  return (
    <div >
      <Navbar />
      <div className={styles.mainContainer} style={{display: 'flex', flexDirection: 'row'}}>
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
              <b>Vardas: </b>{authResponse.data.id} <br/>
              <b>Kodas: </b>{authResponse.data.passcode}
            </div>
            
            <div 
              style={{ 
                display: 'table', 
                width: '100%',
                height: 250,
                tableLayout: 'fixed',
                // position: 'relative',
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
                {/* <div style={{ position: 'relative', display: 'inline-block' }}>
                  <MdPhishing style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
                  <div style={{ position: 'absolute', top: '50%', width: '100%', height: 6, backgroundColor: 'black', transform: 'rotate(45deg)', transformOrigin: 'center'}}></div>
                </div> */}
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

      <div className={styles.mainContainer} style={{display: 'flex', flexDirection: 'row'}}>
        <div style={{ width: '100%', background: '#EBECEF', display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
          <div 
            style={{ 
              // display: 'table', 
              width: '75%',
              minHeight: 'calc(100vh - 445px)',
              // tableLayout: 'fixed',
              // WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
              // boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
              // position: 'relative',
              borderRadius: 10,
              backgroundColor: 'white',
              marginBottom: 30,
            }}
          >
            <StudentAnswers studentID={authResponse.data.userid} />
          </div>
        </div>
      </div>


      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
};
