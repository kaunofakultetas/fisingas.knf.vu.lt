import styles from "./Widget.module.scss";

import * as React from 'react';
import LinearProgress from '@mui/joy/LinearProgress';
import Typography from '@mui/joy/Typography';
import Box from '@mui/joy/Box';

const StudentProgress = ({ text, studentsprogress }) => {

  if (studentsprogress === undefined) {
    return <></>;
  }

  return (
    <div style={{
      justifyContent: 'space-between',
      flex: 1,
      padding: 10,
      webkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
      boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
      borderRadius: 15,
      width: '100%',
      minHeight: 100,
      backgroundColor: 'white',
    }}>
      
      <div className={styles.left}>
        <span 
          className={styles.title}
          style={{
            marginBottom: 10
          }}
        >
          {text}
        </span>
      </div>
      

      <Box style={{padding: 10}}>
        {studentsprogress.length === 0 ?
          <Box>Šiuo metu testo nesprendžia nei vienas studentas</Box>
        :
          <>
            {studentsprogress.map((student, index) => (
              <Box
                key={index}
                style={{
                  backgroundColor: 'white',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 10
                }}
              >
                <Box style={{ fontSize: 20, width: 250, marginRight: '8px' }}>{student.username}:</Box>

                <LinearProgress
                  determinate
                  variant="outlined"
                  size="sm"
                  thickness={32}
                  value={
                    student.isfinished === 0 ? Math.round(student.answeredquestioncount*100 / student.questioncount) : 100
                  }
                  color= {student.isfinished === 1 ? "success" : undefined}
                  sx={{
                    width: '100%',
                    '--LinearProgress-radius': '10px',
                    '--LinearProgress-progressThickness': '24px',
                    boxShadow: 'sm',
                    borderColor: 'neutral.500',
                    // '& .MuiLinearProgress-bar': {
                    //   backgroundColor: "red",
                    // },
                  }}
                >
                  <Typography
                    level="body-xs"
                    fontWeight="xl"
                    sx={{
                      position: 'absolute',
                      color: '#000000',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    {student.isfinished === 0 ?
                      <>{`${student.answeredquestioncount} / ${student.questioncount}`}</>
                    :
                      <>(TESTAS BAIGTAS)</>
                    }
                  </Typography>
                </LinearProgress>
              </Box>
            ))}
          </>
        }
      </Box>

    </div>
  );
};

export default StudentProgress;
