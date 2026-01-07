'use client';
import styles from "./Sidebar.module.scss";
import { useState, useEffect } from "react";
import Link from "next/link";

// Collapse/Expand Sidebar
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';


// Pagrindinis
import DashboardIcon from "@mui/icons-material/Dashboard";

// Prezentacija
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ImageIcon from '@mui/icons-material/Image';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';


// Sąrašai
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import GroupsIcon from '@mui/icons-material/Groups';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import FilterIcon from '@mui/icons-material/Filter';


// Sistema
import BadgeIcon from '@mui/icons-material/Badge';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorageIcon from '@mui/icons-material/Storage';
import ExitToAppIcon from "@mui/icons-material/ExitToApp";





// https://www.makeuseof.com/react-create-collapsible-side-navigation-menu/


const AdminSidebar = () => {
  const [open, setopen] = useState(true);
  useEffect(() => {
    setopen(localStorage.getItem("sidebarOpen") !== "false");
  }, [])



  const toggleOpen = () => {
    var sidebarOpendNewValue = !open;
    setopen(sidebarOpendNewValue)
    localStorage.setItem('sidebarOpen', sidebarOpendNewValue);
  }




  return (
    <div className={styles.sidebar}>
      
      <div className={styles.center}>
        
        <ul>
          <button className={styles.sidebarCollapseBtn} onClick={toggleOpen}>
            {open? <KeyboardDoubleArrowLeftIcon style={{verticalAlign: 'middle'}}/>:<KeyboardDoubleArrowRightIcon style={{verticalAlign: 'middle'}}/>}
          </button>


          {/* ---- */}
          {open? <p className={styles.title}>PAGRINDINIS</p>:<p className={styles.title}>-----</p>}
          <Link href="/admin" style={{ textDecoration: "none" }}>
            <li>
              <DashboardIcon className={styles.icon} />
              {open? <span>Pradžia</span>:<></>}
            </li>
          </Link>



          {/* ---- */}
          {open? <p className={styles.title}>SĄRAŠAI</p>:<p className={styles.title}>-----</p>}
          <Link href="/admin/students" style={{ textDecoration: "none" }}>
            <li>
              <PersonOutlineIcon className={styles.icon} />
              {open? <span>Studentai</span>:<></>}
            </li>
          </Link>
          {/* <Link href="/admin/studentgroups" style={{ textDecoration: "none" }}>
            <li>
              <GroupsIcon className={styles.icon} />
              {open? <span>Studentų Grupės</span>:<></>}
            </li>
          </Link> */}
          <Link href="/admin/questions" style={{ textDecoration: "none" }}>
            <li>
              <QuestionMarkIcon className={styles.icon} />
              {open? <span>Klausimai</span>:<></>}
            </li>
          </Link>
          {/* <Link href="/admin/questions" style={{ textDecoration: "none" }}>
            <li>
              <FilterIcon className={styles.icon} />
              {open? <span>Testai</span>:<></>}
            </li>
          </Link> */}

          

          {/* ---- */}
          {open? <p className={styles.title}>PREZENTACIJA</p>:<p className={styles.title}>-----</p>}
          <Link href="/slides" target="_blank" style={{ textDecoration: "none" }}>
            <li>
              <SlideshowIcon className={styles.icon} />
              {open? <span>Skaidrės (Paleisti)</span>:<></>}
            </li>
          </Link>

          <Link href="/filebrowser/slides" target="_blank" style={{ textDecoration: "none" }}>
            <li>
              <ImageIcon className={styles.icon} />
              {open? <span>Skaidrės (Failai)</span>:<></>}
            </li>
          </Link>

          <Link href="/leaderboard" target="_blank" style={{ textDecoration: "none" }}>
            <li>
              <LeaderboardIcon className={styles.icon} />
              {open? <span>Leaderboard'as</span>:<></>}
            </li>
          </Link>




          {open? <p className={styles.title}>SISTEMA</p>:<p className={styles.title}>-----</p>}
          <Link href="/admin/administrators" style={{ textDecoration: "none" }}>
            <li>
              <BadgeIcon className={styles.icon} />
              {open? <span>Administratoriai</span>:<></>}
            </li>
          </Link>

          <Link href="/filebrowser/dropbox" style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
            <li>
              <UploadFileIcon className={styles.icon} />
              {open? <span>Failų Dropbox'as</span>:<></>}
            </li>
          </Link>

          <Link href="/dbgate" style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
            <li>
              <StorageIcon className={styles.icon} />
              {open? <span>Duomenų Bazė</span>:<></>}
            </li>
          </Link>

          <Link href="/login" style={{ textDecoration: "none" }}>
            <li>
              <ExitToAppIcon className={styles.icon} />
              {open? <span>Atsijungti</span>:<></>}
            </li>
          </Link>




        </ul>
      </div>
      
    </div>
  );
};

export default AdminSidebar;
