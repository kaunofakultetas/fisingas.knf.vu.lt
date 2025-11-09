'use client';
import React, { useState, useEffect, useRef } from "react";

import axios from "axios";
import BouncingDotsLoader from './components/BouncingDotsLoader/BouncingDotsLoader';
import Particles from './components/Particles/Particles';

import { Button, Box, Stack, FormControl, TextField } from "@mui/material";
import Typography from '@mui/joy/Typography';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Image from 'next/image';





function LoginForm({ selectedForm, setSelectedForm, handleLogin, errorBoxText }) {

  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");



  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        if(selectedForm === 0){
          handleLogin(email, password);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [email, password]);

  



  return (
    <form  style={{
      maxWidth: 350,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      background: "white",
      padding: 20,
      marginTop: "10%",
      borderRadius: 15,
    }}>
      <Image alt="" src="/img/vuknflogo.png" width="330" height="192"/>
      
      <Box style={{textAlign: "center", marginTop: 10}}>
        <Typography component="h1" level="inherit" fontSize="1.1em" mb="0.25em">
          Fišingo atakų atpažinimo testas
        </Typography>
      </Box>

      <Stack spacing={2} style={{marginTop: 10, marginBottom: 60}} >
        <FormControl size="lg" color="primary">
          <TextField required variant="standard" label="Vardas / El. Paštas" onChange={ (e) => {setEmail(e.currentTarget.value)}}/>
        </FormControl>

        <FormControl size="lg" color="primary">
          <TextField required variant="standard" type="password" label="Kodas / Slaptažodis" onChange={ (e) => {setPassword(e.currentTarget.value)}}/>
        </FormControl>
      </Stack>

      
      <Box style={{
        fontSize: '12px', 
        color: 'red', 
        textAlign: 'center', 
        whiteSpace: 'pre-wrap'
      }}>
        {errorBoxText}
      </Box>
      
      {loggingIn? 
        <Button disabled={true} style={{backgroundColor: 'grey', color: 'white', pointerEvents: 'none', }}>
          PALAUKITE <BouncingDotsLoader/>
        </Button>
      :
        <Button onClick={() => handleLogin(email, password)} style={{backgroundColor: 'rgb(123, 0, 63)', color: 'white'}} >
          PRISIJUNGTI
        </Button>
      }

      <Button 
        style={{ 
          color: 'rgb(123, 0, 63)', 
          marginTop: 15, 
          border: '1px solid', 
          borderRadius: 5 
        }}
        onClick={() => { setSelectedForm(1) }}
      >
        Neturiu paskyros
      </Button>
    </form>
  );
}





function RegisterForm({ selectedForm, setSelectedForm, handleLogin }) {

  const [errorBoxText, setErrorBoxText] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [studentAccessCode, setStudentAccessCode] = useState("");


  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if(selectedForm === 1){
          if (studentAccessCode === "") {
            handleRegister();
          } else {
            handleLogin(studentUsername, studentAccessCode);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [studentUsername, studentAccessCode]);

  const handleRegister = () => {
    const registerUser = async () =>  {
      await axios.post("/api/student/register", { username: studentUsername }).then((response) => {
        if(response.data.status === "OK"){
          setStudentUsername(response.data.username);
          setStudentAccessCode(response.data.accessCode);
        }
        else{
          setErrorBoxText(response.data.error);
        }
      });
    }
    registerUser();
  }



  return (
    <form  style={{
      maxWidth: 350,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      background: "white",
      padding: 20,
      marginTop: "10%",
      borderRadius: 15,
    }}>


      {studentAccessCode === "" &&
        <Button 
          style={{ 
            backgroundColor: 'rgb(123, 0, 63)', 
            color: 'white', 
            width: 10, 
            marginBottom: 30 
          }}
          onClick={() => setSelectedForm(0) }
        >
          <ArrowBackIcon/>
        </Button>
      }




      <h3 style={{marginBottom: 30}}>Registracija Testui:</h3>
      {studentAccessCode === "" &&
        <div style={{marginBottom: 30, textAlign: 'justify' }}>
          <b>Prisijungimo kodas</b> bus sugeneruotas atsitiktiniu būdu ir parodytas kai spustelsite mygtuką "Registruotis".
        </div>
      }
      <div style={{marginBottom: 50, textAlign: 'justify' }}>
        Užsirašykite šiuos prisijungimo duomenis jei norėsite rezultatą peržiūrėti vėliau arba testą tęsti vėliau.
      </div>



      {studentAccessCode === "" ?
        <>
          <Stack spacing={2} style={{marginBottom: 80}} >
            <FormControl size="lg" color="primary">
              <TextField required variant="standard" label="Prisijungimo Vardas" onChange={ (e) => setStudentUsername(e.currentTarget.value) }/>
            </FormControl>
          </Stack>

          
          <Box style={{
            fontSize: '12px', 
            color: 'red', 
            textAlign: 'center', 
            whiteSpace: 'pre-wrap'
          }}>
            {errorBoxText}
          </Box>
          
          <Button 
            style={{
              backgroundColor: 'rgb(123, 0, 63)', 
              color: 'white'
            }}
            onClick={() => { handleRegister() }}
          >
            REGISTRUOTIS
          </Button>
        </>
      :
        <>
          <div>
            Vardas: {studentUsername}
          </div>
          <div style={{marginBottom: 40}}>
            Kodas: {studentAccessCode}
          </div>
          
          
          <Button 
            style={{
              backgroundColor: 'rgb(123, 0, 63)', 
              color: 'white'
            }}
            onClick={() => handleLogin(studentUsername, studentAccessCode) }
          >
            PRADĖTI TESTĄ
          </Button>
        </>
      }
      
    </form>
  );
}









export default function Login({ deleteTokens }) {
  
  // Delete Cookies
  const deleteTokensRef = useRef(deleteTokens);
  useEffect(() => {
    deleteTokensRef.current = deleteTokens;
  });
  useEffect(() => {
    deleteTokensRef.current();
  }, []);



  const [selectedForm, setSelectedForm] = useState(0);
  const [loginErrorBoxText, setLoginErrorBoxText] = useState("");

  async function handleLogin(username, password) {
    await axios.post("/api/login", { username: username, password: password }).then((response) => {
      if(response.data === "OK"){
        window.location.href="/"
      }
      else{
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
      
      <div style={{}}>
        <div style={{ display: selectedForm === 0 ? 'block': 'none' }}>
          <LoginForm
            selectedForm={selectedForm}
            setSelectedForm={setSelectedForm}
            handleLogin={handleLogin}
            errorBoxText={loginErrorBoxText}
          />
        </div>

        <div style={{ display: selectedForm === 1 ? 'block': 'none' }}>
          <RegisterForm
            selectedForm={selectedForm}
            setSelectedForm={setSelectedForm}
            handleLogin={handleLogin}
          />
        </div>
      </div>
      
      <Particles/>

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



