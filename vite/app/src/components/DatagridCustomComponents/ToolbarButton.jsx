import { Button } from '@mui/material';

export default function ToolbarButton({ onClick, label, icon: Icon }) {
  return (
    <Button
      variant="contained"
      color="primary"
      sx={{
        marginLeft: '10px',
        paddingLeft: '15px',
        paddingRight: '15px',
        height: 30,
      }}
      onClick={onClick}
    >
      {Icon && <Icon style={{ paddingRight: 8, fontSize: '22px' }} />}
      {label}
    </Button>
  );
}
