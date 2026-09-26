// -----------------------------------------------------------
//  [*] Leaderboard — LeaderboardTable
//
//  The live results table shown on the projector: one row per
//  student with a rank badge (gold/silver/bronze for the top
//  three) and a combined progress/score bar — blue
//  "answered / total" while the test is running, burgundy
//  "Įvertinimas: X" once finished. Data comes from
//  /api/leaderboard, refreshed by a visible 5 s countdown
//  ("Atnaujinimas po: Xs"); rows are sorted by grade, best
//  first. A refresh that falls due while the previous one is
//  still unanswered is skipped, so a slow backend never gets
//  overlapping requests.
//
//  By default only students seen within the last day are
//  shown (it's an event view) — the "Rodyti Visus" checkbox
//  lifts the filter.
//
//  A failed load with no standings to show says the board is
//  unreachable — never "Šiuo metu dalyvių nėra" — while the
//  countdown keeps retrying; a failed refresh keeps the last
//  standings on screen.
//
//  Split into (root component last):
//
//    RankBadge        — place number, medal-tinted for top 3
//    ProgressBar      — the progress/score bar of one row
//    LeaderboardTable — the table itself (default export)
//
//  Used by:
//    - Leaderboard — the /leaderboard page
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import useFetchData from "@/hooks/useFetchData";
import { formatDateTime, parseTimestamp } from "@/utils/timestamps";
import LoadError from "@/components/Other/LoadError/LoadError";


const REFRESH_TIME = 5; // seconds







// -----------------------------------------------------------
// RankBadge
// -----------------------------------------------------------
//
// The student's place in the standings: a tinted medal circle
// for places 1–3 (gold / silver / bronze), a plain number for
// everyone else.
//
// Used by:
//   - LeaderboardTable (below)
// -----------------------------------------------------------

function RankBadge({ place }) {

  const medalClasses = {
    1: "bg-amber-100 text-amber-700 border-amber-300",
    2: "bg-slate-100 text-slate-600 border-slate-300",
    3: "bg-orange-100 text-orange-700 border-orange-300",
  };

  if (medalClasses[place]) {
    return (
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full border text-base font-bold ${medalClasses[place]}`}>
        {place}
      </span>
    );
  }

  return <span className="inline-block w-9 text-center text-gray-400 font-semibold">{place}</span>;
}







// -----------------------------------------------------------
// ProgressBar
// -----------------------------------------------------------
//
// The combined progress/score bar of one row:
//   - test running  — blue bar, "answered / total" in black
//     (a student not dealt a test yet: "0 / 0", empty bar)
//   - test finished — full burgundy bar, "Įvertinimas: X"
//     in white
//
// Used by:
//   - LeaderboardTable (below)
// -----------------------------------------------------------

function ProgressBar({ row }) {

  const finished = row.isfinished === 1;

  // A student not dealt a test yet arrives with the API's
  // blank fields (answeredquestioncount null, questioncount
  // "") — counted as 0 of 0
  const answered = row.answeredquestioncount ?? 0;
  const total = row.questioncount || 0;

  // No questions dealt means an empty bar (guards the
  // division against a zero total)
  const percent = finished
    ? 100
    : total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="relative h-9 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out
          ${finished ? 'bg-[rgb(123,0,63)]' : 'bg-blue-500/80'}`}
        style={{ width: `${percent}%` }}
      />
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-bold pointer-events-none
          ${finished ? 'text-white' : 'text-gray-800'}`}
      >
        {finished
          ? `Įvertinimas: ${row.testgrade}`
          : `${answered} / ${total}`
        }
      </span>
    </div>
  );
}







// -----------------------------------------------------------
// LeaderboardTable (default export)
// -----------------------------------------------------------
//
// Used by:
//   - Leaderboard.jsx — the /leaderboard page
// -----------------------------------------------------------

export default function LeaderboardTable() {

  const { data, loadingData, error, poll } = useFetchData("/api/leaderboard");

  const [showRecentOnly, setShowRecentOnly] = useState(true);
  const [nextUpdate, setNextUpdate] = useState(REFRESH_TIME);


  // Visible refresh countdown — tick down every second and
  // poll the leaderboard when it reaches zero. The count lives
  // in the timer, not in a state updater: React may run an
  // updater twice (StrictMode does in development), and a
  // request sent from one would go out twice. poll() skips the
  // refresh while the previous one is still unanswered
  useEffect(() => {
    let secondsLeft = REFRESH_TIME;

    const timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft === 0) {
        poll();
        secondsLeft = REFRESH_TIME;
      }
      setNextUpdate(secondsLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [poll]);


  // No standings on hand and the last load failed — the board
  // is unreachable, which must not read as nobody taking part
  const unreachable = Boolean(error) && data.length === 0;


  // Hide students not seen within the last day (unless "show
  // all" is ticked), then order by grade
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const filteredRows = data.filter((row) => {
    if (!showRecentOnly) return true;
    const lastSeen = parseTimestamp(row.lastseen);
    return lastSeen !== null && lastSeen >= oneDayAgo;
  });

  filteredRows.sort((a, b) => b.testgrade - a.testgrade);


  return (
    <div className="w-full min-h-0 flex flex-col p-5 font-sans">

      {/* Header — title, live countdown pill, show-all toggle */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Fišingo Atakų Atpažinimo Lyderiai</h2>
          <div className="mt-1 inline-flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {loadingData ? "Kraunama..." : `Atnaujinimas po: ${nextUpdate}s`}
          </div>
        </div>

        <label className="inline-flex items-center text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mr-2 w-4 h-4 accent-[rgb(123,0,63)]"
            checked={!showRecentOnly}
            onChange={(e) => setShowRecentOnly(!e.target.checked)}
          />
          Rodyti Visus
        </label>
      </div>

      {/* Table card — scrolls inside the fixed page height */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[46%]" />
            <col className="w-[22%]" />
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-gray-50 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 px-3 py-3 border-b border-gray-200">Vieta</th>
              <th className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 px-3 py-3 border-b border-gray-200">Vardas</th>
              <th className="bg-gray-50 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 px-3 py-3 border-b border-gray-200">Įvertinimas / Progresas</th>
              <th className="bg-gray-50 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 px-3 py-3 border-b border-gray-200">Paskutinįkart Pastebėtas</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 border-b border-gray-100 text-center">
                  <RankBadge place={index + 1} />
                </td>
                <td className="px-3 py-2.5 border-b border-gray-100 font-semibold text-gray-800 truncate">
                  {row.username}
                </td>
                <td className="px-3 py-2.5 border-b border-gray-100">
                  <ProgressBar row={row} />
                </td>
                <td className="px-3 py-2.5 border-b border-gray-100 text-center text-sm text-gray-500">
                  {formatDateTime(row.lastseen)}
                </td>
              </tr>
            ))}

            {/* Unreachable — no retry button: nobody clicks the
                projector, the countdown retries by itself */}
            {unreachable && (
              <tr>
                <td colSpan={4}>
                  <LoadError message="Rezultatai šiuo metu nepasiekiami — bandoma iš naujo" />
                </td>
              </tr>
            )}

            {/* Empty state — nobody seen within the last day */}
            {!loadingData && !unreachable && filteredRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-12 text-center text-gray-400">
                  Šiuo metu dalyvių nėra
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
