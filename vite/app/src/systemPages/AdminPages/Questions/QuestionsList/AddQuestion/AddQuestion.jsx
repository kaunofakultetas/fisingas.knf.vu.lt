// -----------------------------------------------------------
//  [*] Admin — AddQuestion modal
//
//  The "new question" dialog. A question is created by
//  uploading the email screenshot: drag & drop (or click to
//  pick) an image, preview it, and POST it to
//  /api/phishingpictures — the backend creates the question
//  around the picture. On success the dialog closes and
//  `getData` refreshes the question list; the admin then
//  fills in the text/options via the inline editor.
//
//  Split into (main component last):
//
//    UploadButton  — modal footer: the upload button
//    ImageDropzone — drag & drop area with the preview
//    AddQuestion   — state + the upload call (default export)
//
//  Used by:
//    - QuestionsList.jsx — the "Sukurti Naują Klausimą" button
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

import { Button, Typography } from "@mui/material";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { UniversalModal } from "@/components/Other/UniversalModal";







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
// of the prompt text.
//
// Used by:
//   - AddQuestion (below)
// -----------------------------------------------------------

function ImageDropzone({ imagePreviewUrl, onFileSelected }) {

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        onFileSelected(acceptedFiles[0]);
      }
    },
    accept: 'image/*',
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
  // On success refetch the question list and close.
  async function handleUpload() {
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
        toast.error(<b>Nepavyko įkelti:<br/>{response.data.reason}</b>, { duration: 8000 });
      } else {
        toast.error(<b>Nepavyko įkelti:<br/>Neaiškus atsakymas.</b>, { duration: 8000 });
      }
    } catch (error) {
      toast.error(<b>Nepavyko įkelti:<br/>Serverio klaida.</b>, { duration: 8000 });
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
          disabled={selectedFile === null}
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
