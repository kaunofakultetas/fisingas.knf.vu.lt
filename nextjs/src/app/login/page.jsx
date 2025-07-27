import React from 'react';
import Login from '@/systemPages/login/Login';
import { cookies } from 'next/headers'


export default async function Page() {
  async function deleteTokens() {
    "use server";
    cookies().delete("session");
  }  
  return <Login deleteTokens={deleteTokens}/>;
}
