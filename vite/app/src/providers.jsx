// -----------------------------------------------------------
//  [*] Providers — MUI theme wrapper
//
//  Wraps the app in the MUI ThemeProvider (theme built by
//  src/theme.js) and resets browser styles with CssBaseline.
//
//  Special cases:
//    - paths in excludedPaths (App passes /login) skip the
//      theme entirely — those pages style themselves
//
//  The app is light-only (no dark mode), so there is no
//  color-mode context here.
// -----------------------------------------------------------

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useLocation } from 'react-router-dom';
import theme from '@/theme';







// -----------------------------------------------------------
// Providers (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — wraps AppRoutes, with excludedPaths=['/login']
// -----------------------------------------------------------

export default function Providers({ children, excludedPaths = [] }) {

  const { pathname } = useLocation();

  // Excluded pages (login) render without any theme wrapper
  if (excludedPaths.includes(pathname)) {
    return children;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
