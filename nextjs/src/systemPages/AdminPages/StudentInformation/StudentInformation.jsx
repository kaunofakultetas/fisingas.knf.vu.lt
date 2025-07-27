'use client';
import styles from "./StudentInformation.module.scss";
import Sidebar from "@/components/Admin/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar";

import React, { useState, useEffect } from "react";
import axios from "axios";

import SchoolIcon from '@mui/icons-material/School';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';

// Tabs
import { Box, Tab, Tabs } from '@mui/material';




import StudentTestSummaryTable from "./StudentTestSummaryTable/StudentTestSummaryTable";
import StudentAnswers from "./StudentAnswers/StudentAnswers";



const StudentInformation = ({ studentID }) => {
  
  const [data, setData] = useState([]);
  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get("/api/admin/students/" + studentID);
        setData(response.data);
      } catch (error) {}
    }

    getData();
  }, []);



  // Main Tabs
  const [dataSourceTabIndex, setDataSourceTabIndex] = useState(0);
  const handleDataSourceTabChange = (event, newTabIndex) => {
    setDataSourceTabIndex(newTabIndex);
  };



  
  return (
    <div className={styles.single} id={styles.backgroundStyle} >
      <Navbar />
      <div className={styles.singleContainer} style={{display: 'flex', flexDirection: 'row'}}>
        <Sidebar />
        <div style={{filter: data.length === 0 ? 'blur(5px)' : undefined}}>
          
          <div className={styles.top} style={{zoom: 0.7}}>
            <div className={styles.left}>

              <div className={styles.item} style={{paddingRight: '15%', display: 'inline-flex' }}>
                <div style={{backgroundColor: '#E8E8E8', padding: '15px', height: 'fit-content', borderRadius: '15px'}}> 
                {/* , height: 180 */}
                  <img src={"/img/avatar.png"} alt="" className={styles.itemImg}/>
                </div>
                
                <div className={styles.details}>

                  <h2 className={styles.itemTitle}>{data.username}</h2>
                  <div className={styles.detailItem}>
                    <span className={styles.itemKey}>ID:</span>
                    <span className={styles.itemValue}>{studentID}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.itemKey}>Prisijungimo kodas:</span>
                    <span className={styles.itemValue}>{data.passcode}</span>
                  </div>
                  
                </div>
              </div>

            </div>

            <div className={styles.right}>

            

              <div className={styles.computerFeature}>
                <SchoolIcon style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
                <span className={styles.computerFeatureText} style={{fontSize: 24, paddingBottom: 0}}><b>Testo<br/>Įvertinimas:</b></span>
                <br/>
                <span className={styles.computerFeatureText} style={{fontSize: 35}}><b><u>{data.testgrade || 0.0}</u></b></span>
              </div>

              <div 
                className={styles.computerFeature}
                title="Klausimai kurie buvo visiškai teisingai atsakyti įskaitant ir pasirenkamas opcijas"
                style={{
                  cursor: 'help'
                }}
              >
                <PiHandsClappingLight style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
                <span className={styles.computerFeatureText}>Viskas <br/>Teisinga:</span>
                <br/>
                <span className={styles.computerFeatureText}>{data.fullycorrectcount || 0} / {data.questioncount || 0}</span>
                <br/>
                <span className={styles.computerFeatureText}>{Math.round((data.fullycorrectcount * 100 || 0) / (data.questioncount || 1))} %</span>
              </div>

              <div 
                className={styles.computerFeature}
                title="Klausimai kurie buvo teisingai identifikuoti tačiau buvo bent viena klaidinga pasirenkama opcija"
                style={{
                  cursor: 'help'
                }}
              >
                <BsHandThumbsUp style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
                {/* <div style={{ position: 'relative', display: 'inline-block' }}>
                  <MdPhishing style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
                  <div style={{ position: 'absolute', top: '50%', width: '100%', height: 6, backgroundColor: 'black', transform: 'rotate(45deg)', transformOrigin: 'center'}}></div>
                </div> */}
                <span className={styles.computerFeatureText}>Teisingai<br/>Identifikuota:</span>
                <br/>
                <span className={styles.computerFeatureText}>{data.totalidentifiedcorrectly || 0} / {data.questioncount || 0}</span>
                <br/>
                <span className={styles.computerFeatureText}>{Math.round((data.totalidentifiedcorrectly * 100 || 0) / (data.questioncount || 1))} %</span>
              </div>

              <div 
                className={styles.computerFeature}
                title="Teisingų opcijų skaičius teisingai identifikuotuose klausimuose"
                style={{
                  cursor: 'help'
                }}
              >
                <GrCheckboxSelected style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
                <span className={styles.computerFeatureText}>Tesingos <br/>Opcijos:</span>
                <br/>
                <span className={styles.computerFeatureText}>{data.totalcorrectoptionscount || 0} / {data.totaloptionscount || 0}</span>
                <br/>
                <span className={styles.computerFeatureText}>{Math.round((data.totalcorrectoptionscount * 100 || 0) / (data.totaloptionscount || 1))} %</span>
              </div>
              

            </div>
          </div>
          <div className={styles.bottom}>
            <Box>
              <Tabs
                style={{
                  borderStyle: "solid",
                  borderWidth: "2px",
                  borderRadius: "20px",
                  borderColor: "rgb(123, 0, 63)"
                }}

                indicatorColor="primary"
                value={dataSourceTabIndex}
                onChange={handleDataSourceTabChange}

                TabIndicatorProps={{
                  style: {
                    backgroundColor: "rgb(123, 0, 63)",
                    height: "100%",
                    zIndex: -1,
                    borderRadius: "15px",
                    textColor: "black"
                  }
                }}

                variant="fullWidth"
                sx={{
                  '& .MuiTabs-indicator': { backgroundColor: "rgb(123, 0, 63) !important" },
                  '& .Mui-selected': { color: "white !important"}
                }}
              >
                <Tab value={0} style={{color: "black", fontWeight: "bold"}} disableRipple label="Atsakymai" />
                <Tab value={1} style={{color: "black", fontWeight: "bold"}} disableRipple label="Testo Apibendrinimas" />
              </Tabs>
            </Box>
            <Box sx={{ marginTop: 2, minHeight: 'calc(100vh - 440px)', display: dataSourceTabIndex === 0 ? undefined : 'none'  }}>
              {dataSourceTabIndex === 0 &&
                <StudentAnswers studentID={studentID}/>
              }
            </Box>
            <Box sx={{ marginTop: 2, minHeight: 'calc(100vh - 440px)', display: dataSourceTabIndex === 1 ? undefined : 'none'  }}>
              {dataSourceTabIndex === 1 &&
                <StudentTestSummaryTable  studentID={studentID}/>
              }
            </Box>
          </div>
        </div>
      </div>
      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
};

export default StudentInformation;
