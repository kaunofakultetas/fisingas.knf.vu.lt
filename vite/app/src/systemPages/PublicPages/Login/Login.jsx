// -----------------------------------------------------------
//  [*] Public — Login page
//
//  The entry point of the app: a white card on the animated
//  particles background. New students are the main audience,
//  so registration is the form shown first:
//    - RegisterForm — student self-registration (default);
//      the backend generates a random access code that the
//      student writes down and logs in with
//    - LoginForm    — name/email + code/password, for
//      returning students and administrators ("Jau turiu
//      paskyrą")
//
//  Opening /login also acts as logout: the session cookie is
//  dropped on mount. After a successful login the page hard-
//  navigates to "/" and the router sends the user to their
//  home by role. A copy the browser restores from its
//  back-forward cache (e.g. Back after a login) is reloaded
//  at once — it is no mount, so it would keep that session
//  and still show the credentials; the fresh load logs out
//  and starts blank.
//
//  Behavior worth knowing:
//    - Enter acts on the visible form from anywhere except a
//      focused button, which handles Enter through its own
//      click (Enter on "Jau turiu paskyrą" switches forms)
//    - one request at a time: while a registration or login
//      runs, its button shows PALAUKITE and a second click or
//      Enter sends nothing. After a login's "OK" the button
//      stays on PALAUKITE until this page is gone, so nothing
//      logs in twice meanwhile
//    - a login refusal belongs to the attempt that got it:
//      switching forms or a successful registration drops it
//
//  This page styles itself — App excludes it from the MUI
//  theme (see providers.jsx / excludedPaths), which is why
//  the text fields carry their own burgundy focus styling.
//
//  Split into (root component last):
//
//    BRAND_FIELD_SX — burgundy focus styling for TextFields
//    isButtonTarget — does a key event come from a button?
//    CardHeader     — logo + app title
//    ErrorBox       — red error chip (hidden when empty)
//    BrandButton    — the burgundy submit button
//    RegisterForm   — student self-registration (default)
//    LoginForm      — existing account sign-in
//    Login          — the page itself (default export)
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import axios from "axios";

import { Stack, FormControl, TextField } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import BouncingDotsLoader from './components/BouncingDotsLoader/BouncingDotsLoader';
import Particles from './components/Particles/Particles';


// The MUI theme is excluded on this page, so the standard
// TextFields would focus blue — this pins them to the brand
// burgundy instead
const BRAND_FIELD_SX = {
  '& label.Mui-focused': { color: 'rgb(123, 0, 63)' },
  '& .MuiInput-underline:after': { borderBottomColor: 'rgb(123, 0, 63)' },
};


// Enter on a focused button (or on anything inside one) is
// that button's own click, so the forms' document-wide Enter
// listeners must leave it alone
const isButtonTarget = (event) => event.target instanceof Element && event.target.closest('button') !== null;







// -----------------------------------------------------------
// CardHeader
// -----------------------------------------------------------
//
// The top of both form cards: the VU KnF logo and the app
// title.
//
// Used by:
//   - RegisterForm, LoginForm (below)
// -----------------------------------------------------------

function CardHeader() {
  return (
    <div className="flex flex-col items-center">
      <img alt="VU KnF logotipas" src="/img/vuknflogo.png" className="w-[260px]" />
      <h1 className="mt-4 text-lg font-bold text-gray-800 text-center">
        Fišingo atakų atpažinimo testas
      </h1>
    </div>
  );
}







// -----------------------------------------------------------
// ErrorBox
// -----------------------------------------------------------
//
// The backend's error message as a red chip; renders nothing
// while there is no error.
//
// Used by:
//   - RegisterForm, LoginForm (below)
// -----------------------------------------------------------

function ErrorBox({ children }) {

  if (!children) {
    return null;
  }

  return (
    <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center whitespace-pre-wrap">
      {children}
    </div>
  );
}







// -----------------------------------------------------------
// BrandButton
// -----------------------------------------------------------
//
// The burgundy full-width submit button; while `loading` it
// turns grey with the bouncing-dots loader and stops
// accepting clicks.
//
// Used by:
//   - RegisterForm, LoginForm (below)
// -----------------------------------------------------------

function BrandButton({ loading, onClick, children }) {

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="w-full py-3 rounded-xl bg-gray-400 text-white font-bold tracking-wide pointer-events-none flex items-center justify-center gap-2"
      >
        PALAUKITE <BouncingDotsLoader/>
      </button>
    );
  }

  return (
    <button
      type="button"
      tabIndex={0}
      onClick={onClick}
      className="w-full py-3 rounded-xl bg-[rgb(123,0,63)] text-white font-bold tracking-wide cursor-pointer
        hover:bg-[rgb(230,65,100)] transition-colors shadow-[0_4px_14px_rgba(123,0,63,0.35)]
        border-none outline-none focus-visible:ring-2 focus-visible:ring-[rgb(230,65,100)] focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}







// -----------------------------------------------------------
// RegisterForm
// -----------------------------------------------------------
//
// The default form — student self-registration in two steps:
//   1. Pick a username → "REGISTRUOTIS" asks the backend for
//      a random access code (the username is uppercased and
//      stripped to A–Z, Lithuanian letters, 0–9 and _
//      server-side)
//   2. The name + code are shown as credential chips with a
//      write-these-down warning → "PRADĖTI TESTĄ" logs in
//      with them (PALAUKITE while Login's request runs)
//
// "Jau turiu paskyrą" switches to the sign-in form. A new
// registration drops the login refusal an earlier sign-in
// attempt may have left behind.
//
// Used by:
//   - Login (below) — form 0 (default)
// -----------------------------------------------------------

function RegisterForm({ selectedForm, showForm, handleLogin, loggingIn, loginErrorBoxText, clearLoginError }) {

  const [errorBoxText, setErrorBoxText] = useState("");
  const [registering, setRegistering] = useState(false);
  const [studentUsername, setStudentUsername] = useState("");
  const [studentAccessCode, setStudentAccessCode] = useState("");

  // One register request at a time — a ref, because the Enter
  // listener below calls the handleRegister of an older
  // render, which never sees `registering` turn true
  const registerInFlight = useRef(false);


  const handleRegister = async () => {
    if (registerInFlight.current) {
      return;
    }
    registerInFlight.current = true;
    setRegistering(true);
    try {
      const response = await axios.post("/api/student/register", { username: studentUsername });
      if (response.data.status === "OK") {
        setStudentUsername(response.data.username);
        setStudentAccessCode(response.data.accessCode);
        clearLoginError();
      }
      else {
        setErrorBoxText(response.data.error);
      }
    } catch (error) {
      // A 400 carries a message from the backend; anything else
      // is a network problem
      setErrorBoxText(error.response?.data?.error || "Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    }
    registerInFlight.current = false;
    setRegistering(false);
  };


  // Enter advances the current step (register, then login). A
  // focused button is left to its own click — Enter on "Jau
  // turiu paskyrą" switches forms, it does not register. The
  // keydown is cancelled: the browser would otherwise submit
  // this one-field form by itself
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && selectedForm === 0 && !isButtonTarget(event)) {
        event.preventDefault();
        if (studentAccessCode === "") {
          handleRegister();
        } else {
          handleLogin(studentUsername, studentAccessCode);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [studentUsername, studentAccessCode, selectedForm]);


  return (
    <form className="max-w-[380px] mx-auto flex flex-col bg-white p-8 mt-[7%] rounded-[15px] shadow-2xl">

      <CardHeader />

      {studentAccessCode === "" ?
        <>
          {/* Step 1 — pick a username */}
          <p className="mt-6 text-sm text-gray-500 text-center">
            Įveskite pasirinktą vardą — <b>prisijungimo kodas</b> bus
            sugeneruotas ir parodytas paspaudus „Registruotis".
          </p>

          <Stack spacing={2} className="mt-4 mb-8">
            <FormControl>
              <TextField
                required
                variant="standard"
                label="Prisijungimo Vardas"
                sx={BRAND_FIELD_SX}
                onChange={(e) => setStudentUsername(e.currentTarget.value)}
              />
            </FormControl>
          </Stack>

          <ErrorBox>{errorBoxText}</ErrorBox>

          <BrandButton loading={registering} onClick={handleRegister}>
            REGISTRUOTIS
          </BrandButton>
        </>
      :
        <>
          {/* Step 2 — show the credentials, start the test */}
          <div className="mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-gray-700 text-center">
            <b>Užsirašykite šiuos duomenis</b> — su jais galėsite testą
            tęsti arba rezultatą peržiūrėti vėliau.
          </div>

          <div className="my-6 flex flex-col gap-2">
            <div className="flex items-baseline justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vardas</span>
              <span className="font-mono font-bold text-gray-800">{studentUsername}</span>
            </div>
            <div className="flex items-baseline justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Kodas</span>
              <span className="font-mono font-bold text-gray-800">{studentAccessCode}</span>
            </div>
          </div>

          <ErrorBox>{loginErrorBoxText}</ErrorBox>

          <BrandButton loading={loggingIn} onClick={() => handleLogin(studentUsername, studentAccessCode)}>
            PRADĖTI TESTĄ
          </BrandButton>
        </>
      }

      {/* Switch to the sign-in form (only before registering) */}
      {studentAccessCode === "" &&
        <button
          type="button"
          onClick={() => showForm(1)}
          className="mt-5 text-sm text-[rgb(123,0,63)] font-semibold text-center cursor-pointer
            hover:text-[rgb(230,65,100)] transition-colors bg-transparent border-none"
        >
          Jau turiu paskyrą — prisijungti
        </button>
      }

    </form>
  );
}







// -----------------------------------------------------------
// LoginForm
// -----------------------------------------------------------
//
// The sign-in form for returning students and administrators:
// name/email + code/password. Enter submits; while Login's
// login request runs the button turns grey with a
// bouncing-dots loader. The back arrow returns to
// registration.
//
// Used by:
//   - Login (below) — form 1
// -----------------------------------------------------------

function LoginForm({ selectedForm, showForm, handleLogin, loggingIn, errorBoxText }) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


  // handleLogin keeps a running login from being sent twice,
  // whichever form or key asks
  const submit = () => handleLogin(email, password);


  // Enter submits (only while this form is the visible one). A
  // focused button is left to its own click — Enter on the
  // back arrow switches forms, it does not log in
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && selectedForm === 1 && !isButtonTarget(event)) {
        submit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [email, password, selectedForm]);


  return (
    <form className="max-w-[380px] mx-auto flex flex-col bg-white p-8 mt-[7%] rounded-[15px] shadow-2xl">

      <CardHeader />

      <p className="mt-6 text-sm text-gray-500 text-center">
        Prisijunkite su registracijos metu gautu vardu ir kodu
        (administratoriai — su savo paskyra).
      </p>

      {/* Credentials */}
      <Stack spacing={2} className="mt-4 mb-8">
        <FormControl>
          <TextField
            required
            variant="standard"
            label="Vardas / El. Paštas"
            sx={BRAND_FIELD_SX}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </FormControl>

        <FormControl>
          <TextField
            required
            variant="standard"
            type="password"
            label="Kodas / Slaptažodis"
            sx={BRAND_FIELD_SX}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
        </FormControl>
      </Stack>

      <ErrorBox>{errorBoxText}</ErrorBox>

      <BrandButton loading={loggingIn} onClick={submit}>
        PRISIJUNGTI
      </BrandButton>

      {/* Back to registration */}
      <button
        type="button"
        onClick={() => showForm(0)}
        className="mt-5 inline-flex items-center justify-center gap-1 text-sm text-[rgb(123,0,63)] font-semibold
          cursor-pointer hover:text-[rgb(230,65,100)] transition-colors bg-transparent border-none"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        Neturiu paskyros — registruotis
      </button>

    </form>
  );
}







// -----------------------------------------------------------
// Login (default export)
// -----------------------------------------------------------
//
// The page itself: kills the session on mount (logout),
// holds which form is visible (registration by default) and
// does the actual login call for both forms — one at a time,
// with the refusal message and the PALAUKITE state both
// forms show for it.
//
// Used by:
//   - App.jsx — route /login
// -----------------------------------------------------------

export default function Login() {

  const [selectedForm, setSelectedForm] = useState(0);
  const [loginErrorBoxText, setLoginErrorBoxText] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // One login request at a time — a ref, because the forms'
  // Enter listeners call the handleLogin of an older render,
  // which never sees `loggingIn` turn true
  const loginInFlight = useRef(false);


  // Visiting /login logs the user out — kill the session on the
  // server; the response clears the (HttpOnly) session cookie
  useEffect(() => {
    axios.post("/api/logout").catch(() => {});
  }, []);


  // A login refusal belongs to the attempt that got it: the
  // form shown next, and the credentials of a new
  // registration, start without it
  const clearLoginError = () => setLoginErrorBoxText("");

  const showForm = (form) => {
    clearLoginError();
    setSelectedForm(form);
  };


  // Shared by both forms; the backend answers "OK" or an error
  // message ready for display. On success a full page load
  // restarts the app with the fresh session — the request
  // counts as running until this page is gone (a copy
  // restored from the back-forward cache reloads, below), so
  // the button stays on PALAUKITE and no second login
  // replaces the session meanwhile.
  async function handleLogin(username, password) {
    if (loginInFlight.current) {
      return;
    }
    loginInFlight.current = true;
    setLoggingIn(true);

    try {
      const response = await axios.post("/api/login", { username: username, password: password });
      if (response.data === "OK") {
        window.location.href = "/";
        return;
      }
      setLoginErrorBoxText(response.data);
    } catch {
      setLoginErrorBoxText("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    }

    loginInFlight.current = false;
    setLoggingIn(false);
  }


  // Back after a login may restore this page from the
  // browser's back-forward cache exactly as it was left: no
  // remount, so the logout above does not run and the session
  // of that login stays alive, with registration's name and
  // access code or the typed password still on screen. Such a
  // copy reloads at once — the fresh load logs out and starts
  // blank. Its login keeps counting as running, so the copy
  // cannot log in again before the reload replaces it
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);


  return (
    <div className="absolute inset-0 z-[-2] bg-linear-to-br from-[#7b4397] to-[#dc2430]">

      {/* The two forms — both stay mounted, one is visible.
          Registration is the default: new students are the
          main audience of this page. */}
      <div className={selectedForm === 0 ? 'block' : 'hidden'}>
        <RegisterForm
          selectedForm={selectedForm}
          showForm={showForm}
          handleLogin={handleLogin}
          loggingIn={loggingIn}
          loginErrorBoxText={loginErrorBoxText}
          clearLoginError={clearLoginError}
        />
      </div>

      <div className={selectedForm === 1 ? 'block' : 'hidden'}>
        <LoginForm
          selectedForm={selectedForm}
          showForm={showForm}
          handleLogin={handleLogin}
          loggingIn={loggingIn}
          errorBoxText={loginErrorBoxText}
        />
      </div>

      <Particles/>

      {/* Footer */}
      <div className="h-[100px] w-full absolute bottom-0 z-[-1]">
        <div className="text-white leading-[10px] text-[0.7em] mt-[50px] text-center">
          Copyright © | All Rights Reserved | VUKnF
        </div>
      </div>
    </div>
  );
}
