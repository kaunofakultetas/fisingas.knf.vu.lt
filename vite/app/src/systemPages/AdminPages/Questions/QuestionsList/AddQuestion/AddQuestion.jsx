// -----------------------------------------------------------
//  [*] Admin — AddQuestion
//
//  The "new question" dialog. A question is created by
//  uploading the email screenshot: drag & drop (or click to
//  pick) an image, preview it, and POST it to
//  /api/phishingpictures — the backend creates the question
//  around the picture. On success the dialog closes and
//  `getData` refreshes the question list; the admin then
//  fills in the text/options via the inline editor.
//
//  Used by:
//    - QuestionsList.jsx — the "Sukurti Naują Klausimą" button
// -----------------------------------------------------------

import { useState, useEffect } from "react";
import axios from "axios";
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

import { Button, Dialog, DialogContent, Stack, Typography, Box, FormControl, Grid } from "@mui/material";
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';


export default function AddQuestion({ setOpen, getData }) {

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    accept: 'image/*',
    multiple: false,
  });


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


  async function handleUpload() {
    if (!selectedFile) {
      toast.error("Prašome pasirinkti paveikslėlį įkėlimui.", { duration: 3000 });
      return;
    }

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
        toast.success("Paveikslėlis sėkmingai įkeltas.", { duration: 3000 });
        getData();
        setOpen(false);
      } else if (response.data.type === 'error') {
        toast.error(`Nepavyko įkelti: ${response.data.reason}`, { duration: 8000 });
      } else {
        toast.error("Nepavyko įkelti: Neaiškus serverio atsakymas.", { duration: 8000 });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Įvyko klaida įkeliant paveikslėlį.", { duration: 8000 });
    }
  }


  return (
    <Dialog open={true} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 3 }}>

        {/* Title + close button */}
        <Box style={{ marginBottom: 20 }}>
          <Grid container direction="row">
            <Grid size={10} sx={{ textAlign: "left" }}>
              <Typography component="h2" variant="h6" sx={{ mb: '30px' }}>
                Įkelti Paveikslėlį
              </Typography>
            </Grid>

            <Grid size={2} sx={{ textAlign: "right" }}>
              <Button onClick={() => setOpen(false)} style={{ padding: 0, borderRadius: '50%', backgroundColor: 'transparent', outline: 'transparent' }}>
                <CancelIcon style={{ color: 'red' }} />
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Stack spacing={3}>

          {/* Drop zone / preview */}
          <FormControl size="medium" color="primary">
            <div
              {...getRootProps()}
              style={{
                border: '2px dashed #cccccc',
                borderRadius: '10px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                backgroundColor: isDragActive ? '#f0f0f0' : '#fafafa',
              }}
            >
              <input {...getInputProps()} />
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Selected" style={{ maxWidth: '100%', maxHeight: 300 }} />
              ) : (
                <div>
                  <CloudUploadIcon style={{ fontSize: 50, color: '#cccccc' }} />
                  <Typography variant="body1" style={{ marginTop: 10 }}>
                    Vilkite paveikslėlį čia arba spustelėkite norėdami pasirinkti
                  </Typography>
                </div>
              )}
            </div>
          </FormControl>

          {/* Upload button */}
          <Box>
            <Grid container spacing={1} sx={{ textAlign: "center" }} direction="row">
              <Grid size={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ fontSize: '1rem', padding: '10px 0' }}
                  onClick={handleUpload}
                >
                  Įkelti Paveikslėlį
                </Button>
              </Grid>
            </Grid>
          </Box>

        </Stack>

      </DialogContent>
    </Dialog>
  );
}
