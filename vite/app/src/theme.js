// -----------------------------------------------------------
//  [*] MUI theme — the VU KnF burgundy palette
//
//  Single light theme used across the whole app:
//    - primary.main — the VU KnF burgundy (buttons, links,
//      table accents, sidebar icons)
//    - primary.dark — the hover/focus pink used all over the
//      admin pages
//
//  The login page styles itself and skips the theme entirely
//  (see providers.jsx / excludedPaths).
// -----------------------------------------------------------

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#7B003F',    // rgb(123, 0, 63)
      dark: '#E64164',    // rgb(230, 65, 100)
      contrastText: '#ffffff',
    },
  },
});

export default theme;
