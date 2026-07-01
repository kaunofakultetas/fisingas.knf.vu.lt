// -----------------------------------------------------------
//  [*] Student — Sidebar
//
//  Right-hand panel of the test page: a grid of numbered
//  buttons (one per question) for jumping around the test,
//  and the "Užbaigti testą" button.
//
//  Button colors show progress: burgundy = not answered yet,
//  grey = answered; the current question gets a white ring
//  around its number.
//
//  Finishing navigates with a full page load on purpose — the
//  session is re-checked and the finished student can no
//  longer return to the test.
//
//  Used by:
//    - TestHome — the student test page
// -----------------------------------------------------------

import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';


export default function StudentSidebar({ currentQuestionIndex, setCurrentQuestionIndex, questionsData }) {
  return (
    <div className="w-1/5 max-w-[250px] bg-[#f9f9f9] pt-[150px] pb-[150px] px-10" style={{ border: '1px solid lightgrey' }}>

      {/* Question jump buttons */}
      <h2 className="text-xl mb-5">Klausimai</h2>
      <Grid container columnSpacing={2} rowSpacing={2}>
        {questionsData.map((question, index) => (
          <Grid size={4} key={index} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={() => setCurrentQuestionIndex(index)}
              sx={{
                background: question.selectedanswer !== null ? 'grey' : 'rgb(123, 0, 63)',
                width: '100%',
                minWidth: 0,
                minHeight: 0,
                padding: '2px',
                '&:hover': { backgroundColor: 'rgb(230, 65, 100)' },
              }}
            >
              <div style={currentQuestionIndex === index ? { border: '1px solid white', padding: 0, borderRadius: '50%', width: 23 } : { padding: 1 }}>
                {index + 1}
              </div>
            </Button>
          </Grid>
        ))}
      </Grid>

      {/* Finish the test */}
      <Button
        variant="contained"
        sx={{ background: 'rgb(123, 0, 63)', marginTop: '30px', width: "100%", '&:hover': { backgroundColor: 'rgb(230, 65, 100)' } }}
        onClick={() => { window.location.href = "/student/finish" }}
      >
        Užbaigti testą
      </Button>

    </div>
  );
}
