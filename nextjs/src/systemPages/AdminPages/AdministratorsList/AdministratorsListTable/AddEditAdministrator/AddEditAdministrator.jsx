import React, { useState, useEffect } from "react";
import axios from "axios";

import { Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { TextField, Box, FormControl, Grid, MenuItem } from "@mui/material";

import CancelIcon from '@mui/icons-material/Cancel';
import toast from 'react-hot-toast';

export default function AddEditAdministrator({ rowData, highestRowID, setOpen, getData }) {
  const [data, setData] = useState(undefined);
  const [changePassword, setChangePassword] = useState(false);

  useEffect(() => {
    if (rowData !== undefined) {
      // Editing an existing user: start with no password change
      setData({
        id: rowData.row.id,
        email: rowData.row.email,
        enabled: rowData.row.enabled,
        password: '',
        confirmPassword: ''
      });
      setChangePassword(false);
    } else {
      // Creating a new user: password fields always required
      setData({
        id: '',
        email: '',
        enabled: 1,
        password: '',
        confirmPassword: ''
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
    const postData = {
      action: 'insertupdate',
      id: data.id,
      email: data.email,
      enabled: data.enabled,
      password: data.password // This will be empty if not changing password while editing
    };
    sendData(postData);
  }

  async function handleDeleteButton() {
    const postData = {
      action: 'delete',
      id: data.id
    };
    sendData(postData);
  }

  if (data === undefined) {
    return null;
  }

  const passwordsMatch = data.password === data.confirmPassword;
  
  // Determine conditions for disabling Save button
  // If inserting a new user or changing password on edit: require matching non-empty passwords.
  // If editing without changing password: passwords can be empty and it's allowed to save.
  const disableSave = 
    (changePassword && (!passwordsMatch || data.password === '' || data.confirmPassword === '')) ||
    (data.email.trim() === '');

  return (
    <Modal open={true} onClose={() => setOpen(false)}>
      <ModalDialog sx={{ width: '500px', borderRadius: 'md', boxShadow: 'lg', backgroundColor: 'white' }} >
        <Box style={{ marginBottom: 20 }}>
          <Grid container direction="row">
            <Grid item xs={10} align="left">
              <Typography component="h2" fontSize="1.25em" mb="0.25em" style={{ marginBottom: '30px' }}>
                Administratorius
              </Typography>
            </Grid>

            <Grid item xs={2} align="right">
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
          <FormControl size="lg" color="primary">
            <TextField
              disabled
              style={{
                backgroundColor: "lightgrey"
              }}
              label="ID"
              value={data.id}
            />
          </FormControl>

          <FormControl size="lg" color="primary">
            <TextField
              type="email"
              required
              label="El. Paštas"
              value={data.email}
              onChange={(e) => setData(prevData => ({ ...prevData, email: e.target.value }))}
            />
          </FormControl>

          <FormControl size="lg" color="primary">
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
              <FormControl size="lg" color="primary">
                <TextField
                  type="password"
                  label="Slaptažodis"
                  value={data.password}
                  onChange={(e) => setData(prevData => ({ ...prevData, password: e.target.value }))}
                />
              </FormControl>

              <FormControl size="lg" color="primary">
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

          <Box>
            <Grid container spacing={1} align="center" direction="row">
              <Grid item xs={rowData !== undefined ? 6 : 12}>
                <Button
                  type="submit"
                  style={{
                    backgroundColor: disableSave ? 'grey' : 'rgb(123, 0, 63)',
                    color: 'white',
                    boxShadow: '0px 8px 15px rgba(0, 0, 0, 0.1)',
                    width: '100%',
                  }}
                  onClick={() => handleSaveButton()}
                  disabled={disableSave}
                >
                  {rowData !== undefined ? 'Išsaugoti' : 'Įterpti'}
                </Button>
              </Grid>

              {rowData !== undefined && (
                <Grid item xs={6}>
                  <Button
                    style={{
                      backgroundColor: 'blue',
                      color: 'white',
                      boxShadow: '0px 8px 15px rgba(0, 0, 0, 0.1)',
                      width: '100%',
                    }}
                    onClick={() => handleDeleteButton()}
                  >
                    Ištrinti Įrašą
                  </Button>
                </Grid>
              )}

            </Grid>
          </Box>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
