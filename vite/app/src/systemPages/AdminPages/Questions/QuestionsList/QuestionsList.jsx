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
//    QuestionImageCell         — screenshot + link editor button
//    IsPhishingEditorRow       — question text + phishing flag
//    OptionEditorRow           — one editable checkbox option
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";
import InteractiveImageEditor from '@/components/Other/InteractiveImage/InteractiveImageEditor';
import AddQuestion from './AddQuestion/AddQuestion';







// -----------------------------------------------------------
// FullScreenImageLinkEditor
// -----------------------------------------------------------
//
// A fullscreen overlay wrapping InteractiveImageEditor: a
// burgundy top bar with the title and an "Atgal" button, the
// editor filling the rest of the screen. Saving inside the
// editor also closes it.
//
// Used by:
//   - QuestionImageCell (below) — the "Redaguoti Nuorodas"
//     button
// -----------------------------------------------------------

function FullScreenImageLinkEditor({ isModalOpen, setIsModalOpen, src, initialAreasUrl }) {

  if (!isModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-white">

      {/* Top bar — title + back */}
      <div className="h-[55px] bg-[rgb(123,0,63)] flex items-center justify-between px-5 text-white shrink-0">
        <div className="flex items-center gap-2">
          <AddLinkIcon />
          <span className="font-semibold">Nuorodų Redagavimas</span>
        </div>
        <button
          onClick={() => setIsModalOpen(false)}
          className="flex items-center gap-1.5 border border-white/60 rounded-lg px-4 py-1.5 text-sm cursor-pointer hover:bg-white/10"
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          Atgal
        </button>
      </div>

      {/* The editor */}
      <div className="grow overflow-hidden">
        <InteractiveImageEditor
          src={src}
          initialAreasUrl={initialAreasUrl}
          onSaveButtonClick={() => setIsModalOpen(false)}
        />
      </div>

    </div>
  );
}







// -----------------------------------------------------------
// QuestionImageCell
// -----------------------------------------------------------
//
// The left cell of a question row: the email screenshot with
// its clickable link areas and the "Redaguoti Nuorodas"
// button that opens the fullscreen link editor.
//
// Used by:
//   - QuestionRow (below)
// -----------------------------------------------------------

function QuestionImageCell({ questionid, triggerQuestionListUpdate }) {

  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);

  return (
    <TableCell component="th" scope="row" className="align-top">

      <FullScreenImageLinkEditor
        isModalOpen={isLinkEditorOpen}
        setIsModalOpen={() => { setIsLinkEditorOpen(false); triggerQuestionListUpdate(); }}
        src={`/api/phishingpictures/${questionid}`}
        initialAreasUrl={`/api/phishingpictures/${questionid}/links`}
      />

      <InteractiveImage
        src={"/api/phishingpictures/" + questionid}
        clickableAreasUrl={"/api/phishingpictures/" + questionid + "/links"}
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
  );
}







// -----------------------------------------------------------
// IsPhishingEditorRow
// -----------------------------------------------------------
//
// The headline row of the question editor: the "Ar tai
// fišingas?" title, the extra description field and the big
// is-phishing checkbox.
//
// Used by:
//   - QuestionRow (below)
// -----------------------------------------------------------

function IsPhishingEditorRow({ question, onDescriptionChange, onIsPhishingChange }) {
  return (
    <tr className="border-b border-[lightgrey]">
      <td className="py-[15px]">
        <div className="text-2xl font-bold ml-2.5">
          Ar tai fišingas?
        </div>
        <TextField
          variant="filled"
          label="Papildomai"
          defaultValue={question.questiontext}
          onChange={(e) => onDescriptionChange(e.target.value)}
          multiline
          sx={{
            flexGrow: 1,
            margin: 1,
            width: 'calc(100% - 76px)',
            marginBottom: 5,

            // Underline/label in the theme color when focused
            "& .MuiInputLabel-root.Mui-focused": {
              color: "primary.dark",
            },
            "& .MuiInputBase-root:after": {
              borderBottom: "2px solid",
              borderBottomColor: "primary.dark",
            },
          }}
        />
      </td>
      <td className="text-center content-center">
        <Checkbox
          checked={question.isphishing}
          onChange={(e) => onIsPhishingChange(e.target.checked)}
          color="primary"
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: 60,
            },
          }}
        />
      </td>
    </tr>
  );
}







// -----------------------------------------------------------
// OptionEditorRow
// -----------------------------------------------------------
//
// One editable checkbox option: its text field, the (disabled)
// delete button and the right-answer checkbox.
//
// Used by:
//   - QuestionRow (below)
// -----------------------------------------------------------

function OptionEditorRow({ questionoption, onTextChange, onCheckboxChange }) {
  return (
    <tr className="border-b border-[lightgrey]">
      <td className="flex items-center w-full">
        <TextField
          variant="filled"
          label={`Opcija Nr.: ${questionoption.optionid}`}
          defaultValue={questionoption.optiontext}
          onChange={(e) => onTextChange(e.target.value)}
          multiline
          sx={{
            flexGrow: 1,
            margin: 1,

            // Underline/label in the theme color when focused
            "& .MuiInputLabel-root.Mui-focused": {
              color: "primary.dark",
            },
            "& .MuiInputBase-root:after": {
              borderBottom: "2px solid",
              borderBottomColor: "primary.dark",
            },
          }}
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

      <td className="text-center">
        <Checkbox
          checked={questionoption.rightoptionanswer === 1}
          onChange={(e) => onCheckboxChange(e.target.checked)}
          color="primary"
        />
      </td>
    </tr>
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
    <TableRow className="border-t-[3px] border-[lightgrey]">

      <QuestionImageCell
        questionid={question.questionid}
        triggerQuestionListUpdate={triggerQuestionListUpdate}
      />

      {/* Right — the question editor */}
      <TableCell className="align-top">
        <Button className="m-2.5 ml-0" style={{ background: "grey", color: "white" }} disabled>
          Klausimo ID: {question.questionid}
        </Button>
        <Button className="m-2.5" style={{ background: "grey", color: "white" }} disabled>
          Sukurtas: {question.created}
        </Button>

        <table className="w-full table-fixed mb-[100px] border-collapse border border-[lightgrey]">
          <colgroup>
            <col className="w-[70%]" />
            <col className="w-[120px]" />
          </colgroup>

          <thead>
            <tr className="border-b border-[lightgrey]">
              <td>
                <h3 className="text-[26px] mb-0 pl-2.5">
                  <b>Klausimas</b>
                </h3>
              </td>
              <td className="text-center pr-[200px]">
                <h3 className="text-[26px] mb-0">
                  <b>Teisingas</b>
                </h3>
              </td>
            </tr>
          </thead>

          <tbody>

            <IsPhishingEditorRow
              question={question}
              onDescriptionChange={handleDescriptionChange}
              onIsPhishingChange={handleIsPhishingChange}
            />

            {question.questionoptions.map((questionoption, index) => (
              <OptionEditorRow
                key={questionoption.optionid}
                questionoption={questionoption}
                onTextChange={(text) => handleOptionChange(index, text)}
                onCheckboxChange={(checked) => handleOptionCheckboxChange(index, checked)}
              />
            ))}

            {/* New option */}
            <tr>
              <td className="text-center">
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
              <td></td>
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
      <div className="flex justify-center">
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
