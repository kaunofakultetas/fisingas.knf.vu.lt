import React from 'react';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

const StudentSidebar = ({ currentQuestionIndex, setCurrentQuestionIndex, questionsData }) => {

  return (
    <div className="w-1/5 max-w-[250px] bg-[#f9f9f9] pt-[150px] pb-[150px] px-10" style={{ border: '1px solid lightgrey' }}>
      <h2 className="text-xl mb-5">Klausimai</h2>
      <Grid container columnSpacing={2} rowSpacing={2}>
        {Array.from({ length: questionsData.length }, (_, index) => {
          let questionNumber = index + 1;  
          return (
            <Grid size={4} key={questionNumber} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={() => (setCurrentQuestionIndex(index))}
                sx={{
                  background: questionsData[index].selectedanswer !== null ? 'grey' : 'rgb(123, 0, 63)',
                  width: '100%',
                  minWidth: 0,
                  minHeight: 0,
                  padding: '2px',
                  '&:hover': { backgroundColor: 'rgb(230, 65, 100)' },
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
        sx={{ background: 'rgb(123, 0, 63)', marginTop: '30px', width: "100%", '&:hover': { backgroundColor: 'rgb(230, 65, 100)' } }}
        onClick={() => { window.location.href = "/student/finish" }}
      >
        Užbaigti testą
      </Button>
    </div>
  );
};

export default StudentSidebar;

