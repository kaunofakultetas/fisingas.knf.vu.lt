import * as React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

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
      
      <div>
        <span className="font-semibold text-gray-500 text-sm mb-2.5 block">
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

                <Box sx={{ position: 'relative', width: '100%' }}>
                  <LinearProgress
                    variant="determinate"
                    value={
                      student.isfinished === 0 ? Math.round(student.answeredquestioncount*100 / student.questioncount) : 100
                    }
                    color={student.isfinished === 1 ? "success" : "primary"}
                    sx={{
                      height: 32,
                      borderRadius: '10px',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      fontWeight: 'bold',
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
                </Box>
              </Box>
            ))}
          </>
        }
      </Box>

    </div>
  );
};

export default StudentProgress;
