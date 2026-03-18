
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Tooltip from '@mui/material/Tooltip';

// Collapse/Expand Sidebar
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';

// Pagrindinis
import DashboardIcon from "@mui/icons-material/Dashboard";

// Sąrašai
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';

// Prezentacija
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ImageIcon from '@mui/icons-material/Image';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';

// Sistema
import BadgeIcon from '@mui/icons-material/Badge';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ApiIcon from '@mui/icons-material/Api';
import StorageIcon from '@mui/icons-material/Storage';
import ExitToAppIcon from "@mui/icons-material/ExitToApp";


const SectionTitle = ({ title, open }) => (
  <p className="text-[10px] font-bold text-[#999] mt-[15px] mb-[2px] whitespace-pre-wrap">
    {open ? title : '-----'}
  </p>
);


const MenuItemContent = ({ icon: Icon, label, open }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Tooltip
      open={!open && hovered}
      title={label}
      placement="right"
      disableInteractive
      slotProps={{
        tooltip: { sx: { backgroundColor: '#000', fontSize: '15px' } },
      }}
    >
      <li
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setHovered(false)}
        className="flex items-center py-[3px] pl-[6px] pr-[10px] cursor-pointer whitespace-nowrap rounded-[3px] hover:bg-[#999] transition-colors"
      >
        <Icon style={{ fontSize: '17px', color: 'rgb(123, 0, 63)' }} />
        {open && <span className="text-[13px] font-semibold text-[rgb(65,65,65)] ml-[10px]">{label}</span>}
      </li>
    </Tooltip>
  );
};

const MenuItem = ({ href, icon: Icon, label, open, external = false }) => {
  if (external) {
    return (
      <a href={href} className="no-underline" target="_blank" rel="noopener noreferrer">
        <MenuItemContent icon={Icon} label={label} open={open} />
      </a>
    );
  }

  return (
    <Link to={href} className="no-underline">
      <MenuItemContent icon={Icon} label={label} open={open} />
    </Link>
  );
};


const AdminSidebar = ({ authData }) => {
  const sidebarRef = useRef(null);
  const [open, setopen] = useState(() => localStorage.getItem("sidebarOpen") !== "false");

  useEffect(() => {
    setopen(localStorage.getItem("sidebarOpen") !== "false");
  }, []);

  const toggleOpen = () => {
    const sidebarOpenNewValue = !open;
    setopen(sidebarOpenNewValue);
    localStorage.setItem('sidebarOpen', sidebarOpenNewValue);
  };

  return (
    <div ref={sidebarRef} className="border-r border-r-white bg-white min-h-full overflow-y-auto transition-all duration-500 ease-in-out">
      <div className="px-[10px]">
        <ul className="list-none m-0 p-0">
          
          {/* Collapse Button */}
          <button
            className="text-[#B2BAC2] bg-[rgb(123,0,63)] cursor-pointer mt-5 border-0 rounded-lg w-full"
            onClick={toggleOpen}
          >
            {open 
              ? <KeyboardDoubleArrowLeftIcon style={{ verticalAlign: 'middle' }} />
              : <KeyboardDoubleArrowRightIcon style={{ verticalAlign: 'middle' }} />
            }
          </button>

          {/* PAGRINDINIS */}
          <SectionTitle title="PAGRINDINIS" open={open} />
          <MenuItem href="/admin" icon={DashboardIcon} label="Pradžia" open={open} />

          {/* SĄRAŠAI */}
          <SectionTitle title="SĄRAŠAI" open={open} />
          <MenuItem href="/admin/students" icon={PersonOutlineIcon} label="Studentai" open={open} />
          <MenuItem href="/admin/questions" icon={QuestionMarkIcon} label="Klausimai" open={open} />

          {/* PREZENTACIJA */}
          <SectionTitle title="PREZENTACIJA" open={open} />
          <MenuItem href="/slides" icon={SlideshowIcon} label="Skaidrės (Paleisti)" open={open} external={true} />
          <MenuItem href="/filebrowser/slides" icon={ImageIcon} label="Skaidrės (Failai)" open={open} external={true} />
          <MenuItem href="/leaderboard" icon={LeaderboardIcon} label="Leaderboard'as" open={open} external={true} />

          {/* SISTEMA */}
          <SectionTitle title="SISTEMA" open={open} />
          <MenuItem href="/admin/administrators" icon={BadgeIcon} label="Administratoriai" open={open} />
          <MenuItem href="/filebrowser/dropbox" icon={UploadFileIcon} label="Failų Dropbox'as" open={open} external={true} />
          <MenuItem href="/swagger" icon={ApiIcon} label="API Dokumentacija" open={open} external={true} />
          <MenuItem href="/dbgate" icon={StorageIcon} label="Duomenų Bazė" open={open} external={true} />
          <MenuItem href="/login" icon={ExitToAppIcon} label="Atsijungti" open={open} />

        </ul>
      </div>
    </div>
  );
};

export default AdminSidebar;
