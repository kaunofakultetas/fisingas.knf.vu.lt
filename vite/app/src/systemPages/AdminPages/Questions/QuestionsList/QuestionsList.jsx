// -----------------------------------------------------------
//  [*] Admin — QuestionsList
//
//  The question bank itself: a "Sukurti Naują Klausimą"
//  button (opens the AddQuestion upload dialog) above one
//  editable row per question.
//
//  Each row edits itself in place — the email screenshot with
//  its link areas on the left ("Redaguoti Nuorodas" opens the
//  fullscreen link editor), the question text / is-phishing
//  flag / options on the right. Every change is auto-saved:
//  the row debounces 500 ms and POSTs the whole question to
//  /api/admin/questions/updatequestion (no save button).
//
//  Option deletion is intentionally disabled — the backend
//  has no endpoint for it (answers may already reference the
//  option), so the delete button is rendered greyed out.
//
//  Split into (root component last):
//
//    FullScreenImageLinkEditor — fullscreen link-area editor
//    QuestionRow               — one self-saving question
//    QuestionsList             — the list (default export)
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";

import { Table, TableBody, TableCell, TableContainer, TableRow } from '@mui/material';
import { Button, Checkbox, TextField } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import AddLinkIcon from '@mui/icons-material/AddLink';
import DeleteIcon from '@mui/icons-material/Delete';

import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";
import InteractiveImageEditor from '@/components/Other/InteractiveImage/InteractiveImageEditor';
import AddQuestion from './AddQuestion/AddQuestion';


// TextField underline/label in the theme color when focused
const TEXT_FIELD_SX = {
  flexGrow: 1,
  margin: 1,
  "& .MuiInputLabel-root.Mui-focused": {
    color: "primary.dark",
  },
  "& .MuiInputBase-root:after": {
    borderBottom: "2px solid",
    borderBottomColor: "primary.dark",
  },
};







// -----------------------------------------------------------
// FullScreenImageLinkEditor
// -----------------------------------------------------------
//
// A fullscreen overlay wrapping InteractiveImageEditor: grey
// top bar with an "Atgal" button, the editor filling the rest
// of the screen. Saving inside the editor also closes it.
//
// Used by:
//   - QuestionRow (below) — the "Redaguoti Nuorodas" button
// -----------------------------------------------------------

function FullScreenImageLinkEditor({ isModalOpen, setIsModalOpen, src, initialAreasUrl }) {

  if (!isModalOpen) {
    return null;
  }

  return (
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
      <div
        style={{
          height: 50,
          backgroundColor: 'darkgrey',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: 10,
        }}
      >
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

      {/* The editor */}
      <div
        style={{
          flexGrow: 1,
          padding: '20px',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <div style={{ width: '100%' }}>
          <InteractiveImageEditor
            src={src}
            initialAreasUrl={initialAreasUrl}
            onSaveButtonClick={() => setIsModalOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}







// -----------------------------------------------------------
// QuestionRow
// -----------------------------------------------------------
//
// One question's inline editor. Keeps its own copy of the
// question in state and auto-saves it (debounced) whenever
// anything changes.
//
// Used by:
//   - QuestionsList (below)
// -----------------------------------------------------------

function QuestionRow({ fetchedQuestionData, triggerQuestionListUpdate }) {

  const [question, setQuestionData] = useState(fetchedQuestionData);
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);


  // Auto-save: POST the whole question 500 ms after the last
  // change. (Also fires once right after mount, re-saving the
  // just-fetched data — harmless.)
  useEffect(() => {
    if (!question || !question.questionid) return;

    const debounceTimeout = setTimeout(() => {
      axios.post('/api/admin/questions/updatequestion', {
        action: 'updatequestion',
        questionid: question.questionid,
        isphishing: question.isphishing,
        questiontext: question.questiontext,
        questionoptions: question.questionoptions.map(option => ({
          optionid: option.optionid,
          optiontext: option.optiontext,
          rightoptionanswer: option.rightoptionanswer,
        })),
      }, { withCredentials: true })
        .catch((error) => {
          console.error('Error updating question:', error);
        });
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [question]);


  const handleDescriptionChange = (newDescription) => {
    setQuestionData((prevState) => ({
      ...prevState,
      questiontext: newDescription,
    }));
  };


  const handleIsPhishingChange = (checked) => {
    setQuestionData((prevState) => ({
      ...prevState,
      isphishing: checked ? 1 : 0,
    }));
  };


  const handleOptionChange = (index, updatedOptionText) => {
    setQuestionData((prevState) => {
      const updatedOptions = [...prevState.questionoptions];
      updatedOptions[index].optiontext = updatedOptionText;
      return { ...prevState, questionoptions: updatedOptions };
    });
  };


  const handleOptionCheckboxChange = (index, checked) => {
    setQuestionData((prevState) => {
      const updatedOptions = [...prevState.questionoptions];
      updatedOptions[index].rightoptionanswer = checked ? 1 : 0;
      return { ...prevState, questionoptions: updatedOptions };
    });
  };


  // The backend creates the (empty) option and returns its ID;
  // the new option then joins the auto-saved state
  const handleAddOption = async () => {
    try {
      const response = await axios.post('/api/admin/questions/createnewoption',
        { questionid: question.questionid }, { withCredentials: true });

      const newOption = {
        optionid: response.data.new_option_id,
        optiontext: "",
        rightoptionanswer: 0,
      };

      setQuestionData((prevState) => ({
        ...prevState,
        questionoptions: [...prevState.questionoptions, newOption],
      }));
    } catch (error) {
      console.error('Error creating a new option:', error);
    }
  };


  return (
    <TableRow sx={{ borderTop: '3px solid lightgrey' }}>

      <FullScreenImageLinkEditor
        isModalOpen={isLinkEditorOpen}
        setIsModalOpen={() => { setIsLinkEditorOpen(false); triggerQuestionListUpdate(); }}
        src={`/api/phishingpictures/${question.questionid}`}
        initialAreasUrl={`/api/phishingpictures/${question.questionid}/links`}
      />

      {/* Left — the email screenshot + link editor button */}
      <TableCell component="th" scope="row" style={{ verticalAlign: "top" }}>
        <InteractiveImage
          src={"/api/phishingpictures/" + question.questionid}
          clickableAreasUrl={"/api/phishingpictures/" + question.questionid + "/links"}
          onImageClick={(e) => e.stopPropagation()}
          imageStyle={{
            maxWidth: "30vw",
            border: "1px solid lightgrey",
            borderRadius: 5,
            marginBottom: 5,
            WebkitBoxShadow: "2px 4px 10px 1px rgba(0, 0, 0, 0.47)",
            boxShadow: "2px 4px 10px 1px rgba(201, 201, 201, 0.47)",
            marginTop: 10,
          }}
        />
        <Button
          variant="contained"
          color="primary"
          sx={{
            width: '100%',
            fontSize: 20,
            marginBottom: 30,
          }}
          onClick={() => setIsLinkEditorOpen(true)}
        >
          Redaguoti Nuorodas
          <AddLinkIcon sx={{ fontSize: 30, color: "white", marginLeft: 2 }} />
        </Button>
      </TableCell>

      {/* Right — the question editor */}
      <TableCell style={{ verticalAlign: "top" }}>
        <Button
          style={{ background: "grey", color: "white", margin: 10, marginLeft: 0 }}
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
                <h3 style={{ fontSize: 26, marginBottom: 0 }}>
                  <b>Teisingas</b>
                </h3>
              </td>
            </tr>
          </thead>

          <tbody>

            {/* "Ar tai fišingas?" + the extra description */}
            <tr style={{ borderBottom: "1px solid lightgrey" }}>
              <td style={{ paddingBottom: 15, paddingTop: 15 }}>
                <div style={{ fontSize: 24, fontWeight: "bold", marginLeft: 10 }}>
                  Ar tai fišingas?
                </div>
                <TextField
                  variant="filled"
                  label="Papildomai"
                  defaultValue={question.questiontext}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  multiline
                  sx={{
                    ...TEXT_FIELD_SX,
                    width: 'calc(100% - 76px)',
                    marginBottom: 5,
                  }}
                />
              </td>
              <td style={{ textAlign: "center", alignContent: 'center' }}>
                <Checkbox
                  checked={question.isphishing}
                  onChange={(e) => handleIsPhishingChange(e.target.checked)}
                  color="primary"
                  sx={{
                    '& .MuiSvgIcon-root': {
                      fontSize: 60,
                    },
                  }}
                />
              </td>
            </tr>

            {/* The checkbox options */}
            {question.questionoptions.map((questionoption, index) => (
              <tr style={{ borderBottom: "1px solid lightgrey" }} key={questionoption.optionid}>
                <td
                  style={{ display: "flex", alignItems: "center", width: "100%" }}
                >
                  <TextField
                    variant="filled"
                    label={`Opcija Nr.: ${questionoption.optionid}`}
                    defaultValue={questionoption.optiontext}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    multiline
                    sx={TEXT_FIELD_SX}
                  />

                  {/* Deletion is not supported by the backend */}
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
                  >
                    <DeleteIcon sx={{ fontSize: 34, color: "grey" }} />
                  </Button>
                </td>

                <td style={{ textAlign: "center" }}>
                  <Checkbox
                    checked={questionoption.rightoptionanswer === 1}
                    onChange={(e) => handleOptionCheckboxChange(index, e.target.checked)}
                    color="primary"
                  />
                </td>
              </tr>
            ))}

            {/* New option */}
            <tr>
              <td style={{ textAlign: "center" }}>
                <Button
                  variant="contained"
                  color="primary"
                  sx={{
                    margin: 1,
                    width: '100%',
                    fontSize: 20,
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
}







// -----------------------------------------------------------
// QuestionsList (default export)
// -----------------------------------------------------------
//
// Used by:
//   - Questions.jsx
// -----------------------------------------------------------

export default function QuestionsList({ data, triggerQuestionListUpdate }) {

  const [isAddQuestionModalOpen, setAddQuestionModalOpen] = useState(false);


  if (!data.questions || data.questions.length === 0) {
    return (
      <div>Kraunasi...</div>
    );
  }


  return (
    <>

      {isAddQuestionModalOpen &&
        <AddQuestion
          setOpen={setAddQuestionModalOpen}
          getData={triggerQuestionListUpdate}
        />
      }

      {/* New question button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={() => setAddQuestionModalOpen(true)}
          sx={{
            fontSize: 30,
            paddingLeft: 20,
            paddingRight: 20,
            marginTop: 5,
            marginBottom: 5,
          }}
        >
          Sukurti Naują Klausimą <AddCircleOutlinedIcon sx={{ fontSize: 32, marginLeft: 2 }}/>
        </Button>
      </div>

      {/* One editable row per question */}
      <TableContainer>
        <Table aria-label="simple table">
          <TableBody>

            {data.questions.map((question) => (
              <QuestionRow
                key={question.questionid}
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
