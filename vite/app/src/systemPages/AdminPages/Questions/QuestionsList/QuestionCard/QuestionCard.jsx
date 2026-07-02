// -----------------------------------------------------------
//  [*] Admin — QuestionCard
//
//  One question of the bank as a self-saving editor card.
//
//  The header strip shows the question ID, creation date and
//  the live save status, and lets the admin toggle the
//  question on/off (iOS-style switch — only enabled questions
//  are dealt to students) or delete it with a hold-to-confirm
//  button. Deletion is safe for old grades, which read only
//  their frozen snapshots.
//
//  Below the header: the email screenshot with its link areas
//  on the left ("Redaguoti Nuorodas" opens the fullscreen
//  link editor), the question text / is-phishing flag /
//  options on the right. Every change is auto-saved: the card
//  debounces 500 ms and POSTs the whole question to
//  /api/admin/questions/updatequestion (no save button);
//  failures show an error toast.
//
//  Split into (root component last):
//
//    FullScreenImageLinkEditor — fullscreen link-area editor
//    SaveStatusIndicator       — "Saugoma… / Išsaugota" text
//    QuestionCardHeader        — ID, date, status, on/off, delete
//    QuestionImageCell         — screenshot + link editor button
//    IsPhishingEditorRow       — question text + phishing flag
//    OptionEditorRow           — one editable checkbox option
//    useQuestionEditor         — state, auto-save + backend calls
//    QuestionCard              — pure layout (default export)
//
//  Used by:
//    - QuestionsList.jsx — one card per question
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import toast from 'react-hot-toast';

import { Button, Checkbox, TextField, Tooltip } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import AddLinkIcon from '@mui/icons-material/AddLink';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";
import InteractiveImageEditor from '@/components/Other/InteractiveImage/InteractiveImageEditor';
import IOSSwitch from "@/components/Other/IOSSwitch/IOSSwitch";
import { LongPressDeleteButton } from "@/components/Other/LongPressButton";







// -----------------------------------------------------------
// FullScreenImageLinkEditor
// -----------------------------------------------------------
//
// A fullscreen overlay wrapping InteractiveImageEditor: a
// burgundy top bar with the title and an "Atgal" button, the
// editor filling the rest of the screen. Saving inside the
// editor also closes it.
//
// Rendered through a portal onto <body> — the card of a
// DISABLED question is dimmed with opacity, and an ancestor
// with opacity creates a stacking context that would trap
// (and dim) this "fullscreen" overlay inside the card.
//
// Used by:
//   - QuestionImageCell (below) — the "Redaguoti Nuorodas"
//     button
// -----------------------------------------------------------

function FullScreenImageLinkEditor({ isModalOpen, setIsModalOpen, src, initialAreasUrl }) {

  if (!isModalOpen) {
    return null;
  }

  return createPortal(
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

    </div>,
    document.body
  );
}







// -----------------------------------------------------------
// SaveStatusIndicator
// -----------------------------------------------------------
//
// The auto-save status of the card: nothing while untouched,
// "Saugoma…" while a save is on its way, a green "Išsaugota"
// checkmark once it landed. Failures are toasted by the card
// itself.
//
// Used by:
//   - QuestionCardHeader (below)
// -----------------------------------------------------------

function SaveStatusIndicator({ status }) {

  if (status === "saving") {
    return <span className="text-sm text-gray-400">Saugoma…</span>;
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-sm text-green-700">
        <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
        Išsaugota
      </span>
    );
  }

  return null;
}







// -----------------------------------------------------------
// QuestionCardHeader
// -----------------------------------------------------------
//
// The strip on top of the card: the question ID and creation
// date on the left, the save status, the enabled toggle (iOS
// style) and the hold-to-delete button on the right —
// deletion fires only after long pressing the button.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function QuestionCardHeader({ question, saveStatus, onEnabledChange, onDelete }) {

  const isEnabled = question.isenabled === 1;


  return (
    <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2 px-5 py-3 border-b border-[rgb(231,228,228)] bg-[rgb(250,250,251)] rounded-t-[15px]">

      {/* ID + creation date */}
      <div className="flex items-center flex-wrap gap-3">
        <span className="bg-[rgb(123,0,63)] text-white text-sm font-semibold rounded-[8px] px-3 py-1">
          Klausimas #{question.questionid}
        </span>
        <span className="text-sm text-gray-500">
          Sukurtas: {question.created}
        </span>

        {!isEnabled && (
          <span className="bg-gray-500 text-white text-xs font-semibold rounded-[8px] px-2.5 py-1">
            Išjungtas — studentams nerodomas
          </span>
        )}
      </div>

      {/* Save status + enabled toggle + hold-to-delete */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
        <SaveStatusIndicator status={saveStatus} />

        <Tooltip title="Ar klausimas dalinamas studentams" placement="top">
          <div className="flex items-center gap-2">
            <IOSSwitch
              checked={isEnabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
            />
            <span className="text-sm text-gray-500">{isEnabled ? "Įjungtas" : "Išjungtas"}</span>
          </div>
        </Tooltip>

        <LongPressDeleteButton
          onComplete={onDelete}
          duration={1500}
          size="small"
          variant="outlined"
          tooltip="Laikykite mygtuką, kad ištrintumėte klausimą"
          uncompletedToastMessage="Laikykite mygtuką ilgiau, kad ištrintumėte"
          progressColor="rgb(211,47,47)"
          progressBgColor="rgba(211,47,47,0.25)"
        >
          <DeleteOutlineIcon sx={{ fontSize: 20, marginRight: 0.5 }} />
          Ištrinti
        </LongPressDeleteButton>
      </div>

    </div>
  );
}







// -----------------------------------------------------------
// QuestionImageCell
// -----------------------------------------------------------
//
// The left side of the card: the email screenshot with its
// clickable link areas and the "Redaguoti Nuorodas" button
// that opens the fullscreen link editor.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function QuestionImageCell({ questionid, triggerQuestionListUpdate }) {

  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);

  return (
    <div className="w-full max-w-[500px] mx-auto lg:w-[35%] lg:max-w-none lg:mx-0 shrink-0 flex flex-col gap-2.5">

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
          width: "100%",
          border: "1px solid rgb(231,228,228)",
          borderRadius: 10,
          boxShadow: "2px 4px 10px 1px rgba(201, 201, 201, 0.47)",
        }}
      />

      <Button
        variant="outlined"
        fullWidth
        onClick={() => setIsLinkEditorOpen(true)}
        sx={{
          borderColor: 'rgb(123,0,63)',
          color: 'rgb(123,0,63)',
          '&:hover': { borderColor: 'rgb(123,0,63)', backgroundColor: 'rgba(123,0,63,0.06)' },
        }}
      >
        <AddLinkIcon sx={{ fontSize: 20, marginRight: 1 }} />
        Redaguoti Nuorodas
      </Button>

    </div>
  );
}







// -----------------------------------------------------------
// IsPhishingEditorRow
// -----------------------------------------------------------
//
// The headline row of the question editor: the "Ar tai
// fišingas?" title, the extra description field and the big
// is-phishing checkbox under the "Teisingas" column.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function IsPhishingEditorRow({ question, onDescriptionChange, onIsPhishingChange }) {
  return (
    <div className="flex items-start gap-2 border-b border-[rgb(231,228,228)] pb-4">

      <div className="flex-1">
        <div className="text-xl font-bold text-[#555] mb-2">
          Ar tai fišingas?
        </div>
        <TextField
          variant="filled"
          label="Papildomai"
          defaultValue={question.questiontext}
          onChange={(e) => onDescriptionChange(e.target.value)}
          multiline
          fullWidth
          sx={{
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
      </div>

      <div className="w-[70px] sm:w-[110px] shrink-0 text-center self-center">
        <Checkbox
          checked={question.isphishing === 1}
          onChange={(e) => onIsPhishingChange(e.target.checked)}
          color="primary"
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: 48,
            },
          }}
        />
      </div>

    </div>
  );
}







// -----------------------------------------------------------
// OptionEditorRow
// -----------------------------------------------------------
//
// One editable checkbox option: its text field, the
// hold-to-delete button and the right-answer checkbox.
// Deletion is safe for old grades (frozen snapshots), so a
// 3-second hold is the only confirmation needed.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function OptionEditorRow({ questionoption, onTextChange, onCheckboxChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 border-b border-[rgb(231,228,228)] py-2">

      <TextField
        variant="filled"
        label={`Opcija Nr.: ${questionoption.optionid}`}
        defaultValue={questionoption.optiontext}
        onChange={(e) => onTextChange(e.target.value)}
        multiline
        sx={{
          flexGrow: 1,

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

      <LongPressDeleteButton
        onComplete={onDelete}
        duration={1500}
        size="small"
        variant="text"
        tooltip="Laikykite mygtuką, kad ištrintumėte opciją"
        uncompletedToastMessage="Laikykite mygtuką ilgiau, kad ištrintumėte"
        progressColor="rgb(211,47,47)"
        progressBgColor="rgba(211,47,47,0.25)"
        sx={{ minWidth: '44px' }}
      >
        <DeleteIcon sx={{ fontSize: 22 }} />
      </LongPressDeleteButton>

      <div className="w-[70px] sm:w-[110px] shrink-0 text-center">
        <Checkbox
          checked={questionoption.rightoptionanswer === 1}
          onChange={(e) => onCheckboxChange(e.target.checked)}
          color="primary"
        />
      </div>

    </div>
  );
}







// -----------------------------------------------------------
// useQuestionEditor
// -----------------------------------------------------------
//
// All the state and backend traffic behind the card, packed
// into one hook so the QuestionCard component below stays
// pure layout.
//
// The hook keeps its own copy of the question and auto-saves
// it: every change debounces 500 ms, then the whole question
// is POSTed (no save button). The first render is skipped —
// there is nothing to save until the admin touches something.
// saveStatus mirrors the traffic ("idle" | "saving" |
// "saved") for the header indicator; failures show an error
// toast.
//
// Adding/deleting options and deleting the question talk to
// the backend immediately (not debounced) — those endpoints
// create/remove rows, so the result must be known right away.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function useQuestionEditor(fetchedQuestionData, triggerQuestionListUpdate) {

  const [question, setQuestionData] = useState(fetchedQuestionData);
  const [saveStatus, setSaveStatus] = useState("idle");   // idle | saving | saved
  const isFirstRender = useRef(true);


  // Auto-save: POST the whole question 500 ms after the last change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus("saving");

    const debounceTimeout = setTimeout(() => {
      axios.post('/api/admin/questions/updatequestion', {
        questionid: question.questionid,
        isenabled: question.isenabled,
        isphishing: question.isphishing,
        questiontext: question.questiontext,
        questionoptions: question.questionoptions.map(option => ({
          optionid: option.optionid,
          optiontext: option.optiontext,
          rightoptionanswer: option.rightoptionanswer,
        })),
      }, { withCredentials: true })
        .then(() => {
          setSaveStatus("saved");
        })
        .catch(() => {
          setSaveStatus("idle");
          toast.error(<b>Nepavyko išsaugoti klausimo #{question.questionid}</b>, { duration: 5000 });
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


  const handleEnabledChange = (checked) => {
    setQuestionData((prevState) => ({
      ...prevState,
      isenabled: checked ? 1 : 0,
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
    } catch {
      toast.error(<b>Nepavyko sukurti opcijos</b>, { duration: 5000 });
    }
  };


  // Deleted options leave the local state immediately — no
  // full page refetch needed
  const handleDeleteOption = async (optionid) => {
    try {
      await axios.post('/api/admin/questions/deleteoption',
        { optionid }, { withCredentials: true });

      setQuestionData((prevState) => ({
        ...prevState,
        questionoptions: prevState.questionoptions.filter((option) => option.optionid !== optionid),
      }));
      toast.success(<b>Opcija ištrinta</b>, { duration: 3000 });
    } catch {
      toast.error(<b>Nepavyko ištrinti opcijos</b>, { duration: 5000 });
    }
  };


  const handleDeleteQuestion = async () => {
    try {
      await axios.post('/api/admin/questions/deletequestion',
        { questionid: question.questionid }, { withCredentials: true });

      toast.success(<b>Klausimas ištrintas</b>, { duration: 3000 });
      triggerQuestionListUpdate();
    } catch {
      toast.error(<b>Nepavyko ištrinti klausimo</b>, { duration: 5000 });
    }
  };


  return {
    question,
    saveStatus,
    handleDescriptionChange,
    handleIsPhishingChange,
    handleEnabledChange,
    handleOptionChange,
    handleOptionCheckboxChange,
    handleAddOption,
    handleDeleteOption,
    handleDeleteQuestion,
  };
}







// -----------------------------------------------------------
// QuestionCard (default export)
// -----------------------------------------------------------
//
// Pure layout — all state, auto-saving and backend calls live
// in the useQuestionEditor hook above.
//
// Used by:
//   - QuestionsList.jsx — one card per question
// -----------------------------------------------------------

export default function QuestionCard({ fetchedQuestionData, triggerQuestionListUpdate }) {

  const {
    question,
    saveStatus,
    handleDescriptionChange,
    handleIsPhishingChange,
    handleEnabledChange,
    handleOptionChange,
    handleOptionCheckboxChange,
    handleAddOption,
    handleDeleteOption,
    handleDeleteQuestion,
  } = useQuestionEditor(fetchedQuestionData, triggerQuestionListUpdate);

  const isEnabled = question.isenabled === 1;


  return (
    <div className={`bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] ${isEnabled ? "" : "opacity-70"}`}>

      <QuestionCardHeader
        question={question}
        saveStatus={saveStatus}
        onEnabledChange={handleEnabledChange}
        onDelete={handleDeleteQuestion}
      />

      {/* Body — image next to the editor, stacked on narrow screens */}
      <div className="flex flex-col lg:flex-row gap-5 p-5">

        <QuestionImageCell
          questionid={question.questionid}
          triggerQuestionListUpdate={triggerQuestionListUpdate}
        />

        {/* Right — the question editor */}
        <div className="flex-1 flex flex-col gap-2">

          {/* Column headings */}
          <div className="flex items-center">
            <span className="flex-1 text-lg font-bold text-[#555]">Klausimas</span>
            <span className="w-[70px] sm:w-[110px] shrink-0 text-center text-lg font-bold text-[#555]">Teisingas</span>
          </div>

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
              onDelete={() => handleDeleteOption(questionoption.optionid)}
            />
          ))}

          {/* New option */}
          <Button
            variant="outlined"
            onClick={handleAddOption}
            sx={{
              marginTop: 1,
              alignSelf: 'flex-start',
              borderColor: 'rgb(123,0,63)',
              color: 'rgb(123,0,63)',
              '&:hover': { borderColor: 'rgb(123,0,63)', backgroundColor: 'rgba(123,0,63,0.06)' },
            }}
          >
            <AddCircleOutlinedIcon sx={{ fontSize: 20, marginRight: 1 }} />
            Sukurti naują opciją
          </Button>

        </div>
      </div>
    </div>
  );
}
