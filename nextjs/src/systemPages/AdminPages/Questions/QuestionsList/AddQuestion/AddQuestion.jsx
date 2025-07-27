import React, { useState, useEffect } from "react";
import axios from "axios";

import { Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Box, FormControl, Grid } from "@mui/material";

import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import toast from 'react-hot-toast';

import { useDropzone } from 'react-dropzone';

export default function UploadImageComponent({ setOpen, getData }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // Handle file selection via drag and drop or click
  const onDrop = (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: 'image/*',
    multiple: false,
  });

  useEffect(() => {
    // Reset preview when the selected file changes
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

    // Create form data
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      // Send POST request to upload the image
      const response = await axios.post("/api/phishingpictures", formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.type === 'ok') {
        toast.success("Paveikslėlis sėkmingai įkeltas.", { duration: 3000 });
        getData(); // Refresh data if necessary
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
    <Modal open={true} onClose={() => setOpen(false)}>
      <ModalDialog sx={{ width: '500px', borderRadius: 'md', boxShadow: 'lg', backgroundColor: 'white' }} >
        <Box style={{ marginBottom: 20 }}>
          <Grid container direction="row">
            <Grid item xs={10} align="left">
              <Typography component="h2" fontSize="1.25em" mb="0.25em" style={{ marginBottom: '30px' }}>
                Įkelti Paveikslėlį
              </Typography>
            </Grid>

            <Grid item xs={2} align="right">
              <Button onClick={() => setOpen(false)} style={{ padding: 0, borderRadius: '50%', backgroundColor: 'transparent', outline: 'transparent' }}>
                <CancelIcon style={{ color: 'red' }} />
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Stack spacing={3}>
          <FormControl size="lg" color="primary">
            <div {...getRootProps()} style={{
              border: '2px dashed #cccccc',
              borderRadius: '10px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative',
              backgroundColor: isDragActive ? '#f0f0f0' : '#fafafa',
            }}>
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

          <Box>
            <Grid container spacing={1} align="center" direction="row">
              <Grid item xs={12}>
                <Button
                  type="submit"
                  style={{
                    backgroundColor: 'rgb(123, 0, 63)',
                    color: 'white',
                    boxShadow: '0px 8px 15px rgba(0, 0, 0, 0.1)',
                    width: '100%',
                    fontSize: '1rem',
                    padding: '10px 0',
                  }}
                  onClick={handleUpload}
                >
                  Įkelti Paveikslėlį
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Stack>

      </ModalDialog>
    </Modal>
  );
}
