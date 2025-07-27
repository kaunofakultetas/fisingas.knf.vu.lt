import * as React from 'react';
import Button from '@mui/joy/Button';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import Stack from '@mui/joy/Stack';
import Add from '@mui/icons-material/Add';
import Typography from '@mui/joy/Typography';

import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';


export default function AddSystemUser({ userLineData, setOpen }) {

  return (      
    <Modal open={true} onClose={() => setOpen(false)}>
      <ModalDialog aria-labelledby="" aria-describedby="" sx={{ width: '400px', borderRadius: 'md', p: 3, boxShadow: 'lg', backgroundColor: 'white' }}>
        <div style={{width: '90%'}}>

          <Typography id="basic-modal-dialog-title" component="h2" level="inherit" fontSize="1.25em" mb="0.25em" style={{marginBottom: '30px'}}> 
            Naujo Naudotojo Įvedimas
          </Typography>

          
          <Stack spacing={2}>

            <FormControl
              id="NewUserName"
              required
              size="lg"
              color="primary"
            >
              <FormLabel>
                Vardas Pavardė
              </FormLabel>
              <Input
                // placeholder="Placeholder"
                name="Name"
                type="text"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>



            <FormControl
              id="NewUserEmail"
              required
              size="lg"
              color="primary">
              <FormLabel>
                El. Paštas
              </FormLabel>
              <Input
                // placeholder="Placeholder"
                name="Name"
                type="text"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>



            <FormControl
              id="NewUserPassword"
              required
              size="lg"
              color="primary">
              <FormLabel>
                Slaptažodis
              </FormLabel>
              <Input
                // placeholder="Placeholder"
                name="Name"
                type="text"
                autoFocus
                error
                fullWidth
                variant="outlined" />
            </FormControl>
            
            
            <div style={{marginTop: '50px'}}></div>
            

            <FormControl
              id="OldUserPassword"
              required
              size="lg"
              color="primary">
              <FormLabel>
                Jūsų Slaptažodis
              </FormLabel>
              <Input
                // placeholder="Placeholder"
                name="Name"
                type="password"
                // autoComplete="on"
                autoFocus
                error
                fullWidth
                // defaultValue="DefaultValue"
                variant="outlined" />
              {/* <FormHelperText>
                Test
              </FormHelperText> */}
            </FormControl>

            <Button 
              type="submit" 
              style={{
                backgroundColor: 'rgb(123, 0, 63)', 
                color: 'white', 
                boxShadow: '0px 8px 15px rgba(0, 0, 0, 0.1)'
              }}>
              Išsaugoti
            </Button>
          </Stack>

        </div>
      </ModalDialog>
    </Modal>
  );
}