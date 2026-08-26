// -----------------------------------------------------------
//  [*] Student — TestHome (the phishing test)
//
//  The test itself. The student sees one email screenshot at
//  a time and answers:
//    - "Tikras" / "Fišingas" — is this email phishing?
//    - the question's checkboxes (why / what gives it away)
//
//  Questions come from GET /api/student/questions (the
//  backend assigns each student a random subset on first
//  request). Every click POSTs the whole answer state back,
//  so progress survives a page reload and the admin dashboard
//  sees it live — one save at a time, in order, and finishing
//  waits for the last one to land so no click is ever lost.
//  The sidebar jumps between questions and ends the test.
//
//  Clicking the email opens it fullscreen; hovering a link
//  area shows its URL in both views (via InteractiveImage).
//
//  Split into (root component last):
//
//    FullScreenImage  — the zoomed-in email overlay
//    AnswerButton     — one "Tikras"/"Fišingas" button
//    OptionsList      — the question's follow-up checkboxes
//    useTestQuestions — questions state + autosave + handlers
//    QuestionCard     — the white card of the open question
//    TestHome         — the page itself (default export)
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast, { Toaster } from 'react-hot-toast';

import Navbar from "@/components/Navbar/Navbar";
import StudentSidebar from "@/components/Student/Sidebar/Sidebar";
import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";
import Footer from "@/components/Other/Footer/Footer";

import { Checkbox } from '@mui/material';
import { BsHandThumbsUp } from 'react-icons/bs';
import { MdPhishing } from 'react-icons/md';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import CloseIcon from '@mui/icons-material/Close';







// -----------------------------------------------------------
// FullScreenImage
// -----------------------------------------------------------
//
// Fullscreen view of the current email: near-black backdrop,
// a floating "Atgal" pill in the top-right corner, the email
// centered. Clicking anywhere (or pressing Escape) closes it.
// Link areas keep working (transparent overlays + URL
// tooltips).
//
// Used by:
//   - TestHome (below)
// -----------------------------------------------------------

function FullScreenImage({ isModalOpen, setIsModalOpen, url, clickableAreasUrl }) {

  // Escape closes the overlay
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, setIsModalOpen]);


  if (!isModalOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/90 cursor-zoom-out"
      onClick={() => setIsModalOpen(false)}
    >

      {/* Floating close button */}
      <button
        onClick={() => setIsModalOpen(false)}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-full
          bg-white/10 border border-white/30 text-white text-sm font-medium
          hover:bg-white/20 transition-colors cursor-zoom-out"
      >
        <CloseIcon fontSize="small" />
        Atgal
      </button>

      {/* The email centered on the backdrop */}
      <div className="relative w-full h-full p-6 overflow-hidden flex justify-center items-center">
        <InteractiveImage
          src={url}
          clickableAreasUrl={clickableAreasUrl}
          clickableAreaColor='rgba(0, 0, 0, 0.0)'
          containerStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          imageStyle={{
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            display: 'block',
            borderRadius: '8px',
          }}
        />
      </div>

    </div>
  );
}







// -----------------------------------------------------------
// AnswerButton
// -----------------------------------------------------------
//
// One of the two big verdict buttons. The selected one is
// filled brand burgundy; the other stays white with a border
// and tints on hover.
//
// Used by:
//   - QuestionCard (below) — "Tikras" (0) and "Fišingas" (1)
// -----------------------------------------------------------

function AnswerButton({ icon, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-3 px-10 py-3.5 rounded-xl border-2 text-xl font-semibold
        transition-all cursor-pointer select-none
        ${selected
          ? 'bg-[rgb(123,0,63)] border-[rgb(123,0,63)] text-white shadow-[0_4px_14px_rgba(123,0,63,0.35)]'
          : 'bg-white border-gray-300 text-gray-600 hover:border-[rgb(230,65,100)] hover:text-[rgb(123,0,63)]'
        }`}
    >
      <span className="text-3xl">{icon}</span>
      {label}
    </button>
  );
}







// -----------------------------------------------------------
// OptionsList
// -----------------------------------------------------------
//
// The question's follow-up checkboxes ("what gives it away")
// under a "Klausimai" heading. The whole row is clickable and
// highlights softly when its checkbox is ticked.
//
// Used by:
//   - QuestionCard (below)
// -----------------------------------------------------------

function OptionsList({ options, onOptionClick }) {
  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Klausimai</h3>

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {options.map((questionOption, index) => (
          <div
            key={index}
            onClick={() => onOptionClick(index)}
            className={`flex items-center justify-between gap-4 px-4 py-1.5 cursor-pointer transition-colors
              ${questionOption.isselected === 1 ? 'bg-[rgba(123,0,63,0.05)]' : 'hover:bg-gray-50'}`}
          >
            <span className="text-gray-700">{questionOption.answeroption}</span>
            <Checkbox
              checked={questionOption.isselected === 1}
              style={{ color: "rgb(123, 0, 63)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}







// -----------------------------------------------------------
// useTestQuestions
// -----------------------------------------------------------
//
// The data side of the test:
//
//   - loads the student's questions on mount (the backend
//     assigns each student a random subset on first request;
//     a 401 bounces to /login)
//   - autosaves by POSTing the whole answer state after every
//     change, so progress survives a reload and the admin
//     dashboard sees it live. Saves are SERIALISED: only one
//     POST is in flight, clicks made meanwhile are coalesced
//     into one follow-up POST of the newest state — so an
//     older state can never overtake and overwrite a newer one
//   - exposes the two mutations the page needs: the
//     "Tikras"/"Fišingas" verdict and the option toggles
//   - finishTest waits for the pending save (retrying once if
//     the last one failed) BEFORE navigating away — a hard
//     navigation would abort an in-flight POST and the backend
//     would freeze a grade missing the last click
//
// Returns { questionsData, currentQuestionIndex,
//           setCurrentQuestionIndex, loading, empty,
//           answerQuestion, toggleOption, finishTest }.
//
// Used by:
//   - TestHome (below)
// -----------------------------------------------------------

function useTestQuestions() {

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(undefined);
  const [questionsData, setQuestionsData] = useState([]);
  const [loaded, setLoaded] = useState(false);


  // Load the student's questions (assigned server-side). A
  // finished test answers {} instead of an array — treated as
  // empty rather than crashing the page (the route guard
  // normally redirects finished students before this runs)
  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get("/api/student/questions", { withCredentials: true });
        setQuestionsData(Array.isArray(response.data) ? response.data : []);
        setCurrentQuestionIndex(0);
        setLoaded(true);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          window.location.href = '/login';
        }
      }
    }
    getData();
  }, []);


  // Autosave — POST the whole answer state after every change,
  // one request at a time. latestState always holds the newest
  // answers; if a save is already running, the change only
  // marks the queue dirty and the running save sends the newest
  // state again once it is done. Every POST therefore carries a
  // state at least as new as the one before it.
  const latestState = useRef([]);
  const saveInFlight = useRef(null);      // Promise<boolean> of the running save chain
  const saveDirty = useRef(false);
  const lastSaveFailed = useRef(false);

  const save = () => {
    if (saveInFlight.current) {
      saveDirty.current = true;
      return saveInFlight.current;
    }
    saveInFlight.current = (async () => {
      do {
        saveDirty.current = false;
        try {
          await axios.post("/api/student/questions", latestState.current, { withCredentials: true });
          lastSaveFailed.current = false;
        } catch {
          lastSaveFailed.current = true;
          toast.error(<b>Nepavyko išsaugoti atsakymo — patikrinkite ryšį</b>, { duration: 5000 });
        }
      } while (saveDirty.current);
      saveInFlight.current = null;
      return !lastSaveFailed.current;
    })();
    return saveInFlight.current;
  };

  // The GET above also sets questionsData, so the first run(s)
  // are skipped: there is nothing to save until the student
  // actually clicks something
  const hasUserAnswered = useRef(false);
  useEffect(() => {
    latestState.current = questionsData;
    if (hasUserAnswered.current && questionsData.length > 0) {
      save();
    }
  }, [questionsData]);


  // Finish — only once the answers are safely on the server.
  // Waits for the running save; if the last save had failed,
  // sends the newest state once more. Still failing → the
  // student stays on the test with an error instead of
  // finishing with answers that never arrived. The navigation
  // is a full page load on purpose: the session is re-checked
  // and a finished student can no longer return to the test
  const finishTest = async () => {
    let saved = await (saveInFlight.current ?? Promise.resolve(!lastSaveFailed.current));
    if (!saved) {
      saved = await save();
    }
    if (!saved) {
      toast.error(<b>Paskutiniai atsakymai neišsaugoti — patikrinkite ryšį ir bandykite dar kartą</b>, { duration: 6000 });
      return;
    }
    window.location.href = "/student/finish";
  };


  // "Tikras" (0) / "Fišingas" (1) answer for the open question
  const answerQuestion = (selectedanswer) => {
    hasUserAnswered.current = true;
    const updatedQuestionsData = [...questionsData];
    updatedQuestionsData[currentQuestionIndex].selectedanswer = selectedanswer;
    setQuestionsData(updatedQuestionsData);

    // Bring the follow-up checkboxes into view
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };


  // Toggle one of the question's follow-up checkboxes
  const toggleOption = (optionIndex) => {
    hasUserAnswered.current = true;
    const updatedQuestionsData = [...questionsData];
    updatedQuestionsData[currentQuestionIndex].questionoptions[optionIndex].isselected =
      updatedQuestionsData[currentQuestionIndex].questionoptions[optionIndex].isselected === 1 ? 0 : 1;
    setQuestionsData(updatedQuestionsData);
  };


  return {
    questionsData,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    loading: !loaded || currentQuestionIndex === undefined,
    empty: loaded && questionsData.length === 0,
    answerQuestion,
    toggleOption,
    finishTest,
  };
}







// -----------------------------------------------------------
// QuestionCard
// -----------------------------------------------------------
//
// The white card of the open question: a header with the
// question counter and the zoom hint, the email screenshot
// (click to zoom), the "Tikras"/"Fišingas" verdict buttons,
// the optional "Papildomai" callout and the follow-up
// checkboxes.
//
// Used by:
//   - TestHome (below)
// -----------------------------------------------------------

function QuestionCard({ question, questionNumber, questionCount, onAnswer, onToggleOption, onZoom }) {
  return (
    <div className="bg-white w-full max-w-[1100px] h-fit rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] mb-8 overflow-hidden">

      {/* Card header — question counter */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-5 sm:px-8 py-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">
          Klausimas {questionNumber}
          <span className="text-gray-400 font-medium"> / {questionCount}</span>
        </h2>
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
          <ZoomInIcon fontSize="small" />
          Spustelėkite paveikslėlį, kad padidintumėte
        </span>
      </div>

      {/* The email — click to zoom in */}
      <div className="relative m-5 sm:m-8 mb-0 sm:mb-0 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <InteractiveImage
          src={`/api/phishingpictures/${question.questionid}`}
          clickableAreasUrl={`/api/phishingpictures/${question.questionid}/links`}
          clickableAreaColor='rgba(0, 0, 0, 0.0)'
          onImageClick={onZoom}
          containerStyle={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
            cursor: 'zoom-in',
          }}
          imageStyle={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            border: '1px solid rgb(229, 231, 235)',
            borderRadius: '10px',
            backgroundColor: 'white',
          }}
        />
      </div>

      <div className="px-5 sm:px-8 pb-8">

        {/* Tikras / Fišingas buttons */}
        <div className="flex flex-row flex-wrap justify-center gap-5 mt-6">
          <AnswerButton
            icon={<BsHandThumbsUp />}
            label="Tikras"
            selected={question.selectedanswer === 0}
            onClick={() => onAnswer(0)}
          />
          <AnswerButton
            icon={<MdPhishing />}
            label="Fišingas"
            selected={question.selectedanswer === 1}
            onClick={() => onAnswer(1)}
          />
        </div>

        {/* Additional info from the question */}
        {question.question !== "" &&
          <div className="mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-gray-700">
            <b className="mr-1.5">Papildomai:</b>
            {question.question}
          </div>
        }

        {/* Follow-up checkboxes */}
        <OptionsList
          options={question.questionoptions}
          onOptionClick={onToggleOption}
        />

      </div>
    </div>
  );
}







// -----------------------------------------------------------
// TestHome (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /student (behind the student guard;
//     finished students are redirected to /student/finish)
// -----------------------------------------------------------

export default function TestHome() {

  const {
    questionsData,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    loading,
    empty,
    answerQuestion,
    toggleOption,
    finishTest,
  } = useTestQuestions();

  const [isModalOpen, setIsModalOpen] = useState(false);


  // Loading — centered brand spinner
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#EBECEF]">
        <div className="w-10 h-10 rounded-full border-4 border-gray-300 border-t-[rgb(123,0,63)] animate-spin" />
        <div className="text-gray-500">Kraunasi...</div>
      </div>
    );
  }

  // Loaded but nothing to answer — the question bank is empty
  // (or entirely disabled). Say so instead of spinning forever;
  // the test is dealt on the next visit once questions exist
  if (empty) {
    return (
      <div>
        <Navbar/>
        <div className="min-h-[calc(100vh-135px)] flex flex-col items-center justify-center gap-3 bg-[#EBECEF] px-6 text-center">
          <div className="text-xl font-semibold text-gray-700">Testas dar neparuoštas</div>
          <div className="text-gray-500">Šiuo metu nėra nė vieno klausimo. Bandykite dar kartą vėliau.</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 px-5 py-2 rounded-xl bg-[rgb(123,0,63)] text-white font-semibold cursor-pointer hover:opacity-90"
          >
            Bandyti dar kartą
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const currentQuestion = questionsData[currentQuestionIndex];


  return (
    <div>
      <Toaster position="top-center" />
      <Navbar/>

      <FullScreenImage
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        url={`/api/phishingpictures/${currentQuestion.questionid}`}
        clickableAreasUrl={`/api/phishingpictures/${currentQuestion.questionid}/links`}
      />

      {/* Question next to the navigation panel — the panel moves
          below the question on narrow screens */}
      <div className="flex flex-col lg:flex-row">

        {/* The open question */}
        <div className="lg:min-h-[calc(100vh-135px)] w-full bg-[#EBECEF] flex justify-center px-4 sm:px-8 pt-[30px]">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            questionCount={questionsData.length}
            onAnswer={answerQuestion}
            onToggleOption={toggleOption}
            onZoom={() => setIsModalOpen(true)}
          />
        </div>

        {/* Question navigation + finish */}
        <StudentSidebar
          currentQuestionIndex={currentQuestionIndex}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
          questionsData={questionsData}
          onFinish={finishTest}
        />
      </div>

      <Footer />
    </div>
  );
}
