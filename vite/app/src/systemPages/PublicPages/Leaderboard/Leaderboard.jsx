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
import Footer from "@/components/Other/Footer/Footer";







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
    <div className="h-[100px] w-full relative flex items-center text-sm bg-[rgb(123,0,63)] border-b-[0.5px] border-[rgb(231,228,228)]">
      <Link to="/" className="no-underline mx-[30px]">
        <img src="/img/vuknflogowithbackground.png" alt="VU KnF logotipas" className="w-[200px]" />
      </Link>

      <div className="w-full p-5 flex items-center justify-end">
        <div className="bg-[rgb(123,0,63)] border border-white rounded-[10px] px-4 py-1.5 text-white text-center cursor-default text-xl">
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

      <div className="flex flex-row w-4/5 mx-auto h-[calc(100vh-130px)] overflow-hidden">
        <LeaderboardTable/>
      </div>

      <Footer />
    </div>
  );
}
