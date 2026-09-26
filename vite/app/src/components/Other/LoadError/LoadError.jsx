// -----------------------------------------------------------
//  [*] Other — LoadError
//
//  What a page shows where its data failed to load: a short
//  message and a "Bandyti dar kartą" button that asks again.
//  Pages show it instead of the empty / zero state they would
//  otherwise draw from the not-yet-loaded (empty) data — an
//  empty list and a list that failed to load must never look
//  alike.
//
//  One retry runs at a time: while it runs the button is
//  aria-disabled (it keeps the keyboard focus) and the panel
//  says "Bandoma iš naujo…"; a retry that did not help (the
//  page still shows the panel) says so. The panel is an alert,
//  so screen readers announce it and those lines.
//
//  Used by:
//    - Home, Questions, AdministratorsList, StudentsListTable,
//      StudentInformation, StudentTestSummaryTable — the admin
//      pages
//    - StudentAnswers, TestHome, TestFinish — the answer review
//      and the student pages
//    - LeaderboardTable — the projector page (message only)
//    - InteractiveImageEditor — the link areas
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";







// -----------------------------------------------------------
// LoadError (default export)
// -----------------------------------------------------------
//
//   <LoadError onRetry={refetch} />
//   <LoadError message="Nepavyko įkelti klausimų" onRetry={refetch} />
//   <LoadError message="…" />             — no button, message only
//
// onRetry may return the request's promise: the retry counts
// as running until it settles.
// -----------------------------------------------------------

export default function LoadError({ message = "Nepavyko įkelti duomenų", onRetry }) {

  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  // A ref as well as the state — a second click in the same
  // tick must see the running retry
  const retryRunning = useRef(false);

  // Still on screen once the retry settled = it did not help
  // (a successful one makes the page replace the panel)
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);


  const retry = async () => {
    if (retryRunning.current) return;
    retryRunning.current = true;
    setRetrying(true);
    setRetryFailed(false);

    try {
      await onRetry();
    } catch {
      // A failed retry is the page's to show (its data keeps the
      // error) — the panel just offers the button again
    } finally {
      retryRunning.current = false;
      if (mounted.current) {
        setRetrying(false);
        setRetryFailed(true);
      }
    }
  };


  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="text-lg font-semibold text-gray-700">{message}</div>

      {onRetry && (
        <button
          type="button"
          onClick={retry}
          aria-disabled={retrying}
          className="px-5 py-2 rounded-xl bg-[rgb(123,0,63)] text-white font-semibold cursor-pointer hover:opacity-90
            aria-disabled:opacity-60 aria-disabled:cursor-default"
        >
          Bandyti dar kartą
        </button>
      )}

      {retrying && <div className="text-sm text-gray-500">Bandoma iš naujo…</div>}
      {retryFailed && <div className="text-sm text-gray-500">Vis dar nepavyko — bandykite dar kartą vėliau</div>}
    </div>
  );
}
