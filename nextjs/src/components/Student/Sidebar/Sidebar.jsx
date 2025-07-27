import React from 'react';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import styles from './Sidebar.module.css';

const StudentSidebar = ({ currentQuestionIndex, setCurrentQuestionIndex, questionsData }) => {

  return (
    <div className={styles.container} style={{paddingTop: 150, paddingBottom: 150, paddingLeft: 40, paddingRight: 40 }}>
      <h2 className={styles.heading}>Klausimai</h2>
      <Grid container columnSpacing={2} rowSpacing={2}>
        {Array.from({ length: questionsData.length }, (_, index) => {
          let questionNumber = index + 1;  
          return (
            <Grid item xs={4} key={questionNumber} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={() => (setCurrentQuestionIndex(index))}
                style={{
                  background: questionsData[index].selectedanswer !== null ? 'grey' : 'rgb(123, 0, 63)',
                  width: '100%',
                  minWidth: 0,
                  minHeight: 0,
                  padding: 2
                }}
              >
                <div style={currentQuestionIndex === index ? {border: '1px solid white', padding: 0, borderRadius: '50%', width: 23} : {padding: 1, } }>
                  {questionNumber}
                </div>
              </Button>
            </Grid>
          )
        })}
      </Grid>
      <Button
        variant="contained"
        color="primary"
        style={{ background: 'rgb(123, 0, 63)', marginTop: 30, width: "100%" }}
        onClick={() => { window.location.href = "/student/finish" }}
      >
        Užbaigti testą
      </Button>
    </div>
  );
};

export default StudentSidebar;

