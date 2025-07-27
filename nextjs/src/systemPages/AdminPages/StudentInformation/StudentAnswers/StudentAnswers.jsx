'use client';
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table, TableBody, TableCell, TableContainer, TableRow, Paper } from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import InteractiveImage from "@/components/other/InteractiveImage/InteractiveImage";


const StudentAnswers = ({studentID}) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get("/api/admin/students/" + studentID + "/answers");
        // console.log(response.data);
        setData(response.data);
      } catch (error) {
        // if (error.response.status === 401) {
        //   window.location.href = '/login';
        // }
      }
    }
    getData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps




  return (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableBody>
          {data.map((answer) => (   
            <TableRow style={{border: '3px solid lightgrey'}}>
              <TableCell component="th" scope="row" style={{ verticalAlign: 'top'}}>
                <InteractiveImage
                  src={"/api/phishingpictures/"+answer.id}
                  clickableAreasUrl={"/api/phishingpictures/"+answer.id+"/links"}
                  onImageClick={(e) => e.stopPropagation()}
                  imageStyle={{
                    maxWidth: '30vw', 
                    border: '1px solid lightgrey', 
                    borderRadius: 10, 
                    marginBottom: 30,
                    webkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
                    boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
                  }}
                />
              </TableCell>
              <TableCell style={{ verticalAlign: 'top'}}>
                <table style={{ width: '100%', tableLayout: 'fixed', paddingLeft: 20, marginBottom: 60, borderCollapse: 'collapse' }}>
                  <colgroup>
                      <col style={{width:'70%'}}/>
                      <col style={{width: 100}}/>
                      <col style={{width: 100}}/>
                  </colgroup>
                  <thead>
                    <tr style={{borderBottom: '2px solid lightgrey'}}>
                      <td><h3><b>Klausimas</b></h3></td>
                      <td style={{ textAlign: 'center'}}><h3><b>Teisingas</b></h3></td>
                      <td style={{ textAlign: 'center'}}><h3><b>Atsakyta</b></h3></td>
                    </tr>

                  </thead>
                  <tbody>
                    <tr style={{borderBottom: '1px solid lightgrey', marginTop: 200}}> 
                      <td style={{paddingBottom: 15, paddingTop: 15}}>
                        <div style={{fontSize: 18, fontWeight: 'bold'}}>Ar tai fišingas?</div>
                        <div style={{fontSize: 10}}><i>{answer.questiontext}</i></div>
                      </td>
                      <td 
                        style={{
                          textAlign: 'center',
                          background: answer.isphishing === answer.isphishinganswer ? 'green' : 'red'
                        }}
                      >
                        <Checkbox 
                          checked={answer.isphishing}
                          disabled 
                          style={{
                            color: "white"
                          }}
                        />
                      </td>
                      <td 
                        style={{
                          textAlign: 'center',
                          background: answer.isphishing === answer.isphishinganswer ? 'green' : 'red'
                        }}
                      >
                        {answer.isphishinganswer !== null ?
                          <Checkbox
                            checked={answer.isphishinganswer}
                            disabled
                            style={{
                              color: "white"
                            }}
                          />
                        :
                          <b style={{color: 'white', border: '2px solid white', padding: 5, borderRadius: 2}}>Neatsakė</b>
                        }
                      </td>
                    </tr>
                    
                    {answer.answeredoptions.map((answeredoption) => (
                      <tr style={{borderBottom: '1px solid lightgrey'}}>
                        <td>{answeredoption.optiontext}</td>
                        <td 
                          style={{
                            textAlign: 'center',
                            background: answeredoption.rightansweroption === answeredoption.selectedansweroption ? 'green' : 'red'
                          }}
                        >
                          <Checkbox 
                            checked={answeredoption.rightansweroption === 1}     
                            disabled    
                            style={{
                              color: "white"
                            }}
                          />
                        </td>
                        <td 
                          style={{
                            textAlign: 'center',
                            background: answeredoption.rightansweroption === answeredoption.selectedansweroption ? 'green' : 'red'
                          }}
                        >
                          <Checkbox 
                            checked={answeredoption.selectedansweroption === 1}
                            disabled
                            style={{
                              color: "white"
                            }}
                          />
                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end'}}>
                  <div 
                    style={{
                      border: '3px solid lightgrey', borderRadius: 15, padding: 15, marginBottom: 50, display: 'inline-flex',
                      webkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)', 
                      boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)'
                    }}
                  > 
                    <div style={{padding: 30, paddingRight: 60, fontSize: 25, fontWeight: 'bold', textAlign: 'left', borderRight: '3px solid lightgrey'}}>
                      Klausimo ID: {answer.id}
                    </div>
                    <div style={{padding: 30, paddingLeft: 60, fontSize: 25, fontWeight: 'bold', textAlign: 'left'}}>
                    {/* <div style={{padding: 40, fontSize: 25, fontWeight: 'bold', textAlign: 'left'}}> */}
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



export default StudentAnswers;