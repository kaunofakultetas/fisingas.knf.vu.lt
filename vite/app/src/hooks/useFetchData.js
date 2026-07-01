// -----------------------------------------------------------
//  [*] useFetchData — the app's standard GET hook
//
//  Fetches JSON from an endpoint (with the session cookie)
//  and returns { data, loadingData, error, refetch }.
//
//  Behavior worth knowing:
//    - data starts as [] (not null), so list pages can map
//      over it before the response arrives
//    - a 401 hard-redirects the whole page to /login —
//      consumers never see auth errors
//    - refreshInterval (seconds) turns on polling
//    - allowEmpty + falsy endpoint skips fetching entirely
//      (for conditional fetches); loading just ends
//
//  Used all over: the admin grids (StudentsListTable,
//  AdministratorsList, StudentGroupsTable, SystemUsers),
//  admin dashboards (Home, Questions, StudentInformation)
//  and the public leaderboard.
// -----------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';







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
// -----------------------------------------------------------

export default function useFetchData(endpoint, refreshInterval = null, allowEmpty = false) {

  const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);


  // Back to loading whenever the endpoint changes (e.g. a URL
  // built from route params), so consumers don't briefly show
  // the previous endpoint's data as "loaded"
  useEffect(() => {
    setLoadingData(true);
  }, [endpoint]);


  const fetchData = useCallback(async () => {
    // Conditional fetch support: no endpoint yet → just stop loading
    if (allowEmpty && !endpoint) {
      setLoadingData(false);
      return;
    }

    try {
      const response = await axios.get(endpoint, { withCredentials: true });
      setData(response.data);
      setLoadingData(false);
    } catch (err) {
      if (err.response?.status === 401) {
        // Session expired/missing — restart at the login page
        window.location.href = '/login';
      } else {
        setError(err);
        setLoadingData(false);
      }
    }
  }, [endpoint]);


  // Fetch on mount and whenever the endpoint changes; with a
  // refreshInterval also poll until unmount
  useEffect(() => {
    fetchData();

    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);


  return { data, loadingData, error, refetch: fetchData };
}
