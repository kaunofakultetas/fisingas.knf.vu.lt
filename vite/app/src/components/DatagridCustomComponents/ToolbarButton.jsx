// -----------------------------------------------------------
//  [*] DataGrid custom components — ToolbarButton
//
//  Generic action button for DataGrid toolbars: small contained
//  button with an optional icon and a label, wired to whatever
//  onClick the caller provides. Unlike ColumnsButton it has no
//  grid logic of its own, so it works anywhere.
// -----------------------------------------------------------

import { Button } from '@mui/material';







// -----------------------------------------------------------
// ToolbarButton (default export)
// -----------------------------------------------------------
//
// Used by:
//   - AdministratorsList — "Įterpti Naują" button that opens
//     the add-administrator dialog
// -----------------------------------------------------------

export default function ToolbarButton({ onClick, label, icon: Icon }) {
  return (
    <Button
      variant="contained"
      color="primary"
      sx={{ ml: 1, px: 2, height: 30 }}
      onClick={onClick}
    >
      {Icon && <Icon className="pr-2 text-[22px]" />}
      {label}
    </Button>
  );
}
