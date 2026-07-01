// -----------------------------------------------------------
//  [*] Admin — StudentProgress
//
//  White dashboard card listing the students currently taking
//  the test, each with a progress bar (answered / total
//  questions). Finished students get a green bar with a
//  "(TESTAS BAIGTAS)" label.
//
//  `studentsprogress` comes straight from /api/admin/home
//  (the dashboard polls it every 2 s, so the bars move live).
//
//  Used by:
//    - AdminPages/Home — the "Testą Sprendžia:" card
// -----------------------------------------------------------

import { Box, LinearProgress, Typography } from '@mui/material';


export default function StudentProgress({ text, studentsprogress }) {

  if (studentsprogress === undefined) {
    return null;
  }

  return (
    <div className="justify-between flex-1 p-2.5 rounded-[15px] w-full min-h-[100px] bg-white shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">

      {/* Card label */}
      <span className="font-semibold text-gray-500 text-sm mb-2.5 block">
        {text}
      </span>

      {/* One progress bar per active student */}
      <Box className="p-2.5">
        {studentsprogress.length === 0 ?
          <Box>Šiuo metu testo nesprendžia nei vienas studentas</Box>
        :
          studentsprogress.map((student, index) => (
            <Box key={index} className="bg-white w-full flex items-center mb-2.5">
              <Box className="text-xl w-[250px] mr-2">{student.username}:</Box>

              <Box sx={{ position: 'relative', width: '100%' }}>
                <LinearProgress
                  variant="determinate"
                  value={
                    student.isfinished === 0 ? Math.round(student.answeredquestioncount * 100 / student.questioncount) : 100
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
                    `${student.answeredquestioncount} / ${student.questioncount}`
                  :
                    '(TESTAS BAIGTAS)'
                  }
                </Typography>
              </Box>
            </Box>
          ))
        }
      </Box>

    </div>
  );
}
