import 'server-only';
import React from 'react';
import axios from 'axios';
import StudentInformation from '@/systemPages/AdminPages/StudentInformation/StudentInformation';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'


export default async function Page({ params, searchParams }) {
  const { studentID } = params;

  

  if (cookies().get("session") === undefined) {
    redirect('/');
  }



  let response;
  try {
    response = await axios.get(process.env.NEXT_PUBLIC_API_URL + '/checkauth', {
      headers: { Cookie: "session=" + cookies().get("session").value }
    });
  } catch (error) {
    console.log("[*] Error in /app/admin/students/[studentID]/page.jsx");
    console.log(error);
    redirect('/');
  }
  
  

  try{
    if(response !== undefined){
      if(response.status === 200){
        if(response.data.admin === 1){
          return <StudentInformation studentID={studentID}/>;
        }
      }
    }
  }
  catch(error){
    console.log("[*] Error in /app/admin/students/[studentID]/page.jsx");
    console.log(error);
    redirect('/');
  }
    

  
  redirect('/');
}
