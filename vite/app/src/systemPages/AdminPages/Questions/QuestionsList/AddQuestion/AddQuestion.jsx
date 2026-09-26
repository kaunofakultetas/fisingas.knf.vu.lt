// -----------------------------------------------------------
//  [*] Admin — AddQuestion modal
//
//  The "new question" dialog. A question is created by
//  uploading the email screenshot: drag & drop (or click to
//  pick) an image, preview it, and POST it to
//  /api/phishingpictures — the backend creates the question
//  around the picture. On success the dialog closes and
//  `getData` refreshes the question list; the admin then
//  fills in the text/options via the inline editor. A refused
//  upload says why, in Lithuanian; an expired session goes to
//  /login.
//
//  Split into (main component last):
//
//    UPLOAD_REFUSALS — the backend's refusal reasons in
//                      Lithuanian (refusalText)
//    UploadButton    — modal footer: the upload button
//    ImageDropzone   — drag & drop area with the preview
//    AddQuestion     — state + the upload call (default export)
//
//  Used by:
//    - QuestionsList.jsx — the "Sukurti Naują Klausimą" button
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";
import toast from 'react-hot-toast';
import { useDropzone, ErrorCode } from 'react-dropzone';

import { Button, Typography } from "@mui/material";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { UniversalModal } from "@/components/Other/UniversalModal";
import { redirectOnExpiredSession } from "@/utils/session";


// The upload's refusal reasons (upload_picture in the
// backend's pictures_views.py) as the admin reads them
const UPLOAD_REFUSALS = new Map([
  ["Not Admin", "Neturite administratoriaus teisių"],
  ["No file part in the request", "Užklausoje nėra paveikslėlio"],
  ["File type not allowed", "Netinkamas failo tipas — tinka PNG, JPG arba GIF"],
  ["Empty file", "Failas tuščias"],
  ["File is too large", "Failas per didelis — daugiausia 5 MB"],
  ["File is not an image", "Failas nėra PNG, JPG ar GIF paveikslėlis"],
]);

// A reason the map does not know yet is shown as it comes —
// better English than no reason at all
const refusalText = (reason) => UPLOAD_REFUSALS.get(reason) ?? reason;







// -----------------------------------------------------------
// UploadButton
// -----------------------------------------------------------
//
// Modal footer: the full-width "Įkelti Paveikslėlį" button.
// Disabled until an image has been picked.
//
// Used by:
//   - AddQuestion (below) — the modal's `actions` slot
// -----------------------------------------------------------

function UploadButton({ disabled, onUpload }) {
  return (
    <Button
      variant="contained"
      color="primary"
      fullWidth
      sx={{ fontSize: '1rem', padding: '10px 0' }}
      onClick={onUpload}
      disabled={disabled}
    >
      <CloudUploadIcon sx={{ mr: 1 }} />
      Įkelti Paveikslėlį
    </Button>
  );
}







// -----------------------------------------------------------
// ImageDropzone
// -----------------------------------------------------------
//
// The drag & drop area: highlights while a file hovers over
// it, and once an image is picked shows its preview instead
// of the prompt text. A refused file is toasted: several at
// once → one image at a time, a wrong type or size → what
// the server takes.
//
// Used by:
//   - AddQuestion (below)
// -----------------------------------------------------------

function ImageDropzone({ imagePreviewUrl, onFileSelected }) {

  // accept must be the object form — react-dropzone 14+ silently
  // ignores a plain string, which turned the filter off entirely.
  // Mirrors the server whitelist and its 5 MB cap, so a wrong file
  // is refused before a byte leaves the browser
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        onFileSelected(acceptedFiles[0]);
      }
    },

    // A drag can carry several files (the file dialog lets only
    // one be picked) — react-dropzone then refuses them all as
    // "too-many-files", even when each would be taken on its own
    onDropRejected: (fileRejections) => {
      const tooManyFiles = fileRejections.some(({ errors }) => errors.some(({ code }) => code === ErrorCode.TooManyFiles));
      if (tooManyFiles) {
        toast.error(<b>Vienu metu galima įkelti tik vieną paveikslėlį</b>, { duration: 5000 });
        return;
      }

      toast.error(<b>Tinka tik PNG, JPG arba GIF paveikslėlis iki 5 MB</b>, { duration: 5000 });
    },

    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });


  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed border-[#cccccc] rounded-[10px] p-5 text-center cursor-pointer relative ${isDragActive ? 'bg-[#f0f0f0]' : 'bg-[#fafafa]'}`}
    >
      <input {...getInputProps()} />
      {imagePreviewUrl ? (
        <img src={imagePreviewUrl} alt="Pasirinktas paveikslėlis" className="max-w-full max-h-[300px] mx-auto" />
      ) : (
        <div>
          <CloudUploadIcon className="text-[50px] text-[#cccccc]" />
          <Typography variant="body1" className="mt-2.5">
            Vilkite paveikslėlį čia arba spustelėkite norėdami pasirinkti
          </Typography>
        </div>
      )}
    </div>
  );
}







// -----------------------------------------------------------
// AddQuestion (default export)
// -----------------------------------------------------------
//
// Holds the picked file + preview state and the upload call;
// the visual pieces above are purely presentational.
//
// Used by:
//   - QuestionsList.jsx — the "Sukurti Naują Klausimą" button
// -----------------------------------------------------------

export default function AddQuestion({ setOpen, getData }) {

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);


  // Preview the picked image before uploading
  useEffect(() => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setImagePreviewUrl(null);
    }
  }, [selectedFile]);


  // POST the image; the backend creates the question around it.
  // On success refetch the question list and close. The button is
  // disabled while the request is in flight — every extra click
  // would create another question and another permanent image
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (uploading) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await axios.post("/api/phishingpictures", formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.type === 'ok') {
        toast.success(<b>Paveikslėlis sėkmingai įkeltas</b>, { duration: 3000 });
        getData();
        setOpen(false);
      } else if (response.data.type === 'error') {
        toast.error(<b>Nepavyko įkelti:<br/>{refusalText(response.data.reason)}</b>, { duration: 8000 });
      } else {
        toast.error(<b>Nepavyko įkelti:<br/>Neaiškus atsakymas.</b>, { duration: 8000 });
      }
    } catch (error) {
      if (redirectOnExpiredSession(error)) return;

      // A refused upload (wrong type, empty, too large, not an
      // image; 403 for a non-admin) carries the same {type:
      // "error", reason} as above — the reason tells what to fix
      const reason = error.response?.data?.reason;
      toast.error(<b>Nepavyko įkelti:<br/>{reason ? refusalText(reason) : "Serverio klaida."}</b>, { duration: 8000 });
    } finally {
      setUploading(false);
    }
  }


  return (
    <UniversalModal
      open={true}   // always open — the parent mounts/unmounts this component instead
      onClose={() => setOpen(false)}
      title="Įkelti Paveikslėlį"
      maxWidth={500}
      fullWidth
      showCancel={false}    // stock modal buttons replaced
      showConfirm={false}   // by the custom UploadButton footer
      actions={
        <UploadButton
          disabled={selectedFile === null || uploading}
          onUpload={handleUpload}
        />
      }
    >
      <ImageDropzone
        imagePreviewUrl={imagePreviewUrl}
        onFileSelected={setSelectedFile}
      />
    </UniversalModal>
  );
}
