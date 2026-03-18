
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import React, { useState } from "react";
import { useParams } from "react-router-dom";
import useFetchData from "@/hooks/useFetchData";

import SchoolIcon from '@mui/icons-material/School';
import { PiHandsClappingLight } from 'react-icons/pi';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';

import { Box, Tab, Tabs } from '@mui/material';

import StudentTestSummaryTable from "./StudentTestSummaryTable/StudentTestSummaryTable";
import StudentAnswers from "./StudentAnswers/StudentAnswers";


const cardShadow = '2px 4px 10px 1px rgba(201, 201, 201, 0.47)';

const StudentInformation = () => {
  const { studentID } = useParams();
  
  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID);



  const [dataSourceTabIndex, setDataSourceTabIndex] = useState(0);
  const handleDataSourceTabChange = (event, newTabIndex) => {
    setDataSourceTabIndex(newTabIndex);
  };



  
  return (
    <AdminPageLayout>
      <div style={{filter: data.length === 0 ? 'blur(5px)' : undefined}}>
        
        <div className="flex gap-5 p-5" style={{zoom: 0.7}}>
          <div className="flex-1 relative rounded-[10px] p-5" style={{ boxShadow: cardShadow }}>

            <div className="flex gap-5" style={{paddingRight: '15%', display: 'inline-flex' }}>
              <div style={{backgroundColor: '#E8E8E8', padding: '15px', height: 'fit-content', borderRadius: '15px'}}> 
                <img src={"/img/avatar.png"} alt="" className="w-[180px] h-[180px] rounded-full object-cover"/>
              </div>
              
              <div>
                <h2 style={{ marginTop: 10, marginBottom: 15, color: '#555', fontSize: 35 }}>{data.username}</h2>
                <div style={{ marginBottom: 10, fontSize: 20 }}>
                  <span className="font-bold text-gray-500 mr-1.5 inline-block min-w-[70px]">ID:</span>
                  <span className="font-light">{studentID}</span>
                </div>
                <div style={{ marginBottom: 10, fontSize: 20 }}>
                  <span className="font-bold text-gray-500 mr-1.5 inline-block min-w-[70px]">Prisijungimo kodas:</span>
                  <span className="font-light">{data.passcode}</span>
                </div>
              </div>
            </div>

          </div>

          <div className="relative rounded-[10px]" style={{ display: 'table', width: '65%', tableLayout: 'fixed', boxShadow: cardShadow }}>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15 }}>
              <SchoolIcon style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
              <span className="block" style={{fontSize: 24, paddingBottom: 0}}><b>Testo<br/>Įvertinimas:</b></span>
              <br/>
              <span className="block" style={{fontSize: 35}}><b><u>{data.testgrade || 0.0}</u></b></span>
            </div>

            <div 
              style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15, cursor: 'help' }}
              title="Klausimai kurie buvo visiškai teisingai atsakyti įskaitant ir pasirenkamas opcijas"
            >
              <PiHandsClappingLight style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
              <span className="block">Viskas <br/>Teisinga:</span>
              <br/>
              <span className="block">{data.fullycorrectcount || 0} / {data.questioncount || 0}</span>
              <br/>
              <span className="block">{Math.round((data.fullycorrectcount * 100 || 0) / (data.questioncount || 1))} %</span>
            </div>

            <div 
              style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15, cursor: 'help' }}
              title="Klausimai kurie buvo teisingai identifikuoti tačiau buvo bent viena klaidinga pasirenkama opcija"
            >
              <BsHandThumbsUp style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
              <span className="block">Teisingai<br/>Identifikuota:</span>
              <br/>
              <span className="block">{data.totalidentifiedcorrectly || 0} / {data.questioncount || 0}</span>
              <br/>
              <span className="block">{Math.round((data.totalidentifiedcorrectly * 100 || 0) / (data.questioncount || 1))} %</span>
            </div>

            <div 
              style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15, cursor: 'help' }}
              title="Teisingų opcijų skaičius teisingai identifikuotuose klausimuose"
            >
              <GrCheckboxSelected style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px'}}/>
              <span className="block">Tesingos <br/>Opcijos:</span>
              <br/>
              <span className="block">{data.totalcorrectoptionscount || 0} / {data.totaloptionscount || 0}</span>
              <br/>
              <span className="block">{Math.round((data.totalcorrectoptionscount * 100 || 0) / (data.totaloptionscount || 1))} %</span>
            </div>
            

          </div>
        </div>
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5" style={{ boxShadow: cardShadow }}>
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
    </AdminPageLayout>
  );
};

export default StudentInformation;
