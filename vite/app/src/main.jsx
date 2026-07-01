// -----------------------------------------------------------
//  [*] Entry point — mounts the React app
//
//  Renders <App /> (router + providers + routes, see App.jsx)
//  into the #root div of index.html, wrapped in StrictMode.
//  Global styles (Tailwind, fonts) are pulled in here.
// -----------------------------------------------------------

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './globals.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
