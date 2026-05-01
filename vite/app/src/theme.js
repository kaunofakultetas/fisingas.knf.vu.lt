import { createTheme } from '@mui/material/styles';
import { green, grey } from '@mui/material/colors';

const getTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'light' ? {
        primary: { 
          main: "#7B003F",
          dark: '#E64164',
          accent: green[500]
        },
        secondary: { 
          main: grey[50] 
        },
        delete: {
          main: '#f00000',
          dark: '#AD0000',
          contrastText: '#fff',
        },
      } : {
        // Dark mode
      }
    ),
  },
});

export default getTheme;
