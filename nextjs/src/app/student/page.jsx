import 'server-only';
import React from 'react';
import axios from 'axios';
import TestHome from '@/systemPages/StudentPages/TestHome/TestHome';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'


export default async function Page() {
  if (cookies().get("session") === undefined) {
    redirect('/');
  }



  let response;
  try {
    response = await axios.get(process.env.BACKEND_API_URL + '/api/checkauth', {
      headers: { Cookie: "session=" + cookies().get("session").value }
    });
  } catch (error) {
    console.log("[*] Error in /app/student/page.jsx");
    console.log(error);
    redirect('/');
  }



  if(response !== undefined){
    if (response.status === 200){
      if(response.data.admin === 0){
        if(response.data.phishingtestfinished === 0){
          try{
            return <TestHome/>;
          }
          catch(error){
            console.log("[*] Error in /app/student/page.jsx");
            console.log(error);
            redirect('/');
          }
        }
        else{
          redirect('/student/finish');
        }
      }
    }
  }



  redirect('/');
}
