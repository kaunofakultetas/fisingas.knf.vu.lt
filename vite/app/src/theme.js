// -----------------------------------------------------------
//  [*] MUI theme — the VU KnF burgundy palette
//
//  Single light theme used across the whole app:
//    - primary.main — the VU KnF burgundy (buttons, links,
//      table accents, sidebar icons)
//    - primary.dark — the hover/focus pink used all over the
//      admin pages
//
//  cssVariables: MUI emits every palette value as a CSS
//  custom property (--mui-*), so non-MUI styling (Tailwind
//  arbitrary values, the theme bridge in globals.css) can
//  reference the same colors — e.g.
//  var(--mui-palette-primary-main) for the burgundy, or the
//  --mui-palette-primary-mainChannel triplet the admin
//  sidebar tints its active row with.
//
//  The login page styles itself and skips the theme entirely
//  (see providers.jsx / excludedPaths).
// -----------------------------------------------------------

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,

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
