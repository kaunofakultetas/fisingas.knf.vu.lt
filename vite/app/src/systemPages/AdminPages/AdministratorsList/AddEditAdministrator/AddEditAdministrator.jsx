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
//  Only the backend's {type: 'ok'} counts as done: then the
//  success is toasted ("Išsaugota" / "Įrašas ištrintas"), the
//  grid refetches (getData) and the dialog closes. A refusal
//  toasts the backend's reason in Lithuanian — a 200
//  {type: 'error'} and a 400 alike. A lost session leaves the
//  page: a 401 for /login, the role gate "Error: Not Admin"
//  (HTTP 200, a session that is not an admin's) for "/".
//
//  While a POST is on its way the footer's buttons are
//  disabled, so a double click cannot send it twice.
//
//  Split into (main component last):
//
//    REFUSAL_REASONS        — the backend's reasons in Lithuanian
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
import { redirectOnExpiredSession, redirectOnRoleGate } from "@/utils/session";

import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import DeleteIcon from '@mui/icons-material/Delete';







// -----------------------------------------------------------
// REFUSAL_REASONS
// -----------------------------------------------------------
//
// The backend's refusal reasons (administrators_views.py —
// English, as the API speaks) in the UI's language. The first
// five come from its shape checks (HTTP 400), the rest are the
// form rules and the self-lockout guard (HTTP 200). A reason
// missing here is shown as it came. A Map, not an object: a
// reason can never hit a prototype key ("constructor").
//
// Used by:
//   - AddEditAdministrator (below) — sendData's refusal toasts,
//     through refusalText
// -----------------------------------------------------------

const REFUSAL_REASONS = new Map([
  ["Invalid request body",                         "Netinkamas užklausos turinys"],
  ["Invalid email",                                "Netinkamas el. pašto adresas (daugiausia 255 simboliai)"],
  ["Invalid password",                             "Netinkamas slaptažodis"],
  ["Invalid id",                                   "Netinkamas administratoriaus ID"],
  ["Invalid enabled flag",                         "Netinkama „Įjungtas?“ reikšmė"],
  ["Email address must contain @",                 "El. pašto adrese turi būti simbolis @"],
  ["Password must be at least 8 characters long",  "Slaptažodis turi būti bent 8 simbolių ilgio"],
  ["Password must be at most 72 bytes long",       "Slaptažodis per ilgas: daugiausia 72 baitai (lietuviška raidė užima 2)"],
  ["Administrator with this email already exists", "Administratorius su tokiu el. pašto adresu jau yra"],
  ["You cannot disable your own account",          "Negalite išjungti savo paskyros"],
  ["You cannot delete your own account",           "Negalite ištrinti savo paskyros"],
]);

// A known reason in Lithuanian, an unknown one as it came
const refusalText = (reason) => REFUSAL_REASONS.get(reason) ?? reason;







// -----------------------------------------------------------
// ActionButtons
// -----------------------------------------------------------
//
// Modal footer: the Save (edit) / Create button, and — in
// edit mode only — the hold-to-confirm Delete button. Both
// are disabled while `saving` (a POST on its way). The delete
// announces nothing itself: its success is toasted by the
// parent once the backend has answered.
//
// Used by:
//   - AddEditAdministrator (below) — the modal's `actions` slot
// -----------------------------------------------------------

function ActionButtons({ isEditing, disableSave, saving, onSave, onDelete }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="contained"
        fullWidth
        sx={{ flex: 1, backgroundColor: 'primary.main', '&:hover': { backgroundColor: 'primary.dark' } }}
        onClick={onSave}
        disabled={disableSave || saving}
      >
        {isEditing ? (
          <><SaveIcon sx={{ mr: 1 }} />Išsaugoti</>
        ) : (
          <><AddCircleOutlinedIcon sx={{ mr: 1 }} />Įterpti</>
        )}
      </Button>

      {isEditing && (
        <LongPressDeleteButton
          duration={1500}
          fullWidth
          sx={{ flex: 1 }}
          disabled={saving}
          onComplete={onDelete}
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

  // A POST on its way — the footer's buttons are disabled
  // meanwhile: a second click would create the administrator
  // (or repeat the update / delete) twice
  const [saving, setSaving] = useState(false);

  // Curried: updateField('email') returns the onChange handler for that field
  const updateField = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));


  // POST to the administrators endpoint; on {type: 'ok'} toast
  // `successMessage`, refetch the grid and close. withCredentials
  // sends the session cookie (admin-only endpoint).
  async function sendData(postData, successMessage) {
    if (saving) return;
    setSaving(true);

    try {
      const response = await axios.post("/api/admin/administrators", postData, { withCredentials: true });
      if (redirectOnRoleGate(response.data)) return;

      if (response.data.type === 'ok') {
        toast.success(<b>{successMessage}</b>, { duration: 3000 });
        getData();
        setOpen(false);
      } else if (response.data.type === 'error') {
        toast.error(<b>Nepavyko:<br/>{refusalText(response.data.reason)}</b>, { duration: 8000 });
      } else {
        toast.error(<b>Nepavyko:<br/>Neaiškus atsakymas.</b>, { duration: 8000 });
      }
    } catch (error) {
      if (redirectOnExpiredSession(error)) return;

      // A field the backend's shape checks reject (e.g. an email
      // over 255 characters) is refused with HTTP 400 and
      // {type: 'error', reason} — the reason says what to fix
      const reason = error.response?.data?.reason;
      toast.error(<b>Nepavyko:<br/>{reason ? refusalText(reason) : 'Serverio klaida.'}</b>, { duration: 8000 });
    } finally {
      setSaving(false);
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
    }, 'Išsaugota');
  }

  function handleDeleteButton() {
    sendData({ action: 'delete', id: form.id }, 'Įrašas ištrintas');
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
          saving={saving}
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
