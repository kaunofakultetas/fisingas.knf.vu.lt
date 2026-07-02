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
//  dropped on mount (the old Next.js frontend did the same
//  server-side). After a successful login the page hard-
//  navigates to "/" and the router sends the user to their
//  home by role.
//
//  This page styles itself — App excludes it from the MUI
//  theme (see providers.jsx / excludedPaths), which is why
//  the text fields carry their own burgundy focus styling.
//
//  Split into (root component last):
//
//    BRAND_FIELD_SX — burgundy focus styling for TextFields
//    CardHeader     — logo + app title
//    ErrorBox       — red error chip (hidden when empty)
//    BrandButton    — the burgundy submit button
//    RegisterForm   — student self-registration (default)
//    LoginForm      — existing account sign-in
//    Login          — the page itself (default export)
// -----------------------------------------------------------

import { useState, useEffect } from "react";
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
        className="w-full py-3 rounded-xl bg-gray-400 text-white font-bold tracking-wide pointer-events-none"
      >
        PALAUKITE <BouncingDotsLoader/>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-3 rounded-xl bg-[rgb(123,0,63)] text-white font-bold tracking-wide cursor-pointer
        hover:bg-[rgb(230,65,100)] transition-colors shadow-[0_4px_14px_rgba(123,0,63,0.35)]"
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
//      stripped to A–Z, 0–9 and _ server-side)
//   2. The name + code are shown as credential chips with a
//      write-these-down warning → "PRADĖTI TESTĄ" logs in
//      with them
//
// "Jau turiu paskyrą" switches to the sign-in form.
//
// Used by:
//   - Login (below) — form 0 (default)
// -----------------------------------------------------------

function RegisterForm({ selectedForm, setSelectedForm, handleLogin, loginErrorBoxText }) {

  const [errorBoxText, setErrorBoxText] = useState("");
  const [registering, setRegistering] = useState(false);
  const [studentUsername, setStudentUsername] = useState("");
  const [studentAccessCode, setStudentAccessCode] = useState("");


  const handleRegister = async () => {
    setRegistering(true);
    try {
      const response = await axios.post("/api/student/register", { username: studentUsername });
      if (response.data.status === "OK") {
        setStudentUsername(response.data.username);
        setStudentAccessCode(response.data.accessCode);
      }
      else {
        setErrorBoxText(response.data.error);
      }
    } catch (error) {
      // A 400 carries a message from the backend; anything else
      // is a network problem
      setErrorBoxText(error.response?.data?.error || "Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    }
    setRegistering(false);
  };


  // Enter advances the current step (register, then login)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && selectedForm === 0) {
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

          <BrandButton onClick={() => handleLogin(studentUsername, studentAccessCode)}>
            PRADĖTI TESTĄ
          </BrandButton>
        </>
      }

      {/* Switch to the sign-in form (only before registering) */}
      {studentAccessCode === "" &&
        <button
          type="button"
          onClick={() => setSelectedForm(1)}
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
// name/email + code/password. Enter submits; while the login
// request runs the button turns grey with a bouncing-dots
// loader. The back arrow returns to registration.
//
// Used by:
//   - Login (below) — form 1
// -----------------------------------------------------------

function LoginForm({ selectedForm, setSelectedForm, handleLogin, errorBoxText }) {

  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


  const submit = async () => {
    setLoggingIn(true);
    await handleLogin(email, password);
    setLoggingIn(false);
  };


  // Enter submits (only while this form is the visible one)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && selectedForm === 1) {
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
        onClick={() => setSelectedForm(0)}
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
// The page itself: drops the session cookie on mount (logout),
// holds which form is visible (registration by default) and
// does the actual login call.
//
// Used by:
//   - App.jsx — route /login
// -----------------------------------------------------------

export default function Login() {

  const [selectedForm, setSelectedForm] = useState(0);
  const [loginErrorBoxText, setLoginErrorBoxText] = useState("");


  // Visiting /login logs the user out — drop the session cookie
  useEffect(() => {
    document.cookie = "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }, []);


  // Shared by both forms; the backend answers "OK" or an error
  // message ready for display. On success a full page load
  // restarts the app with the fresh session.
  async function handleLogin(username, password) {
    try {
      const response = await axios.post("/api/login", { username: username, password: password });
      if (response.data === "OK") {
        window.location.href = "/";
      }
      else {
        setLoginErrorBoxText(response.data);
      }
    } catch {
      setLoginErrorBoxText("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    }
  }


  return (
    <div className="absolute inset-0 z-[-2] bg-linear-to-br from-[#7b4397] to-[#dc2430]">

      {/* The two forms — both stay mounted, one is visible.
          Registration is the default: new students are the
          main audience of this page. */}
      <div className={selectedForm === 0 ? 'block' : 'hidden'}>
        <RegisterForm
          selectedForm={selectedForm}
          setSelectedForm={setSelectedForm}
          handleLogin={handleLogin}
          loginErrorBoxText={loginErrorBoxText}
        />
      </div>

      <div className={selectedForm === 1 ? 'block' : 'hidden'}>
        <LoginForm
          selectedForm={selectedForm}
          setSelectedForm={setSelectedForm}
          handleLogin={handleLogin}
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
