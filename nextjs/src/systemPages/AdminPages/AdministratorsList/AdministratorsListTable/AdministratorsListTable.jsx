'use client';
import { DataGrid, GridToolbarQuickFilter, GridLogicOperator, GridToolbarColumnsButton } from "@mui/x-data-grid";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Box, Button, LinearProgress, Paper } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';

import { IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';


import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';
import AddEditAdministrator from "./AddEditAdministrator/AddEditAdministrator";
// import AdminBackdrop from "../AdminBackdrop";
import { useTheme } from '@mui/material';







function QuickSearchToolbar({ triggerAddNew }) {
  const theme = useTheme();

  const handleSwitchChange = (event) => {
    if (event.target.checked)
      passState(1);
    else
      passState(0);
  }

  return (
    <>
      <Box
        sx={{
          p: 0.5,
          pb: 0,
        }}

      >
        <GridToolbarQuickFilter // style={{}}
          quickFilterParser={(searchInput) =>
            searchInput
              .split(',')
              .map((value) => value.trim())
              .filter((value) => value !== '')
          }
          placeholder="Ieškoti..."
        />
        <GridToolbarColumnsButton
          sx={{
            marginLeft: '10px',
            paddingLeft: '15px',
            paddingRight: '10px',
            color: 'white',
            backgroundColor: 'rgb(123, 0, 63)',
            "&:hover": {
              backgroundColor: 'rgb(230, 65, 100)',
            },
          }}
        />

        <Button 
          variant="contained"
          sx={{
            marginLeft: '10px',
            paddingLeft: '15px',
            paddingRight: '10px',
            height: 30,
            backgroundColor: 'rgb(123, 0, 63)',
            "&:hover": {
              backgroundColor: 'rgb(230, 65, 100)',
            },
          }}
          onClick={() => { triggerAddNew() }}
          >
            <AddCircleOutlinedIcon style={{paddingRight: 8, fontSize: '22px'}}/>
            Įterpti Naują
        </Button>
        
      </Box>
    </>
  );
}



const AdministratorsTable = () => {
  const [loadingData, setLoadingData] = useState(true);
  const [data, setData] = useState([]);
  const [openBackdrop, setOpenBackdrop] = useState(false);


  const AdministratorsTable_Columns = [
    {
      field: "id",
      headerName: "ID",
      width: 70
    },
    {
      field: "email",
      headerName: "El. Paštas",
      width: 350,
    },
    {
      field: "enabled",
      headerName: "Įjungtas?",
      width: 90,

      renderCell: (params) => {
        function selectColor(statusID){
          if(statusID === 0){        // Turned OFF
            return 'grey';
          }
          else if(statusID === 1){   // Turned ON
            return 'green';
          }
        }
  
        function selectText(statusID){
          if(statusID === 0){        // Turned OFF
            return 'Išjungtas';
          }
          else if(statusID === 1){   // Turned ON
            return 'Įjungtas';
          }
        }
  

        return (
          <div style={{backgroundColor: selectColor(params.row.enabled), padding: 5, borderRadius: 9, width: 80, textAlign: 'center'}}>
            {selectText(params.row.enabled)}
          </div>
        );
      },
    },
    {
      field: "lastseen",
      headerName: "Paskutinįkart Pastebėtas",
      width: 220,
    },
  ];







  async function getData() {
    try {
      const response = await axios.get("/api/admin/administrators", { withCredentials: true });
      setData(response.data);
      setLoadingData(false);
    } catch (error) {
      if (error.response.status === 401) {
        window.location.href = '/login';
      }
    }
  }



  useEffect(() => {
    getData();
  }, [openBackdrop]);




  // Edit or Add line
  const [userLineData, setUserLineData] = React.useState();

  const handleRowClick = (params) => {
    let modifiedParams = { ...params };
    setUserLineData(modifiedParams);
    setOpenBackdrop(true);
  };

  const triggerAddNew = () => {
    setUserLineData(undefined);
    setOpenBackdrop(true);
  }



  return (
    <Paper sx={{ height: 'calc(100vh - 105px)', width: '100%', paddingRight: 4, borderRadius: 0 }}>
      <Box
        sx={{
          fontSize: '24px',
          color: 'gray',
          alignItems: 'center',
          justifyContent: 'space-between',
          display: 'inline-block!important',
          margin: 2,
          width: '100%', 
        }}
      >
        Administratorių Sąrašas
        <DataGrid
          sx={{
            height: 'calc(100vh - 160px)',
            cursor:'pointer',
            width: '100%',
            display: 'flex',
            padding: 0,
          }}
          rows={data}
          columns={AdministratorsTable_Columns}
          pageSize={100}
          rowsPerPageOptions={[100]}
          rowHeight={30}
          onRowClick={handleRowClick}

          localeText={{
            toolbarColumns: "STULPELIAI",
            toolbarExport: "EXPORTUOTI"
          }}

          initialState={{
            columns: {
              columnVisibilityModel: {
              },
            },
          }}

          components={{
            Toolbar: QuickSearchToolbar,
            LoadingOverlay: LinearProgress,
            Pagination: CustomPagination,
          }}

          loading={loadingData}

          componentsProps={{
            toolbar: {
              triggerAddNew: triggerAddNew
            }
          }}
        />
      </Box>
      {openBackdrop? 
        <AddEditAdministrator 
          rowData={userLineData}
          setOpen={setOpenBackdrop} 
          getData={getData}
        /> 
      :
        <></> 
      }
    </Paper>
  );
};

export default AdministratorsTable;
