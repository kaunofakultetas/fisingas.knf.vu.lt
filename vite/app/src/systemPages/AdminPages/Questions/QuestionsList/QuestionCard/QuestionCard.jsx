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
//  link editor; once it closes, the preview loads the areas
//  anew), the question text / is-phishing flag / options on
//  the right. Every change is auto-saved: the card debounces
//  500 ms and POSTs the whole question to
//  /api/admin/questions/updatequestion (no save button). One
//  save at a time, so the newest state is always the last to
//  land; an edit still waiting when the card goes away is sent
//  at once, and while one waits (or a save runs) the browser
//  asks before the page is reloaded or closed. Failures show
//  an error toast, an expired session goes to /login.
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

import { useState, useEffect, useRef, useCallback } from "react";
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
import { redirectOnExpiredSession } from "@/utils/session";
import { formatDateTime } from "@/utils/timestamps";







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
// "Saugoma…" from an edit until it is saved, a green
// "Išsaugota" checkmark once the newest edit landed.
// Failures are toasted by the card itself.
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
// deletion fires only after long pressing the button. The
// toggle and the button carry the question number in their
// names: the bank shows every card on one page.
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
          Sukurtas: {formatDateTime(question.created) || "—"}
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

        {/* The tooltip's text labels only the wrapping div, which
            screen readers pass over — the switch gets its own */}
        <Tooltip title="Ar klausimas dalinamas studentams" placement="top">
          <div className="flex items-center gap-2">
            <IOSSwitch
              checked={isEnabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              slotProps={{ input: { "aria-label": `Ar klausimas #${question.questionid} dalinamas studentams` } }}
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
          aria-label={`Ištrinti klausimą #${question.questionid}`}
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
// The preview fetches the areas once for its image, so
// closing the editor gives it a new key: the remounted
// preview fetches them anew and shows them as the editor
// left them, not as they were before.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function QuestionImageCell({ questionid, triggerQuestionListUpdate }) {

  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);


  const closeLinkEditor = () => {
    setIsLinkEditorOpen(false);
    setPreviewKey((key) => key + 1);
    triggerQuestionListUpdate();
  };


  return (
    <div className="w-full max-w-[500px] mx-auto lg:w-[35%] lg:max-w-none lg:mx-0 shrink-0 flex flex-col gap-2.5">

      <FullScreenImageLinkEditor
        isModalOpen={isLinkEditorOpen}
        setIsModalOpen={closeLinkEditor}
        src={`/api/phishingpictures/${questionid}`}
        initialAreasUrl={`/api/phishingpictures/${questionid}/links`}
      />

      <InteractiveImage
        key={previewKey}
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
// is-phishing checkbox under the "Teisingas" column — named
// after the title and the question number, since neither
// text labels it and every card has one.
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
          slotProps={{ input: { "aria-label": `Ar tai fišingas? (klausimas #${question.questionid})` } }}
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
// hold-to-delete button and the right-answer checkbox — the
// last two named after the option, as the button shows only
// an icon and the checkbox sits under a column heading.
// Deletion is safe for old grades (frozen snapshots), so a
// 1.5-second hold is the only confirmation needed.
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
        aria-label={`Ištrinti opciją Nr.: ${questionoption.optionid}`}
      >
        <DeleteIcon sx={{ fontSize: 22 }} />
      </LongPressDeleteButton>

      <div className="w-[70px] sm:w-[110px] shrink-0 text-center">
        <Checkbox
          checked={questionoption.rightoptionanswer === 1}
          onChange={(e) => onCheckboxChange(e.target.checked)}
          color="primary"
          slotProps={{ input: { "aria-label": `Teisinga opcija Nr.: ${questionoption.optionid}` } }}
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
// it: every edit shows "Saugoma…" at once and (re)starts a
// 500 ms debounce, then the whole question is POSTed (no save
// button). Nothing is saved until the admin edits something.
//
// Saves are SERIALISED: only one POST is on its way at a
// time. A save that comes due meanwhile waits for its reply,
// and then the newest question goes out — so an older state
// can never land last and overwrite a newer one. Replies
// speak only for the newest edit: while a newer one still
// waits (in the debounce or behind the running save), an
// answer is ignored — that edit's own save will carry its
// changes too. So "Išsaugota" and the failure toast always
// describe what the card shows. An edit still in the
// debounce when the card goes away is sent at once; while an
// edit waits or a save runs, the browser asks before the page
// itself is left (a reload, closing the tab).
//
// Adding/deleting options and deleting the question talk to
// the backend immediately (not debounced) — those endpoints
// create/remove rows, so the result must be known right away.
// An expired session (401) on any request goes to /login.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function useQuestionEditor(fetchedQuestionData, triggerQuestionListUpdate) {

  const [question, setQuestionData] = useState(fetchedQuestionData);
  const [saveStatus, setSaveStatus] = useState("idle");   // idle | saving | saved

  // The newest question, which every save sends — saves run
  // from timers, replies and the unmount, where a render's
  // `question` may be stale
  const latestQuestion = useRef(fetchedQuestionData);
  const debounceTimer = useRef(null);   // set while an edit waits out the debounce
  const saveRunning = useRef(false);
  const saveQueued = useRef(false);     // a save came due while one was running
  const alive = useRef(false);          // the card is on screen (the lifetime effect below)


  // An edit newer than the save that just answered still
  // waits — its own save will set the status
  const newerEditWaiting = () => saveQueued.current || debounceTimer.current !== null;


  // A full page load (a reload, closing the tab, "Atsijungti")
  // never unmounts the card, so it would lose an edit still
  // waiting or a save still on its way — while there is one,
  // the browser asks before leaving. Every card has its own
  // handler: the browser keeps one registration per function,
  // so a handler shared by all cards would be removed for all
  // of them by the first card whose edits are saved
  const askBeforeLeaving = useCallback((event) => {
    event.preventDefault();
    event.returnValue = "";
  }, []);

  const guardUnload = () => {
    if (debounceTimer.current !== null || saveRunning.current) {
      window.addEventListener("beforeunload", askBeforeLeaving);
    } else {
      window.removeEventListener("beforeunload", askBeforeLeaving);
    }
  };


  // POST the newest question — or, while a save is on its way,
  // only queue it: the running save sends the newest question
  // once more when its reply is in
  const save = async () => {
    if (saveRunning.current) {
      saveQueued.current = true;
      return;
    }

    saveRunning.current = true;
    do {
      saveQueued.current = false;
      const saving = latestQuestion.current;

      try {
        await axios.post('/api/admin/questions/updatequestion', {
          questionid: saving.questionid,
          isenabled: saving.isenabled,
          isphishing: saving.isphishing,
          questiontext: saving.questiontext,
          questionoptions: saving.questionoptions.map(option => ({
            optionid: option.optionid,
            optiontext: option.optiontext,
            rightoptionanswer: option.rightoptionanswer,
          })),
        }, { withCredentials: true });

        if (!newerEditWaiting()) {
          setSaveStatus("saved");
        }
      } catch (error) {
        // An expired session sends the page to /login, and our
        // own redirect must not make the browser ask — the
        // session, and the edit with it, is gone. Nothing more
        // is sent then
        window.removeEventListener("beforeunload", askBeforeLeaving);
        if (redirectOnExpiredSession(error)) return;
        guardUnload();

        if (!newerEditWaiting()) {
          setSaveStatus("idle");
          toast.error(<b>Nepavyko išsaugoti klausimo #{saving.questionid}</b>, { duration: 5000 });
        }
      }
    } while (saveQueued.current);
    saveRunning.current = false;
    guardUnload();
  };


  // Every edit goes through here: the card shows it at once,
  // the save follows 500 ms after the LAST edit. A reply that
  // lands once the card is gone (an option created or deleted
  // while the admin left) changes nothing: it is on the server
  // already, and there is no card left to show or save it
  const editQuestion = (change) => {
    if (!alive.current) {
      return;
    }

    latestQuestion.current = change(latestQuestion.current);
    setQuestionData(latestQuestion.current);
    setSaveStatus("saving");

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      save();
    }, 500);
    guardUnload();
  };


  // The card's lifetime. `alive` is set here, not at useRef:
  // StrictMode runs this cleanup and then the setup again on
  // mount. Leaving the card (a sidebar link, browser back)
  // must not drop an edit still in the debounce — it is sent
  // right away. `save` works on refs and the card's one
  // (memoized) unload handler only, so the first render's copy
  // is as good as the newest
  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;

      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        save();
      }
    };
  }, []);


  const handleDescriptionChange = (newDescription) => {
    editQuestion((current) => ({
      ...current,
      questiontext: newDescription,
    }));
  };


  const handleIsPhishingChange = (checked) => {
    editQuestion((current) => ({
      ...current,
      isphishing: checked ? 1 : 0,
    }));
  };


  const handleEnabledChange = (checked) => {
    editQuestion((current) => ({
      ...current,
      isenabled: checked ? 1 : 0,
    }));
  };


  // Options are found by their ID — a row's position changes
  // when an option above it is deleted — and replaced, never
  // changed in place: the older state (and the list's copy it
  // started from) must stay as it was
  const handleOptionChange = (optionid, updatedOptionText) => {
    editQuestion((current) => ({
      ...current,
      questionoptions: current.questionoptions.map((option) =>
        option.optionid === optionid ? { ...option, optiontext: updatedOptionText } : option
      ),
    }));
  };


  const handleOptionCheckboxChange = (optionid, checked) => {
    editQuestion((current) => ({
      ...current,
      questionoptions: current.questionoptions.map((option) =>
        option.optionid === optionid ? { ...option, rightoptionanswer: checked ? 1 : 0 } : option
      ),
    }));
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

      editQuestion((current) => ({
        ...current,
        questionoptions: [...current.questionoptions, newOption],
      }));
    } catch (error) {
      if (redirectOnExpiredSession(error)) return;
      toast.error(<b>Nepavyko sukurti opcijos</b>, { duration: 5000 });
    }
  };


  // Deleted options leave the local state immediately — no
  // full page refetch needed
  const handleDeleteOption = async (optionid) => {
    try {
      await axios.post('/api/admin/questions/deleteoption',
        { optionid }, { withCredentials: true });

      editQuestion((current) => ({
        ...current,
        questionoptions: current.questionoptions.filter((option) => option.optionid !== optionid),
      }));
      toast.success(<b>Opcija ištrinta</b>, { duration: 3000 });
    } catch (error) {
      if (redirectOnExpiredSession(error)) return;
      toast.error(<b>Nepavyko ištrinti opcijos</b>, { duration: 5000 });
    }
  };


  const handleDeleteQuestion = async () => {
    try {
      await axios.post('/api/admin/questions/deletequestion',
        { questionid: question.questionid }, { withCredentials: true });

      toast.success(<b>Klausimas ištrintas</b>, { duration: 3000 });
      triggerQuestionListUpdate();
    } catch (error) {
      if (redirectOnExpiredSession(error)) return;
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

          {question.questionoptions.map((questionoption) => (
            <OptionEditorRow
              key={questionoption.optionid}
              questionoption={questionoption}
              onTextChange={(text) => handleOptionChange(questionoption.optionid, text)}
              onCheckboxChange={(checked) => handleOptionCheckboxChange(questionoption.optionid, checked)}
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
