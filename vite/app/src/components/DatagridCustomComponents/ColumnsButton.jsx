// -----------------------------------------------------------
//  [*] DataGrid custom components — ColumnsButton
//
//  Toolbar button for MUI X DataGrid that opens and closes the
//  built-in column visibility panel (show/hide columns). A
//  replacement for the stock columns button, styled as a small
//  contained button with a custom label; the panel opens
//  anchored under it.
//
//  Built on the grid's own ColumnsPanelTrigger, which reads
//  whether the panel is open from the grid's state — the panel
//  also closes itself (a click elsewhere, Escape), and the next
//  click must open it again. While the panel is open the
//  trigger stops the click's pointerup: the panel's click-away
//  fires on pointerup, before the click, and would otherwise
//  close the panel only for the click to open it again.
//
//  Must be rendered inside a DataGrid toolbar slot — the
//  trigger reaches the grid through its context.
// -----------------------------------------------------------

import { ColumnsPanelTrigger } from '@mui/x-data-grid';
import { Button } from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';







// -----------------------------------------------------------
// ColumnsButton (default export)
// -----------------------------------------------------------
//
// Used by:
//   - the admin grid toolbars (StudentsListTable,
//     AdministratorsList)
// -----------------------------------------------------------

export default function ColumnsButton({ label = "STULPELIAI" }) {
  return (
    <ColumnsPanelTrigger
      render={
        <Button
          variant="contained"
          size="small"
          startIcon={<ViewColumnIcon />}
          color="primary"
          sx={{ ml: 1 }}
        >
          {label}
        </Button>
      }
    />
  );
}
