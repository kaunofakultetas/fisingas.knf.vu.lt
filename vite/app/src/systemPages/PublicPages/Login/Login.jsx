// -----------------------------------------------------------
//  [*] Public — Login page
//
//  The entry point of the app: a white card on the animated
//  particles background with two switchable forms:
//    - LoginForm    — name/email + code/password, for both
//                     students and administrators
//    - RegisterForm — student self-registration; the backend
//                     generates a random access code that the
//                     student writes down and logs in with
//
//  Opening /login also acts as logout: the session cookie is
//  dropped on mount (the old Next.js frontend did the same
//  server-side). After a successful login the page hard-
//  navigates to "/" and the router sends the user to their
//  home by role.
//
//  This page styles itself — App excludes it from the MUI
//  theme (see providers.jsx / excludedPaths).
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";

import { Button, Box, Stack, FormControl, TextField, Typography } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import BouncingDotsLoader from './components/BouncingDotsLoader/BouncingDotsLoader';
import Particles from './components/Particles/Particles';


const FORM_CARD_STYLE = {
  maxWidth: 350,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  background: "white",
  padding: 20,
  marginTop: "10%",
  borderRadius: 15,
};

const ERROR_BOX_STYLE = {
  fontSize: '12px',
  color: 'red',
  textAlign: 'center',
  whiteSpace: 'pre-wrap',
};







// -----------------------------------------------------------
// LoginForm
// -----------------------------------------------------------
//
// Name/email + code/password form (form 0). Enter submits;
// while the login request runs the button turns grey with a
// bouncing-dots loader. "Neturiu paskyros" switches to the
// registration form.
//
// Used by:
//   - Login (below)
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
      if (event.key === 'Enter' && selectedForm === 0) {
        submit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [email, password, selectedForm]);


  return (
    <form style={FORM_CARD_STYLE}>
      <img alt="" src="/img/vuknflogo.png" width="330" height="192"/>

      <Box style={{ textAlign: "center", marginTop: 10 }}>
        <Typography component="h1" variant="subtitle1" sx={{ fontSize: "1.1em", mb: "0.25em" }}>
          Fišingo atakų atpažinimo testas
        </Typography>
      </Box>

      {/* Credentials */}
      <Stack spacing={2} style={{ marginTop: 10, marginBottom: 60 }}>
        <FormControl color="primary">
          <TextField required variant="standard" label="Vardas / El. Paštas" onChange={(e) => setEmail(e.currentTarget.value)}/>
        </FormControl>

        <FormControl color="primary">
          <TextField required variant="standard" type="password" label="Kodas / Slaptažodis" onChange={(e) => setPassword(e.currentTarget.value)}/>
        </FormControl>
      </Stack>

      {/* Error message from the backend */}
      <Box style={ERROR_BOX_STYLE}>
        {errorBoxText}
      </Box>

      {loggingIn ?
        <Button disabled={true} style={{ backgroundColor: 'grey', color: 'white', pointerEvents: 'none' }}>
          PALAUKITE <BouncingDotsLoader/>
        </Button>
      :
        <Button onClick={submit} style={{ backgroundColor: 'rgb(123, 0, 63)', color: 'white' }}>
          PRISIJUNGTI
        </Button>
      }

      <Button
        style={{
          color: 'rgb(123, 0, 63)',
          marginTop: 15,
          border: '1px solid',
          borderRadius: 5,
        }}
        onClick={() => setSelectedForm(1)}
      >
        Neturiu paskyros
      </Button>
    </form>
  );
}







// -----------------------------------------------------------
// RegisterForm
// -----------------------------------------------------------
//
// Student registration form (form 1) in two steps:
//   1. Pick a username → "REGISTRUOTIS" asks the backend for
//      a random access code (the username is uppercased and
//      stripped to A–Z, 0–9 and _ server-side)
//   2. The name + code are shown so the student can write
//      them down → "PRADĖTI TESTĄ" logs in with them
//
// Used by:
//   - Login (below)
// -----------------------------------------------------------

function RegisterForm({ selectedForm, setSelectedForm, handleLogin }) {

  const [errorBoxText, setErrorBoxText] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [studentAccessCode, setStudentAccessCode] = useState("");


  const handleRegister = async () => {
    await axios.post("/api/student/register", { username: studentUsername }).then((response) => {
      if (response.data.status === "OK") {
        setStudentUsername(response.data.username);
        setStudentAccessCode(response.data.accessCode);
      }
      else {
        setErrorBoxText(response.data.error);
      }
    });
  };


  // Enter advances the current step (register, then login)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && selectedForm === 1) {
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
    <form style={FORM_CARD_STYLE}>

      {/* Back to the login form (only before registering) */}
      {studentAccessCode === "" &&
        <Button
          style={{
            backgroundColor: 'rgb(123, 0, 63)',
            color: 'white',
            width: 10,
            marginBottom: 30,
          }}
          onClick={() => setSelectedForm(0)}
        >
          <ArrowBackIcon/>
        </Button>
      }

      <h3 style={{ marginBottom: 30 }}>Registracija Testui:</h3>
      {studentAccessCode === "" &&
        <div style={{ marginBottom: 30, textAlign: 'justify' }}>
          <b>Prisijungimo kodas</b> bus sugeneruotas atsitiktiniu būdu ir parodytas kai spustelsite mygtuką "Registruotis".
        </div>
      }
      <div style={{ marginBottom: 50, textAlign: 'justify' }}>
        Užsirašykite šiuos prisijungimo duomenis jei norėsite rezultatą peržiūrėti vėliau arba testą tęsti vėliau.
      </div>

      {studentAccessCode === "" ?
        <>
          {/* Step 1 — pick a username */}
          <Stack spacing={2} style={{ marginBottom: 80 }}>
            <FormControl color="primary">
              <TextField required variant="standard" label="Prisijungimo Vardas" onChange={(e) => setStudentUsername(e.currentTarget.value)}/>
            </FormControl>
          </Stack>

          <Box style={ERROR_BOX_STYLE}>
            {errorBoxText}
          </Box>

          <Button
            style={{
              backgroundColor: 'rgb(123, 0, 63)',
              color: 'white',
            }}
            onClick={handleRegister}
          >
            REGISTRUOTIS
          </Button>
        </>
      :
        <>
          {/* Step 2 — show the credentials, start the test */}
          <div>
            Vardas: {studentUsername}
          </div>
          <div style={{ marginBottom: 40 }}>
            Kodas: {studentAccessCode}
          </div>

          <Button
            style={{
              backgroundColor: 'rgb(123, 0, 63)',
              color: 'white',
            }}
            onClick={() => handleLogin(studentUsername, studentAccessCode)}
          >
            PRADĖTI TESTĄ
          </Button>
        </>
      }

    </form>
  );
}







// -----------------------------------------------------------
// Login (default export)
// -----------------------------------------------------------
//
// The page itself: drops the session cookie on mount (logout),
// holds which form is visible and does the actual login call.
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
    await axios.post("/api/login", { username: username, password: password }).then((response) => {
      if (response.data === "OK") {
        window.location.href = "/";
      }
      else {
        setLoginErrorBoxText(response.data);
      }
    });
  }


  return (
    <Box style={{
      backgroundImage: "linear-gradient(to bottom right, #7b4397 , #dc2430)",
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: -2,
    }}>

      {/* The two forms — both stay mounted, one is visible */}
      <div style={{ display: selectedForm === 0 ? 'block' : 'none' }}>
        <LoginForm
          selectedForm={selectedForm}
          setSelectedForm={setSelectedForm}
          handleLogin={handleLogin}
          errorBoxText={loginErrorBoxText}
        />
      </div>

      <div style={{ display: selectedForm === 1 ? 'block' : 'none' }}>
        <RegisterForm
          selectedForm={selectedForm}
          setSelectedForm={setSelectedForm}
          handleLogin={handleLogin}
        />
      </div>

      <Particles/>

      {/* Footer */}
      <Box style={{
        height: 100,
        width: "100%",
        position: "absolute",
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        zIndex: -1,
      }}>
        <Box style={{
          color: "#fff",
          lineHeight: "10px",
          fontSize: "0.7em",
          marginTop: 50,
          textAlign: "center",
        }}>
          Copyright © | All Rights Reserved | VUKnF
        </Box>
      </Box>
    </Box>
  );
}
