
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


const boxShadowStyle = {
  WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
  boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)'
};

const StudentInformation = () => {
  const { studentID } = useParams();
  
  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID);

  const [dataSourceTabIndex, setDataSourceTabIndex] = useState(0);
  const handleDataSourceTabChange = (event, newTabIndex) => {
    setDataSourceTabIndex(newTabIndex);
  };

  return (
    <AdminPageLayout>
      <div style={{filter: loadingData ? 'blur(5px)' : undefined}}>
        
        <div className="p-5 flex gap-5">
          {/* Left - Student Details */}
          <div 
            className="flex-1 p-5 relative rounded-[10px]"
            style={boxShadowStyle}
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

          {/* Right - Summary Tiles */}
          <div 
            className="relative rounded-[10px]"
            style={{ 
              display: 'table', 
              width: '65%', 
              tableLayout: 'fixed', 
              ...boxShadowStyle 
            }}
          >
            <div style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top' }}>
              <SchoolIcon style={{ fontSize: 50, backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px' }} />
              <span className="block" style={{ fontSize: 24 }}><b>Testo<br/>Įvertinimas:</b></span>
              <br/>
              <span className="block" style={{ fontSize: 35 }}><b><u>{data.testgrade || 0.0}</u></b></span>
            </div>

            <div 
              style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top', cursor: 'help' }}
              title="Klausimai kurie buvo visiškai teisingai atsakyti įskaitant ir pasirenkamas opcijas"
            >
              <PiHandsClappingLight size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Viskas <br/>Teisinga:</span>
              <br/>
              <span className="block">{data.fullycorrectcount || 0} / {data.questioncount || 0}</span>
              <br/>
              <span className="block">{((data.fullycorrectcount * 100 || 0) / (data.questioncount || 1)).toFixed(2)} %</span>
            </div>

            <div 
              style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top', cursor: 'help' }}
              title="Klausimai kurie buvo teisingai identifikuoti tačiau buvo bent viena klaidinga pasirenkama opcija"
            >
              <BsHandThumbsUp size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Teisingai<br/>Identifikuota:</span>
              <br/>
              <span className="block">{data.totalidentifiedcorrectly || 0} / {data.questioncount || 0}</span>
              <br/>
              <span className="block">{((data.totalidentifiedcorrectly * 100 || 0) / (data.questioncount || 1)).toFixed(2)} %</span>
            </div>

            <div 
              style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top', cursor: 'help' }}
              title="Teisingų opcijų skaičius teisingai identifikuotuose klausimuose"
            >
              <GrCheckboxSelected size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Tesingos <br/>Opcijos:</span>
              <br/>
              <span className="block">{data.totalcorrectoptionscount || 0} / {data.totaloptionscount || 0}</span>
              <br/>
              <span className="block">{((data.totalcorrectoptionscount * 100 || 0) / (data.totaloptionscount || 1)).toFixed(2)} %</span>
            </div>
          </div>
        </div>
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5" style={boxShadowStyle}>
          <Box>
            <Tabs
              className="border-2 border-solid rounded-[20px] border-[rgb(123,0,63)]"
              indicatorColor="primary"
              value={dataSourceTabIndex}
              onChange={handleDataSourceTabChange}
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
                  zIndex: 0
                },
                '& .MuiTab-root': {
                  zIndex: 1,
                  color: "black",
                  fontWeight: "bold",
                  flex: 1,
                  maxWidth: 'none',
                },
                '& .Mui-selected': { 
                  color: "white !important" 
                }
              }}
            >
              <Tab value={0} disableRipple label="Atsakymai" />
              <Tab value={1} disableRipple label="Testo Apibendrinimas" />
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
