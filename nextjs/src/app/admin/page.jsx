import 'server-only';
import React from 'react';
import axios from 'axios';
import Home from '@/systemPages/AdminPages/home/Home';
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
    console.log("[*] Error in /app/admin/page.jsx");
    console.log(error);
    redirect('/');
  }



  try{
    if(response !== undefined){
      if (response.status === 200){
        if(response.data.admin === 1){
          return <Home/>;
        }
      }
    }
  }
  catch(error){
    console.log("[*] Error in /app/admin//page.jsx");
    console.log(error);
    redirect('/login');
  }

  

  redirect('/');
}
