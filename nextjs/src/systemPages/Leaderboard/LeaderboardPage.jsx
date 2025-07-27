'use client';
import Sidebar from "@/components/Admin/Sidebar/Sidebar";
// import Navbar from "@/components/Navbar/Navbar"
import LeaderboardTable from "./LeaderboardTable/LeaderboardTable"
import Link from "next/link";
import { Button, Checkbox } from '@mui/material';



const LeaderboardPage = () => {
  return (
    <div>
      <Navbar />
      <div 
        style={{
          display: 'flex',
          flexDirection: 'row', 
          width: '80%', 
          marginLeft: 'auto', 
          marginRight: 'auto', 
          height: 'calc(100vh - 130px)',
          overflow: 'hidden'
        }
      }>
        <LeaderboardTable/>
      </div>
      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>

  )
}





const Navbar = () => {
  return (
    <div style={{
      height: '100px',
      borderBottom: '0.5px solid rgb(231, 228, 228)',
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px',
      color: 'rgb(123, 0, 63)',
      backgroundColor: 'rgb(123, 0, 63)',
      position: 'relative',
      width: '100%'
    }}>
      <Link href="/" style={{ textDecoration: "none", marginLeft: 30, marginRight: 30 }}>
        <div>
          <img src='/img/vuknflogowithbackground.png' alt="avatar" style={{width: '200px'}} />
        </div>
      </Link>
      <div style={{
        width: '100%',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexGrow: 1
        }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            {/* <div style={{borderStyle: 'solid', borderWidth: 1, borderRadius: 15, color: 'white', borderColor: 'white', padding: 8, paddingLeft: 12, paddingRight: 12}}>
              Fišingo atakų atpažinimo testas
            </div> */}
          </Link>
        </div>

        <div
          style={{
            background: 'rgb(123, 0, 63)',
            border: '1px solid rgba(255, 255, 255, 1)',
            borderRadius: '10px',
            padding: '6px 16px',
            color: 'white',
            textAlign: 'center',
            cursor: 'default',
            fontSize: '20px'
          }}
        >
          Apsilankyk: https://fisingas.knf.vu.lt
        </div>

      </div>
    </div>
  );
};



    

export default LeaderboardPage;