import { useState } from 'react';
import { GridPreferencePanelsValue, useGridApiContext } from '@mui/x-data-grid';
import { Button } from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';

export default function ColumnsButton({ label = "STULPELIAI" }) {
  const apiRef = useGridApiContext();
  const [panelOpen, setPanelOpen] = useState(false);
  return (
    <Button
      variant="contained"
      color="primary"
      size="small"
      startIcon={<ViewColumnIcon />}
      onClick={() => {
        if (panelOpen) {
          apiRef.current.hidePreferences();
          setPanelOpen(false);
        } else {
          apiRef.current.showPreferences(GridPreferencePanelsValue.columns);
          setPanelOpen(true);
        }
      }}
      sx={{ ml: 1 }}
    >
      {label}
    </Button>
  );
}
