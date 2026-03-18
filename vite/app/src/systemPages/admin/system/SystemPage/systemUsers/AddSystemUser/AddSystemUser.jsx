import * as React from 'react';
import { Button, Dialog, DialogContent, Stack, Typography, FormControl, FormLabel, TextField } from '@mui/material';
import Add from '@mui/icons-material/Add';


export default function AddSystemUser({ userLineData, setOpen }) {

  return (      
    <Dialog open={true} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 3 }}>
        <div style={{width: '90%'}}>

          <Typography component="h2" variant="h6" sx={{ mb: '30px' }}> 
            Naujo Naudotojo Įvedimas
          </Typography>

          
          <Stack spacing={2}>

            <FormControl
              required
              size="medium"
              color="primary"
            >
              <FormLabel>
                Vardas Pavardė
              </FormLabel>
              <TextField
                name="Name"
                type="text"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>



            <FormControl
              required
              size="medium"
              color="primary">
              <FormLabel>
                El. Paštas
              </FormLabel>
              <TextField
                name="Name"
                type="text"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>



            <FormControl
              required
              size="medium"
              color="primary">
              <FormLabel>
                Slaptažodis
              </FormLabel>
              <TextField
                name="Name"
                type="text"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>
            
            
            <div style={{marginTop: '50px'}}></div>
            

            <FormControl
              required
              size="medium"
              color="primary">
              <FormLabel>
                Jūsų Slaptažodis
              </FormLabel>
              <TextField
                name="Name"
                type="password"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>

            <Button 
              type="submit" 
              variant="contained"
              style={{
                backgroundColor: 'rgb(123, 0, 63)', 
                color: 'white', 
                boxShadow: '0px 8px 15px rgba(0, 0, 0, 0.1)'
              }}>
              Išsaugoti
            </Button>
          </Stack>

        </div>
      </DialogContent>
    </Dialog>
  );
}
