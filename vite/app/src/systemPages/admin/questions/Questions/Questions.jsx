
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import React from "react";
import useFetchData from "@/hooks/useFetchData";

import { FaQuestion } from 'react-icons/fa';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';
import { MdPhishing } from 'react-icons/md';

import QuestionsList from "./QuestionsList/QuestionsList";


const boxShadowStyle = {
  WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
  boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)'
};

const QuestionsPage = () => {
  
  const { data, loadingData, refetch: triggerQuestionListUpdate } = useFetchData("/api/admin/questions");

  if (loadingData) {
    return <></>;
  }

  return (
    <AdminPageLayout>
      <div>
        
        <div className="p-5 flex gap-5">
          {/* Left - Title Card */}
          <div 
            className="flex-1 p-5 relative rounded-[10px]"
            style={boxShadowStyle}
          >
            <div className="flex gap-5">
              <div style={{ backgroundColor: '#E8E8E8', padding: '10px', height: 'fit-content', borderRadius: '15px' }}>
                <MdPhishing size={170} style={{ borderRadius: '15px', padding: '10px' }} />
              </div>
              
              <div className="flex-1 flex flex-col">
                <h1 className="mb-2.5 text-[#555] text-2xl font-bold">Testo Klausimai</h1>
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
              <FaQuestion size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Viso <br/> Klausimų:</span>
              <br/>
              <span className="block">{data.questioncount}</span>
            </div>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top' }}>
              <BsHandThumbsUp size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Tikri<br/>Pavyzdžiai:</span>
              <br/>
              <span className="block">{data.goodcount} / {(data.goodcount*100 / data.questioncount).toFixed(2)}%</span>
            </div>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top' }}>
              <MdPhishing size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Fišingo<br/>Pavyzdžiai:</span>
              <br/>
              <span className="block">{data.phishingcount} / {(data.phishingcount*100 / data.questioncount).toFixed(2)}%</span>
            </div>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: '30px', fontSize: '15px', verticalAlign: 'top' }}>
              <GrCheckboxSelected size={50} style={{ backgroundColor: 'lightgrey', borderRadius: '15px', padding: '10px', display: 'block', margin: '0 auto' }} />
              <span className="block">Opcijų<br/>Skaičius:</span>
              <br/>
              <span className="block">XXX</span>
            </div>
          </div>
        </div>
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5" style={{ ...boxShadowStyle, minHeight: 'calc(100vh - 353px)' }}>
          <QuestionsList data={data} triggerQuestionListUpdate={triggerQuestionListUpdate}/>
        </div>
      </div>
    </AdminPageLayout>
  );
};

export default QuestionsPage;
