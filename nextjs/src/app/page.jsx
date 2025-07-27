import React from 'react';
import axios from 'axios';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'


export default async function Page() {
  if (cookies().get("session") === undefined) {
    redirect('/login');
  }



  let response;
  try {
    response = await axios.get(process.env.NEXT_PUBLIC_API_URL + '/checkauth', {
      headers: { Cookie: "session=" + cookies().get("session").value }
    });
  } catch (error) {
    console.log("[*] Error in /app/page.jsx");
    console.log(error);
    redirect('/login');
  }




  if (response !== undefined && response.status === 200) {
    if (response.data.admin === 1) {
      redirect('/admin');
    } else {
      redirect('/student');
    }
  }

  

  redirect('/login');
}