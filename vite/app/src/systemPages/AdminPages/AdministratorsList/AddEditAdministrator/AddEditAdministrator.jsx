// -----------------------------------------------------------
//  [*] Admin — AddEditAdministrator
//
//  The add/edit administrator dialog. Editing an existing
//  admin (rowData set) shows their email/enabled state with
//  an optional "Keisti Slaptažodį" flow; adding a new one
//  (rowData undefined) requires the password up front.
//
//  Save/insert/delete all go to POST /api/admin/administrators
//  with an `action` field; deletion is behind a long-press
//  button so it can't happen by accident. Afterwards the
//  parent list is refreshed via `getData`.
//
//  Used by:
//    - AdministratorsList.jsx — row click (edit) and the
//      toolbar's "Įterpti Naują" (add)
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";
import toast from 'react-hot-toast';

import { Button, Dialog, DialogContent, Stack, Typography, TextField, Box, FormControl, Grid, MenuItem } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';

import { LongPressDeleteButton } from '@/components/Other/LongPressButton/LongPressButton';


export default function AddEditAdministrator({ rowData, setOpen, getData }) {

  const [data, setData] = useState(undefined);
  const [changePassword, setChangePassword] = useState(false);


  // Editing → prefill from the clicked row; adding → empty form
  // with the password fields shown right away
  useEffect(() => {
    if (rowData !== undefined) {
      setData({
        id: rowData.row.id,
        email: rowData.row.email,
        enabled: rowData.row.enabled,
        password: '',
        confirmPassword: '',
      });
      setChangePassword(false);
    } else {
      setData({
        id: '',
        email: '',
        enabled: 1,
        password: '',
        confirmPassword: '',
      });
      setChangePassword(true);
    }
  }, [rowData]);


  async function sendData(postData) {
    const response = await axios.post("/api/admin/administrators", postData, { withCredentials: true });

    if (response.data.type === 'ok') {
      toast.success(<b>Išsaugota</b>, { duration: 3000 });
    } else if (response.data.type === 'error') {
      toast.error(<b>Nepavyko:<br/>{response.data.reason}</b>, { duration: 8000 });
    } else {
      toast.error(<b>Nepavyko:<br/>Neaiškus atsakymas.</b>, { duration: 8000 });
    }
    getData();
    setOpen(false);
  }


  function handleSaveButton() {
    sendData({
      action: 'insertupdate',
      id: data.id,
      email: data.email,
      enabled: data.enabled,
      password: data.password,
    });
  }


  function handleDeleteButton() {
    sendData({
      action: 'delete',
      id: data.id,
    });
  }


  if (data === undefined) {
    return null;
  }


  const passwordsMatch = data.password === data.confirmPassword;

  const disableSave =
    (changePassword && (!passwordsMatch || data.password === '' || data.confirmPassword === '')) ||
    (data.email.trim() === '');


  return (
    <Dialog open={true} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 3 }}>

        {/* Title + close button */}
        <Box style={{ marginBottom: 20 }}>
          <Grid container direction="row">
            <Grid size={10} sx={{ textAlign: "left" }}>
              <Typography component="h2" variant="h6" sx={{ mb: '30px' }}>
                Administratorius
              </Typography>
            </Grid>

            <Grid size={2} sx={{ textAlign: "right" }}>
              <Button
                onClick={() => setOpen(false)}
                style={{ padding: 0, borderRadius: '50%', backgroundColor: 'transparent', outline: 'transparent' }}
              >
                <CancelIcon style={{ color: 'red' }} />
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Stack spacing={3}>

          <FormControl size="medium" color="primary">
            <TextField
              disabled
              style={{
                backgroundColor: "lightgrey",
              }}
              label="ID"
              value={data.id}
            />
          </FormControl>

          <FormControl size="medium" color="primary">
            <TextField
              type="email"
              required
              label="El. Paštas"
              value={data.email}
              onChange={(e) => setData(prevData => ({ ...prevData, email: e.target.value }))}
            />
          </FormControl>

          <FormControl size="medium" color="primary">
            <TextField
              select
              label="Įjungtas?"
              value={data.enabled}
              onChange={(e) => setData(prevData => ({ ...prevData, enabled: e.target.value }))}
            >
              <MenuItem value={1}>Taip</MenuItem>
              <MenuItem value={0}>Ne</MenuItem>
            </TextField>
          </FormControl>

          {/* Password — hidden behind a button when editing */}
          {rowData !== undefined && !changePassword && (
            <Box>
              <Button
                variant="outlined"
                onClick={() => setChangePassword(true)}
                style={{ width: '100%', color: 'black', marginBottom: '10px' }}
              >
                Keisti Slaptažodį
              </Button>
            </Box>
          )}

          {(changePassword || rowData === undefined) && (
            <>
              <FormControl size="medium" color="primary">
                <TextField
                  type="password"
                  label="Slaptažodis"
                  value={data.password}
                  onChange={(e) => setData(prevData => ({ ...prevData, password: e.target.value }))}
                />
              </FormControl>

              <FormControl size="medium" color="primary">
                <TextField
                  type="password"
                  label="Pakartoti Slaptažodį"
                  value={data.confirmPassword}
                  error={!passwordsMatch && data.confirmPassword !== ''}
                  helperText={!passwordsMatch && data.confirmPassword !== '' ? 'Slaptažodžiai nesutampa' : ''}
                  onChange={(e) => setData(prevData => ({ ...prevData, confirmPassword: e.target.value }))}
                />
              </FormControl>
            </>
          )}

          <div style={{ marginTop: '100px' }}></div>

          {/* Save + (when editing) long-press delete */}
          <Box>
            <Grid container spacing={1} sx={{ textAlign: "center" }} direction="row">
              <Grid size={rowData !== undefined ? 6 : 12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => handleSaveButton()}
                  disabled={disableSave}
                >
                  {rowData !== undefined ? 'Išsaugoti' : 'Įterpti'}
                </Button>
              </Grid>

              {rowData !== undefined && (
                <Grid size={6}>
                  <LongPressDeleteButton
                    fullWidth
                    onComplete={handleDeleteButton}
                    completedToastMessage="Įrašas ištrintas"
                    uncompletedToastMessage="Laikykite nuspaudę, kad ištrintumėte"
                  >
                    <DeleteIcon sx={{ mr: 1 }} />
                    Ištrinti Įrašą
                  </LongPressDeleteButton>
                </Grid>
              )}

            </Grid>
          </Box>

        </Stack>
      </DialogContent>
    </Dialog>
  );
}
