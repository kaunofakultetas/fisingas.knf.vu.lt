// -----------------------------------------------------------
//  [*] Public — Leaderboard page
//
//  The projector view shown during events: a slim burgundy
//  header (logo + "Apsilankyk: https://fisingas.knf.vu.lt")
//  and the live student leaderboard table. Also embedded by
//  the /slides page in an iframe.
//
//  Public on purpose — no session required, students see it
//  on the big screen.
//
//  Split into (root component last):
//
//    LeaderboardNavbar — the header (this page only; the
//                        shared Navbar is for signed-in pages)
//    LeaderboardPage   — the page itself (default export)
// -----------------------------------------------------------

import { Link } from "react-router-dom";
import LeaderboardTable from "./LeaderboardTable/LeaderboardTable";







// -----------------------------------------------------------
// LeaderboardNavbar
// -----------------------------------------------------------
//
// Burgundy top bar with the VU KnF logo and the visit-us URL
// badge. Taller than the app Navbar so it reads well from a
// distance.
//
// Used by:
//   - LeaderboardPage (below)
// -----------------------------------------------------------

function LeaderboardNavbar() {
  return (
    <div style={{
      height: '100px',
      borderBottom: '0.5px solid rgb(231, 228, 228)',
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px',
      backgroundColor: 'rgb(123, 0, 63)',
      position: 'relative',
      width: '100%',
    }}>
      <Link to="/" style={{ textDecoration: "none", marginLeft: 30, marginRight: 30 }}>
        <img src="/img/vuknflogowithbackground.png" alt="VU KnF logotipas" style={{ width: '200px' }} />
      </Link>

      <div style={{
        width: '100%',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}>
        <div
          style={{
            background: 'rgb(123, 0, 63)',
            border: '1px solid rgba(255, 255, 255, 1)',
            borderRadius: '10px',
            padding: '6px 16px',
            color: 'white',
            textAlign: 'center',
            cursor: 'default',
            fontSize: '20px',
          }}
        >
          Apsilankyk: https://fisingas.knf.vu.lt
        </div>
      </div>
    </div>
  );
}







// -----------------------------------------------------------
// LeaderboardPage (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /leaderboard
//   - Slides — embedded in an iframe between slide images
// -----------------------------------------------------------

export default function LeaderboardPage() {
  return (
    <div>
      <LeaderboardNavbar />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '80%',
          marginLeft: 'auto',
          marginRight: 'auto',
          height: 'calc(100vh - 130px)',
          overflow: 'hidden',
        }}
      >
        <LeaderboardTable/>
      </div>

      {/* Footer */}
      <div style={{ background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em" }}>
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>
  );
}
