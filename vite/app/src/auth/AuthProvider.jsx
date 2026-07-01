// -----------------------------------------------------------
//  [*] AuthProvider — session state for the whole app
//
//  Checks the Flask session once on app start:
//    GET /api/checkauth   (session cookie included)
//  and shares the result through React context:
//    - authData — the user info from checkauth, or undefined
//                 when not logged in (also the initial value)
//    - loading  — true until the check finishes; lets routes
//                 wait instead of redirecting to /login early
//
//  authData fields (from the backend):
//    - id / userid — login name and numeric ID
//    - admin       — true for administrators
//    - passcode / phishingtestfinished — students only
//
//  No polling or refresh — a new login/logout becomes visible
//  on the next full page load.
// -----------------------------------------------------------

import { createContext, useContext, useState, useEffect } from 'react';


const AuthContext = createContext({ authData: undefined, loading: true });







// -----------------------------------------------------------
// AuthProvider
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — wraps the router so every route can read the
//     session via useAuth
// -----------------------------------------------------------

export function AuthProvider({ children }) {

  const [authData, setAuthData] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/checkauth', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        setAuthData(data);
        setLoading(false);
      })
      .catch(() => {
        // Not logged in (or the check failed) — treated the same
        setAuthData(undefined);
        setLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ authData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}







// -----------------------------------------------------------
// useAuth
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — RootRedirect and the securedAdmin /
//     securedStudent route guards
// -----------------------------------------------------------

export function useAuth() {
  return useContext(AuthContext);
}
