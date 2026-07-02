// -----------------------------------------------------------
//  [*] Admin — AddEditAdministrator modal
//
//  Create / edit dialog for the administrators list. One
//  form, two modes:
//    - edit   — rowData given (a grid row): fields prefilled,
//               Delete (hold to confirm) shown, password
//               fields hidden behind a "Keisti Slaptažodį"
//               button
//    - create — rowData undefined: empty form, password
//               required from the start
//
//  Everything posts to /api/admin/administrators:
//    { action: 'insertupdate', ... }  — save / create
//    { action: 'delete', id }         — delete
//  On success it refetches the grid (getData) and closes.
//
//  Split into (main component last):
//
//    ActionButtons          — modal footer: Save/Create + Delete
//    AccountFields          — email / enabled inputs
//    PasswordSection        — change-password button + inputs
//    AddEditAdministrator   — state + API calls (default export)
// -----------------------------------------------------------

import { useState } from "react";
import axios from "axios";
import toast from 'react-hot-toast';

import { Button, Stack, TextField, MenuItem } from "@mui/material";

import { UniversalModal } from "@/components/Other/UniversalModal";
import { LongPressDeleteButton } from "@/components/Other/LongPressButton";

import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import DeleteIcon from '@mui/icons-material/Delete';







// -----------------------------------------------------------
// ActionButtons
// -----------------------------------------------------------
//
// Modal footer: the Save (edit) / Create button, and — in
// edit mode only — the hold-to-confirm Delete button.
//
// Used by:
//   - AddEditAdministrator (below) — the modal's `actions` slot
// -----------------------------------------------------------

function ActionButtons({ isEditing, disableSave, onSave, onDelete }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="contained"
        fullWidth
        sx={{ flex: 1, backgroundColor: 'primary.main', '&:hover': { backgroundColor: 'primary.dark' } }}
        onClick={onSave}
        disabled={disableSave}
      >
        {isEditing ? (
          <><SaveIcon sx={{ mr: 1 }} />Išsaugoti</>
        ) : (
          <><AddCircleOutlinedIcon sx={{ mr: 1 }} />Įterpti</>
        )}
      </Button>

      {isEditing && (
        <LongPressDeleteButton
          fullWidth
          sx={{ flex: 1 }}
          onComplete={onDelete}
          completedToastMessage="Įrašas ištrintas"
          uncompletedToastMessage="Laikykite nuspaudę, kad ištrintumėte"
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Ištrinti
        </LongPressDeleteButton>
      )}
    </div>
  );
}







// -----------------------------------------------------------
// AccountFields
// -----------------------------------------------------------
//
// The always-visible inputs: email plus the Įjungtas? yes/no
// select. Reads/writes the parent's form state via
// form / onChange(field).
//
// Used by:
//   - AddEditAdministrator (below)
// -----------------------------------------------------------

function AccountFields({ form, onChange }) {
  return (
    <>
      <TextField required fullWidth type="email" label="El. Paštas" value={form.email} onChange={onChange('email')} />

      <TextField select fullWidth label="Įjungtas?" value={form.enabled} onChange={onChange('enabled')}>
        <MenuItem value={1}>Taip</MenuItem>
        <MenuItem value={0}>Ne</MenuItem>
      </TextField>
    </>
  );
}







// -----------------------------------------------------------
// PasswordSection
// -----------------------------------------------------------
//
// In edit mode the password inputs start collapsed behind a
// "Keisti Slaptažodį" button; in create mode they are open
// from the start. The repeat field shows a mismatch error as
// soon as both fields have content.
//
// Used by:
//   - AddEditAdministrator (below)
// -----------------------------------------------------------

function PasswordSection({ form, onChange, isEditing, changePassword, onShowPasswordFields, passwordsMatch }) {

  if (isEditing && !changePassword) {
    return (
      <Button
        variant="outlined"
        fullWidth
        sx={{ color: 'black', borderColor: 'black' }}
        onClick={onShowPasswordFields}
      >
        Keisti Slaptažodį
      </Button>
    );
  }

  return (
    <>
      <TextField
        required
        fullWidth
        type="password"
        label="Slaptažodis"
        value={form.password}
        onChange={onChange('password')}
      />
      {/* Mismatch error only once the repeat field has content,
          so the user isn't flagged red while still typing */}
      <TextField
        required
        fullWidth
        type="password"
        label="Pakartoti Slaptažodį"
        value={form.confirmPassword}
        error={!passwordsMatch && form.confirmPassword !== ''}
        helperText={!passwordsMatch && form.confirmPassword !== '' ? 'Slaptažodžiai nesutampa' : ''}
        onChange={onChange('confirmPassword')}
      />
    </>
  );
}







// -----------------------------------------------------------
// AddEditAdministrator (default export)
// -----------------------------------------------------------
//
// Holds the form state and the API calls; the visual pieces
// above are purely presentational.
//
// Used by:
//   - AdministratorsList — opened on row click (edit) or the
//     toolbar's "Įterpti Naują" button (create)
// -----------------------------------------------------------

export default function AddEditAdministrator({ rowData, setOpen, getData }) {

  // rowData is the DataGrid's row-click params — the admin itself is under .row
  const isEditing = rowData !== undefined;

  // id '' tells the backend to INSERT instead of UPDATE;
  // enabled is a 1/0 int, as stored in the DB
  const [form, setForm] = useState({
    id:              isEditing ? rowData.row.id      : '',
    email:           isEditing ? rowData.row.email   : '',
    enabled:         isEditing ? rowData.row.enabled : 1,
    password:        '',
    confirmPassword: '',
  });

  // When editing, password fields stay hidden until requested
  const [changePassword, setChangePassword] = useState(!isEditing);

  // Curried: updateField('email') returns the onChange handler for that field
  const updateField = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));


  // POST to the administrators endpoint; on success refetch the
  // grid and close. withCredentials sends the session cookie
  // (admin-only endpoint).
  async function sendData(postData) {
    try {
      const response = await axios.post("/api/admin/administrators", postData, { withCredentials: true });

      if (response.data.type === 'ok') {
        toast.success(<b>Išsaugota</b>, { duration: 3000 });
        getData();
        setOpen(false);
      } else if (response.data.type === 'error') {
        toast.error(<b>Nepavyko:<br/>{response.data.reason}</b>, { duration: 8000 });
      } else {
        toast.error(<b>Nepavyko:<br/>Neaiškus atsakymas.</b>, { duration: 8000 });
      }
    } catch (error) {
      toast.error(<b>Nepavyko:<br/>Serverio klaida.</b>, { duration: 8000 });
    }
  }

  function handleSaveButton() {
    // password is always sent; an empty string means "keep the current
    // password" — the backend only rehashes when it's non-empty
    sendData({
      action: 'insertupdate',
      id: form.id,
      email: form.email,
      enabled: form.enabled,
      password: form.password,
    });
  }

  function handleDeleteButton() {
    sendData({ action: 'delete', id: form.id });
  }


  // Save is blocked on empty email or an incomplete/mismatched password
  const passwordsMatch = form.password === form.confirmPassword;

  const disableSave =
    (changePassword && (!passwordsMatch || form.password === '' || form.confirmPassword === '')) ||
    (form.email.trim() === '');


  return (
    <UniversalModal
      open={true}   // always open — the parent mounts/unmounts this component instead
      onClose={() => setOpen(false)}
      title={isEditing ? 'Redaguoti Administratorių' : 'Naujas Administratorius'}
      maxWidth={500}
      fullWidth
      showCancel={false}    // stock modal buttons replaced
      showConfirm={false}   // by the custom ActionButtons footer
      actions={
        <ActionButtons
          isEditing={isEditing}
          disableSave={disableSave}
          onSave={handleSaveButton}
          onDelete={handleDeleteButton}
        />
      }
    >
      <Stack spacing={3}>

        <AccountFields form={form} onChange={updateField} />

        <PasswordSection
          form={form}
          onChange={updateField}
          isEditing={isEditing}
          changePassword={changePassword}
          onShowPasswordFields={() => setChangePassword(true)}
          passwordsMatch={passwordsMatch}
        />

      </Stack>
    </UniversalModal>
  );
}
