// -----------------------------------------------------------
//  [*] Footer — the burgundy copyright strip
//
//  The thin bar at the bottom of every non-fullscreen page.
//
//  Used by:
//    - PublicPages/Login
//    - PublicPages/Leaderboard
//    - StudentPages/TestHome
//    - StudentPages/TestFinish
// -----------------------------------------------------------

export default function Footer() {
  return (
    <div className="bg-[rgb(123,0,63)] h-[30px] flex justify-center items-center text-white text-[0.7em]">
      Copyright © | All Rights Reserved | VUKnF
    </div>
  );
}
