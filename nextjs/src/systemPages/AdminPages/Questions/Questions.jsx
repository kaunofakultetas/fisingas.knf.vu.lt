'use client';
import styles from "./Questions.module.scss";
import Sidebar from "@/components/Admin/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar";

import React, { useState, useEffect } from "react";
import axios from "axios";

import { FaQuestion } from 'react-icons/fa';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';
import { MdPhishing } from 'react-icons/md';

import QuestionsList from "./QuestionsList/QuestionsList";



const QuestionsPage = () => {
  
  const [data, setData] = useState([]);


  async function triggerQuestionListUpdate() {
    setData([]);
    try {
      const response = await axios.get("/api/admin/questions");
      setData(response.data);
    } catch (error) {
      if (error.response.status === 401) {
        window.location.href = '/login';
      }
    }
  }


  useEffect(() => {
    triggerQuestionListUpdate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  

  return (
    <div className={styles.single} id={styles.backgroundStyle}>
      <Navbar />
      <div className={styles.singleContainer} style={{display: 'flex', flexDirection: 'row'}}>
        <Sidebar />
        <div>
          
          <div className={styles.top} style={{zoom: 0.7}}>
            <div className={styles.left}>

              <div className={styles.item} style={{paddingRight: '15%', display: 'inline-flex' }}>
                <div style={{backgroundColor: '#E8E8E8', padding: 10, height: 'fit-content', borderRadius: 15}}>
                {/* , height: 180 */}
                  <MdPhishing size={170} style={{borderRadius: '15px', padding: '10px'}}/>
                </div>
                
                <div className={styles.details}>
                  <h2 className={styles.itemTitle}>Testo Klausimai</h2>
                </div>
              </div>

            </div>

            <div className={styles.right}>
              <div className={styles.computerFeature}>
                <FaQuestion style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
                <span className={styles.computerFeatureText}>Viso <br/> Klausimų:</span>
                <br/>
                <span className={styles.computerFeatureText}>{data.questioncount}</span>
              </div>

              <div className={styles.computerFeature}>
                <BsHandThumbsUp style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
                <span className={styles.computerFeatureText}>Tikri<br/>Pavyzdžiai:</span>
                <br/>
                <span className={styles.computerFeatureText}>{data.goodcount} / {data.goodcount*100 / data.questioncount}%</span>
              </div>

              <div className={styles.computerFeature}>
                <MdPhishing style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
                <span className={styles.computerFeatureText}>Fišingo<br/>Pavyzdžiai:</span>
                <br/>
                <span className={styles.computerFeatureText}>{data.phishingcount} / {data.phishingcount*100 / data.questioncount}%</span>
              </div>

              <div className={styles.computerFeature}>
                <GrCheckboxSelected style={{fontSize: 50, backgroundColor: 'lightgrey', borderRadius: 15, padding: 10}}/>
                <span className={styles.computerFeatureText}>Opcijų<br/>Skaičius:</span>
                <br/>
                <span className={styles.computerFeatureText}>XXX</span>
              </div>
              
            </div>
          </div>
          <div className={styles.bottom} style={{minHeight: 'calc(100vh - 353px)'}}>
            <QuestionsList data={data} triggerQuestionListUpdate={triggerQuestionListUpdate}/>
          </div>
        </div>
      </div>
      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
};

export default QuestionsPage;
