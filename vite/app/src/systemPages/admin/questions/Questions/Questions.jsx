
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import React from "react";
import useFetchData from "@/hooks/useFetchData";

import { FaQuestion } from 'react-icons/fa';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';
import { MdPhishing } from 'react-icons/md';

import QuestionsList from "./QuestionsList/QuestionsList";


const cardShadow = '2px 4px 10px 1px rgba(201, 201, 201, 0.47)';

const QuestionsPage = () => {
  
  const { data, refetch: triggerQuestionListUpdate } = useFetchData("/api/admin/questions");

  

  return (
    <AdminPageLayout>
      <div>
        
        <div className="flex gap-5 p-5" style={{zoom: 0.7}}>
          <div className="flex-1 relative rounded-[10px] p-5" style={{ boxShadow: cardShadow }}>

            <div className="flex gap-5" style={{paddingRight: '15%', display: 'inline-flex' }}>
              <div style={{backgroundColor: '#E8E8E8', padding: 10, height: 'fit-content', borderRadius: 15}}>
                <MdPhishing size={170} style={{borderRadius: '15px', padding: '10px'}}/>
              </div>
              
              <div>
                <h2 className="mb-2.5 text-[#555]">Testo Klausimai</h2>
              </div>
            </div>

          </div>

          <div className="relative rounded-[10px]" style={{ display: 'table', width: '65%', tableLayout: 'fixed', boxShadow: cardShadow }}>
            <div style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15 }}>
              <FaQuestion style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
              <span className="block">Viso <br/> Klausimų:</span>
              <br/>
              <span className="block">{data.questioncount}</span>
            </div>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15 }}>
              <BsHandThumbsUp style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
              <span className="block">Tikri<br/>Pavyzdžiai:</span>
              <br/>
              <span className="block">{data.goodcount} / {data.goodcount*100 / data.questioncount}%</span>
            </div>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15 }}>
              <MdPhishing style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
              <span className="block">Fišingo<br/>Pavyzdžiai:</span>
              <br/>
              <span className="block">{data.phishingcount} / {data.phishingcount*100 / data.questioncount}%</span>
            </div>

            <div style={{ display: 'table-cell', textAlign: 'center', padding: 30, fontSize: 15 }}>
              <GrCheckboxSelected style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
              <span className="block">Opcijų<br/>Skaičius:</span>
              <br/>
              <span className="block">XXX</span>
            </div>
            
          </div>
        </div>
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5" style={{ boxShadow: cardShadow, minHeight: 'calc(100vh - 353px)' }}>
          <QuestionsList data={data} triggerQuestionListUpdate={triggerQuestionListUpdate}/>
        </div>
      </div>
    </AdminPageLayout>
  );
};

export default QuestionsPage;
