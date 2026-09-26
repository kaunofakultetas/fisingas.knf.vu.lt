// -----------------------------------------------------------
//  [*] useFetchData — the app's standard GET hook
//
//  Fetches JSON from an endpoint (with the session cookie)
//  and returns { data, loadingData, error, refetch, poll }.
//
//  Behavior worth knowing:
//    - data starts as [] (not null), so list pages can map
//      over it before the response arrives
//    - `error` is set by every failed request and cleared by
//      the next good one; a failed refresh keeps the last data
//      on screen — so "failed to load" is `error` while data
//      is still the initial [], and a page that must tell it
//      from "nothing there" checks exactly that
//    - only the NEWEST request's reply is applied: a late
//      reply (a slow refresh, or the previous endpoint's
//      request after the endpoint changed) is dropped, so the
//      data never goes back in time
//    - polling (refreshInterval, seconds) and poll() skip a
//      refresh while the newest request is still running — a
//      slow backend is not piled up with requests. A request
//      unanswered after STUCK_REQUEST_MS no longer holds them
//      back (it is outdated by the next one), and the browser
//      gives up on it at the same time (axios timeout)
//    - a 401 hard-redirects the whole page to /login and the
//      admin role gate ("Error: Not Admin", HTTP 200) to "/" —
//      consumers never see auth problems as data; any other
//      non-JSON reply (a proxy's error page) is an error
//    - allowEmpty + falsy endpoint skips fetching entirely
//      (for conditional fetches); loading just ends
//
//  Used all over: the admin grids (StudentsListTable,
//  AdministratorsList, StudentTestSummaryTable), the admin
//  pages (Home, Questions, StudentInformation,
//  StudentAnswers), the results page (TestFinish) and the
//  public leaderboard.
// -----------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

import { redirectOnExpiredSession, redirectOnRoleGate } from '@/utils/session';


// After this long an unanswered request counts as stuck: polls
// go out again and the browser abandons it
const STUCK_REQUEST_MS = 20000;







// -----------------------------------------------------------
// useFetchData (default export)
// -----------------------------------------------------------
//
//   useFetchData(endpoint)                    — fetch once
//   useFetchData(endpoint, 30)                — poll every 30 s
//   useFetchData(endpoint, null, true)        — endpoint may be
//                                               null/"" → no fetch
//   const { refetch } = useFetchData(...)     — manual refresh
//                                               (e.g. after a save)
//   const { poll } = useFetchData(...)        — a refresh of the
//                                               page's own pace,
//                                               skipped while a
//                                               request runs
// -----------------------------------------------------------

export default function useFetchData(endpoint, refreshInterval = null, allowEmpty = false) {

  const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  // Every request gets the next number; a reply counts only
  // while its number is still the newest
  const latestRequest = useRef(0);

  // When the newest request went out — null once it answered
  const newestSentAt = useRef(null);


  // Back to loading — and back to empty data — whenever the
  // endpoint changes (e.g. a URL built from route params), so
  // consumers never briefly show the previous endpoint's data
  useEffect(() => {
    setData([]);
    setError(null);
    setLoadingData(true);
  }, [endpoint]);


  const fetchData = useCallback(async () => {
    const request = ++latestRequest.current;
    const isOutdated = () => request !== latestRequest.current;

    // Conditional fetch support: no endpoint yet → just stop loading
    if (allowEmpty && !endpoint) {
      newestSentAt.current = null;
      setLoadingData(false);
      return;
    }

    newestSentAt.current = Date.now();
    try {
      const response = await axios.get(endpoint, { withCredentials: true, timeout: STUCK_REQUEST_MS });
      if (isOutdated() || redirectOnRoleGate(response.data)) {
        return;
      }

      // axios hands a body that is not JSON over as a string —
      // never data a page could render
      if (typeof response.data === 'string') {
        setError(new Error(`Unexpected reply from ${endpoint}`));
      } else {
        setData(response.data);
        setError(null);
      }
      setLoadingData(false);
    } catch (err) {
      if (isOutdated() || redirectOnExpiredSession(err)) {
        return;
      }
      setError(err);
      setLoadingData(false);
    } finally {
      if (!isOutdated()) {
        newestSentAt.current = null;
      }
    }
  }, [endpoint, allowEmpty]);


  // A refresh at the page's own pace — skipped while the newest
  // request is still running (unless it is stuck), so the
  // requests never pile up
  const poll = useCallback(() => {
    const sentAt = newestSentAt.current;
    if (sentAt !== null && Date.now() - sentAt < STUCK_REQUEST_MS) {
      return;
    }
    fetchData();
  }, [fetchData]);


  // Fetch on mount and whenever the endpoint changes; with a
  // refreshInterval also poll until unmount
  useEffect(() => {
    fetchData();

    if (refreshInterval) {
      const interval = setInterval(poll, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, poll, refreshInterval]);


  // A reply arriving after unmount is outdated too
  useEffect(() => () => {
    latestRequest.current += 1;
  }, []);


  return { data, loadingData, error, refetch: fetchData, poll };
}
