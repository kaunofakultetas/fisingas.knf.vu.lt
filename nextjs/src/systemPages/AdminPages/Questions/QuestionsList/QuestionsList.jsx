'use client';
import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableContainer, TableRow } from '@mui/material';
import InteractiveImage from "@/components/other/InteractiveImage/InteractiveImage";
import EditableInteractiveImage from '@/components/other/InteractiveImage/InteractiveImageEditor';
import AddQuestion from './AddQuestion/AddQuestion';

import { Button, Checkbox, Paper, Box, TextField } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import AddLinkIcon from '@mui/icons-material/AddLink';
import DeleteIcon from '@mui/icons-material/Delete';





const QuestionRow = ({ fetchedQuestionData, triggerQuestionListUpdate }) => { // setEditingQuestionId, setIsLinkEditorOpen 
  const [question, setQuestionData] = useState(fetchedQuestionData);





  // Function to send updated question data to backend
  const sendQuestionUpdate = async () => {
    try {
      const response = await fetch('/api/admin/questions/updatequestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updatequestion',  // Indicate the action to be performed
          questionid: question.questionid,
          isphishing: question.isphishing,
          questiontext: question.questiontext,
          questionoptions: question.questionoptions.map(option => ({
            optionid: option.optionid,
            optiontext: option.optiontext,
            rightoptionanswer: option.rightoptionanswer,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      const data = await response.json();
      console.log('Update response:', data);
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };





  
  // Use useEffect to send updated question to backend every time it changes
  useEffect(() => {
    // Compare with 'fetchedQuestionData' variable before update


    // Skip sending the request if question is undefined or not fully loaded
    if (!question || !question.questionid) return;

    // Debounce the send operation to avoid excessive requests
    const debounceTimeout = setTimeout(() => {
      sendQuestionUpdate();
    }, 500);  // You can adjust the debounce delay (e.g., 500ms)

    // Cleanup the timeout if the component re-renders before the timeout ends
    return () => clearTimeout(debounceTimeout);
  }, [question]);







  const handleDescriptionChange = (newDescription) => {
    setQuestionData((prevState) => ({
      ...prevState,
      questiontext: newDescription,
    }));
  };
  

  const handleAddOption = async () => {
    try {
      // Sending a POST request to the server to create a new option
      const response = await fetch('/api/admin/questions/createnewoption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionid: question.questionid }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to create a new option');
      }
  
      // Get the response from the server, which includes the new option ID
      const data = await response.json();
      const newOption = {
        optionid: data.new_option_id, // The ID returned from the server
        optiontext: "",
        rightoptionanswer: 0,
      };
  
      // Update the state with the new option
      setQuestionData((prevState) => ({
        ...prevState,
        questionoptions: [...prevState.questionoptions, newOption], // Add the new option to the array
      }));
    } catch (error) {
      console.error('Error creating a new option:', error);
    }
  };
  

  // Function to delete an option
  const handleDeleteOption = (index) => {
    setQuestionData((prevState) => {
      const updatedOptions = prevState.questionoptions.filter((_, i) => i !== index);
      return { ...prevState, questionoptions: updatedOptions };
    });
  };

  // Function to update the question options
  const handleOptionChange = (index, updatedOptionText) => {
    setQuestionData((prevState) => {
      const updatedOptions = [...prevState.questionoptions];
      updatedOptions[index].optiontext = updatedOptionText;
      return { ...prevState, questionoptions: updatedOptions };
    });
  };

  // Function to handle the checkbox state of question options
  const handleOptionCheckboxChange = (index, checked) => {
    setQuestionData((prevState) => {
      const updatedOptions = [...prevState.questionoptions];
      updatedOptions[index].rightoptionanswer = checked ? 1 : 0;
      return { ...prevState, questionoptions: updatedOptions };
    });
  };

  // Function to handle the isphishing checkbox
  const handleIsPhishingChange = (checked) => {
    setQuestionData((prevState) => ({
      ...prevState,
      isphishing: checked ? 1 : 0,
    }));
  };




  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  // useEffect(() => {
  //   if(isLinkEditorOpen === false){
  //     triggerQuestionListUpdate();
  //   }
  // }, [isLinkEditorOpen]);



  return (
    <TableRow sx={{ borderTop: '3px solid lightgrey'}}>

      <FullScreenImageLinkEditor
        isModalOpen={isLinkEditorOpen}
        setIsModalOpen={() => {setIsLinkEditorOpen(); triggerQuestionListUpdate(); }}
        src={`/api/phishingpictures/${question.questionid}`}
        initialAreasUrl={`/api/phishingpictures/${question.questionid}/links`}
      />



      <TableCell component="th" scope="row" style={{ verticalAlign: "top", }}>
        <InteractiveImage
          src={"/api/phishingpictures/" + question.questionid}
          clickableAreasUrl={"/api/phishingpictures/" + question.questionid + "/links"}
          onImageClick={(e) => e.stopPropagation()}
          imageStyle={{
            maxWidth: "30vw",
            border: "1px solid lightgrey",
            borderRadius: 5,
            marginBottom: 5,
            webkitBoxShadow: "2px 4px 10px 1px rgba(0, 0, 0, 0.47)",
            boxShadow: "2px 4px 10px 1px rgba(201, 201, 201, 0.47)",
            marginTop: 10,
          }}
        />
        <Button
          sx={{
            color: "white",
            width: '100%',
            fontSize: 20,
            marginBottom: 30,
            background: "rgb(123, 0, 63)",
            "&:hover": {
              backgroundColor: "rgb(230, 65, 100)",
            },
          }}
          onClick={() => {
            // setEditingQuestionId(question.questionid);
            setIsLinkEditorOpen(true);
          }}
        >
          Redaguoti Nuorodas
          <AddLinkIcon sx={{ fontSize: 30, color: "white", marginLeft: 2 }} />
        </Button>
      </TableCell>
      <TableCell style={{ verticalAlign: "top"}}>
        <Button
          style={{ background: "grey", color: "white", margin: 10, marginLeft: 0, }}
          disabled
        >
          Klausimo ID: {question.questionid}
        </Button>
        <Button
          style={{ background: "grey", color: "white", margin: 10 }}
          disabled
        >
          Sukurtas: {question.created}
        </Button>
      
        <table
          style={{
            width: "100%",
            tableLayout: "fixed",
            marginBottom: 100,
            borderCollapse: "collapse",
            border: '1px solid lightgrey',            
          }}
        >
          <colgroup>
            <col style={{ width: "70%" }} />
            <col style={{ width: 120 }} />
          </colgroup>
          
          <thead>
            <tr style={{ borderBottom: "1px solid lightgrey" }}>
              <td>
                <h3 style={{ fontSize: 26, marginBottom: 0, paddingLeft: 10 }}>
                  <b>Klausimas</b>
                </h3>
              </td>
              <td style={{ textAlign: "center", paddingRight: 200 }}>
                <h3 style={{ fontSize: 26, marginBottom: 0}}>
                  <b>Teisingas</b>
                </h3>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr style={{ borderBottom: "1px solid lightgrey", marginTop: 200 }}>
              <td style={{ paddingBottom: 15, paddingTop: 15 }}>
                <div style={{ fontSize: 24, fontWeight: "bold", marginLeft: 10 }}>
                  Ar tai fišingas?
                </div>
                <TextField
                  variant="filled"
                  label={`Papildomai`}
                  defaultValue={question.questiontext}
                  onChange={(e) => handleDescriptionChange(e.target.value) }
                  multiline
                  sx={{
                    flexGrow: 1,
                    width: 'calc(100% - 76px)',
                    margin: 1,
                    marginBottom: 5,
                    "& .MuiInputLabel-root.Mui-focused": {
                      color: "#E64164",
                    },
                    "& .MuiInputBase-root:after": {
                      borderBottom: "2px solid #E64164",
                    },
                  }}
                />
              </td>
              <td style={{ textAlign: "center", alignContent: 'center' }}>
                <Checkbox
                  checked={question.isphishing}
                  onChange={(e) => handleIsPhishingChange(e.target.checked)}
                  sx={{
                    color: "rgb(123, 0, 63)",
                    '&.Mui-checked': {
                      color: "rgb(123, 0, 63)",
                    },
                    '& .MuiSvgIcon-root': { 
                      fontSize: 60, 
                    },
                  }}
                />
              </td>
            </tr>

            {question.questionoptions.map((questionoption, index) => (
              <tr style={{ borderBottom: "1px solid lightgrey" }} key={index}>
                <td
                  style={{ display: "flex", alignItems: "center", width: "100%" }}
                >
                  <TextField
                    variant="filled"
                    label={`Opcija Nr.: ${questionoption.optionid}`}
                    defaultValue={questionoption.optiontext}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    multiline
                    sx={{
                      flexGrow: 1,
                      margin: 1,
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#E64164",
                      },
                      "& .MuiInputBase-root:after": {
                        borderBottom: "2px solid #E64164",
                      },
                    }}
                  />

                  <Button
                    sx={{
                      background: "lightgrey",
                      borderRadius: 2,
                      justifyContent: "center",
                      alignContent: "center",
                      "&:hover": {
                        backgroundColor: "grey",
                      },
                    }}
                    disabled
                    onClick={() => handleDeleteOption(index)}
                  >
                    <DeleteIcon sx={{ fontSize: 24, color: "grey", padding: 1 }} />
                  </Button>
                </td>

                <td style={{ textAlign: "center" }}>
                  <Checkbox
                    checked={questionoption.rightoptionanswer === 1}
                    onChange={(e) =>
                      handleOptionCheckboxChange(index, e.target.checked)
                    }
                    style={{
                      color: "rgb(123, 0, 63)",
                    }}
                  />
                </td>
              </tr>
            ))}

            <tr>
              <td style={{ textAlign: "center" }}>
                <Button
                  sx={{
                    color: "white",
                    margin: 1,
                    width: '100%',
                    fontSize: 20,
                    background: "rgb(123, 0, 63)",
                    "&:hover": {
                      backgroundColor: "rgb(230, 65, 100)",
                    },
                  }}
                  onClick={handleAddOption}
                >
                  Sukurti naują opciją{" "}
                  <AddCircleOutlinedIcon sx={{ fontSize: 26, marginLeft: 2 }} />
                </Button>
              </td>
              <td style={{ textAlign: "center" }}></td>
            </tr>
          </tbody>
        </table>
      </TableCell>
    </TableRow>
  );
};





const QuestionsList = ({ data, triggerQuestionListUpdate }) => {
  // const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  // const [editingQuestionId, setEditingQuestionId] = useState(0);
  const [isAddQuestionModelOpen, setAddQuestionModalOpen] = useState(false);


  if (data.length === 0) {
    return ( 
      <div>Kraunasi...</div>
    );
  }
  return (
    <>

      {/* <FullScreenImageLinkEditor
        isModalOpen={isLinkEditorOpen}
        setIsModalOpen={setIsLinkEditorOpen}
        src={`/api/phishingpictures/${editingQuestionId}`}
        initialAreasUrl={`/api/phishingpictures/${editingQuestionId}/links`}
      /> */}


      {isAddQuestionModelOpen? 
        <AddQuestion 
          setOpen={setAddQuestionModalOpen} 
          getData={triggerQuestionListUpdate}
        />
      :
        <></>
      }
     


      <Box
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Button 
          variant="contained"
          onClick={() => setAddQuestionModalOpen(true)}
          sx={{ 
            fontSize: 30,
            paddingLeft: 20,
            paddingRight: 20,
            marginTop: 5,
            marginBottom: 5,
            background: 'rgb(123, 0, 63)',
            "&:hover": {
              backgroundColor: 'rgb(230, 65, 100)',
            },
          }}>
          Sukurti Naują Klausimą <AddCircleOutlinedIcon sx={{fontSize: 32, marginLeft: 2}}/>
        </Button>

      </Box>

      <TableContainer>
        <Table aria-label="simple table">
          <TableBody>
          
          <TableRow>
            <TableCell ></TableCell>
            <TableCell ></TableCell>
          </TableRow>


            {data.questions.map((question) => (   
              <QuestionRow 
                fetchedQuestionData={question} 
                triggerQuestionListUpdate={triggerQuestionListUpdate}
              />
            ))}


          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}


const FullScreenImageLinkEditor = ({ isModalOpen, setIsModalOpen, src, initialAreasUrl}) => {
  return (
    <>
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0, bottom: 0, left: 0, right: 0,
            backgroundColor: "white",
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top grey bar */}
          <div style={{
            height: 50,
            backgroundColor: 'darkgrey',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingRight: 10,
          }}>
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                width: 80,
                height: 30,
                cursor: 'pointer',
                border: '1px solid black',
                borderRadius: 5,
                background: 'darkgrey',
              }}
            >
              Atgal
            </button>
          </div>

          {/* Image container */}
          <div
            style={{
              flexGrow: 1,
              padding: '20px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <EditableInteractiveImage
              src={src}
              initialAreasUrl={initialAreasUrl}
              onSaveButtonClick={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};






export default QuestionsList;