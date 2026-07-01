// -----------------------------------------------------------
//  [*] Navbar — the burgundy top bar
//
//  Shown on every signed-in page (admin pages, the student
//  test and results): VU logo linking to /, the app title,
//  and the "Atsijungti" button.
//
//  Logging out is just a hard navigation to /login — the
//  login page drops the session cookie on mount.
//
//  Used by:
//    - AdminPageLayout — every admin page
//    - TestHome / TestFinish — the student pages
// -----------------------------------------------------------

import { Link } from "react-router-dom";
import { Button } from '@mui/material';


export default function Navbar() {
  return (
    <div className="h-[75px] flex items-center text-sm bg-[rgb(123,0,63)] relative w-full" style={{ borderBottom: '0.5px solid rgb(231, 228, 228)' }}>

      {/* VU logo */}
      <Link to="/" style={{ textDecoration: "none", marginLeft: 30, marginRight: 30 }}>
        <img src="/img/vulogo.png" alt="VU logotipas" />
      </Link>

      <div className="w-full p-5 flex items-center justify-between">

        {/* App title */}
        <Link to="/" style={{ textDecoration: "none" }}>
          <div style={{ borderStyle: 'solid', borderWidth: 1, borderRadius: 15, color: 'white', borderColor: 'white', padding: 8, paddingLeft: 12, paddingRight: 12 }}>
            Fišingo atakų atpažinimo testas
          </div>
        </Link>

        {/* Logout */}
        <Button
          variant="contained"
          style={{ background: 'rgb(123, 0, 63)', border: '1px solid rgba(255, 255, 255, 1)' }}
          onClick={() => { window.location.href = "/login" }}
        >
          Atsijungti
        </Button>

      </div>
    </div>
  );
}
