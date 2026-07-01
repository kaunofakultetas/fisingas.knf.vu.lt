// -----------------------------------------------------------
//  [*] Admin — StudentAnswers
//
//  The full per-question answer review: for every question the
//  student got, the email screenshot (with hoverable link
//  areas) next to a table comparing the correct answers with
//  what the student picked. Green cells are correct, red are
//  wrong; the "Ar tai fišingas?" row shows "Neatsakė" if the
//  question was never answered. Each question ends with its
//  ID and points.
//
//  Data comes from GET /api/admin/students/<id>/answers —
//  the backend also allows students to read their own.
//
//  Used by:
//    - StudentInformation.jsx — the "Atsakymai" tab
//    - StudentPages/TestFinish — the student's own review
// -----------------------------------------------------------

import { Table, TableBody, TableCell, TableContainer, TableRow, Paper, Checkbox } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";


export default function StudentAnswers({ studentID }) {

  const { data } = useFetchData("/api/admin/students/" + studentID + "/answers");


  return (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableBody>
          {data.map((answer) => (
            <TableRow key={answer.id} style={{ border: '3px solid lightgrey' }}>

              {/* Left — the email screenshot */}
              <TableCell component="th" scope="row" style={{ verticalAlign: 'top' }}>
                <InteractiveImage
                  src={"/api/phishingpictures/" + answer.id}
                  clickableAreasUrl={"/api/phishingpictures/" + answer.id + "/links"}
                  onImageClick={(e) => e.stopPropagation()}
                  imageStyle={{
                    maxWidth: '30vw',
                    border: '1px solid lightgrey',
                    borderRadius: 10,
                    marginBottom: 30,
                    WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
                    boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
                  }}
                />
              </TableCell>

              {/* Right — correct vs. answered comparison */}
              <TableCell style={{ verticalAlign: 'top' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', paddingLeft: 20, marginBottom: 60, borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col style={{ width: '70%' }}/>
                    <col style={{ width: 100 }}/>
                    <col style={{ width: 100 }}/>
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '2px solid lightgrey' }}>
                      <td><h3><b>Klausimas</b></h3></td>
                      <td style={{ textAlign: 'center' }}><h3><b>Teisingas</b></h3></td>
                      <td style={{ textAlign: 'center' }}><h3><b>Atsakyta</b></h3></td>
                    </tr>
                  </thead>
                  <tbody>

                    {/* Was it identified as phishing correctly? */}
                    <tr style={{ borderBottom: '1px solid lightgrey' }}>
                      <td style={{ paddingBottom: 15, paddingTop: 15 }}>
                        <div style={{ fontSize: 18, fontWeight: 'bold' }}>Ar tai fišingas?</div>
                        <div style={{ fontSize: 10 }}><i>{answer.questiontext}</i></div>
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          background: answer.isphishing === answer.isphishinganswer ? 'green' : 'red',
                        }}
                      >
                        <Checkbox
                          checked={answer.isphishing}
                          disabled
                          style={{ color: "white" }}
                        />
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          background: answer.isphishing === answer.isphishinganswer ? 'green' : 'red',
                        }}
                      >
                        {answer.isphishinganswer !== null ?
                          <Checkbox
                            checked={answer.isphishinganswer}
                            disabled
                            style={{ color: "white" }}
                          />
                        :
                          <b style={{ color: 'white', border: '2px solid white', padding: 5, borderRadius: 2 }}>Neatsakė</b>
                        }
                      </td>
                    </tr>

                    {/* The question's checkbox options */}
                    {answer.answeredoptions.map((answeredoption) => (
                      <tr key={answeredoption.optiontext} style={{ borderBottom: '1px solid lightgrey' }}>
                        <td>{answeredoption.optiontext}</td>
                        <td
                          style={{
                            textAlign: 'center',
                            background: answeredoption.rightansweroption === answeredoption.selectedansweroption ? 'green' : 'red',
                          }}
                        >
                          <Checkbox
                            checked={answeredoption.rightansweroption === 1}
                            disabled
                            style={{ color: "white" }}
                          />
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            background: answeredoption.rightansweroption === answeredoption.selectedansweroption ? 'green' : 'red',
                          }}
                        >
                          <Checkbox
                            checked={answeredoption.selectedansweroption === 1}
                            disabled
                            style={{ color: "white" }}
                          />
                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>

                {/* Question ID + points */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      border: '3px solid lightgrey', borderRadius: 15, padding: 15, marginBottom: 50, display: 'inline-flex',
                      WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
                      boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
                    }}
                  >
                    <div style={{ padding: 30, paddingRight: 60, fontSize: 25, fontWeight: 'bold', textAlign: 'left', borderRight: '3px solid lightgrey' }}>
                      Klausimo ID: {answer.id}
                    </div>
                    <div style={{ padding: 30, paddingLeft: 60, fontSize: 25, fontWeight: 'bold', textAlign: 'left' }}>
                      Taškai: {answer.answerpoints}
                    </div>
                  </div>
                </div>

              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
