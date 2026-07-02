// -----------------------------------------------------------
//  [*] DataGrid custom components — ColumnsButton
//
//  Toolbar button for MUI X DataGrid that toggles the built-in
//  column visibility panel (show/hide columns). A replacement
//  for the stock GridToolbarColumnsButton, styled as a small
//  contained button with a custom label.
//
//  Must be rendered inside a DataGrid toolbar slot — it relies
//  on useGridApiContext to reach the grid API.
// -----------------------------------------------------------

import { useState } from 'react';
import { GridPreferencePanelsValue, useGridApiContext } from '@mui/x-data-grid';
import { Button } from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';







// -----------------------------------------------------------
// ColumnsButton (default export)
// -----------------------------------------------------------
//
// Tracks the panel state locally so a second click closes the
// panel instead of reopening it.
//
// Used by:
//   - the admin grid toolbars (StudentsListTable,
//     AdministratorsList)
// -----------------------------------------------------------

export default function ColumnsButton({ label = "STULPELIAI" }) {

  const apiRef = useGridApiContext();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <Button
      variant="contained"
      size="small"
      startIcon={<ViewColumnIcon />}
      color="primary"
      sx={{ ml: 1 }}
      onClick={() => {
        if (panelOpen) {
          apiRef.current.hidePreferences();
          setPanelOpen(false);
        } else {
          apiRef.current.showPreferences(GridPreferencePanelsValue.columns);
          setPanelOpen(true);
        }
      }}
    >
      {label}
    </Button>
  );
}
