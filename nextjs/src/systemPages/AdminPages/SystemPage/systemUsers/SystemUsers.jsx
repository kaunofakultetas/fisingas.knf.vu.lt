import { DataGrid, GridToolbarQuickFilter, GridLogicOperator, GridToolbarColumnsButton } from "@mui/x-data-grid";
import styles from './SystemUsers.module.scss';

import React, { useState, useEffect } from "react";
import axios from "axios";



import AddSystemUser from './AddSystemUser/AddSystemUser';
import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';



// Tabs
import { Box, Tab, Tabs, Paper, LinearProgress } from '@mui/material';



const SystemUsers_Columns = [
  {
    field: "id",
    headerName: "ID",
    width: 40
  },
  { 
    field: "namesurname", 
    headerName: "Vardas Pavardė", 
    width: 240 
  },
  {
    field: "email",
    headerName: "Email",
    width: 300,
  },
  {
    field: "lastlogin",
    headerName: "Paskutinįkart Prisijungė",
    width: 220
  },
  {
    field: "lastusage",
    headerName: "Paskutinįkart Naudojosi",
    width: 220
  }
];



function QuickSearchToolbar({}) {

  // Single User Selection
  const [open, setOpen] = React.useState(false);
  const [userLineData, setUserLineData] = React.useState();


  const openAddSystemUser = (params) => {
    setUserLineData(params);
    // console.log(params);
    setOpen(true);
  };



  return (
    <Box sx={{p: 0, pb: 0 }} >
      <Box
        sx={{
          paddingLeft: '15px',
          pb: 0,
        }}
      >


        <GridToolbarQuickFilter style={{}}
          quickFilterParser={(searchInput) =>
            searchInput
              .split(',')
              .map((value) => value.trim())
              .filter((value) => value !== '')
          }
          sx={{
            '& .MuiInput-root:after': {
              borderBottom: '2px solid #E64164'
            },
          }}
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

        <div className={styles.link} onClick={openAddSystemUser}>
          Pridėti Naują
        </div>

        {open? <AddSystemUser userLineData={userLineData} setOpen={setOpen}/>:<></>}

      </Box>
    </Box>
  );
}






const SystemUsers = () => {

  const [data, setData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get("/api/systemusers", { withCredentials: true });
        setData(response.data);
        setLoadingData(false);
      } catch (error) {
        if (error.response.status === 401) {
          window.location.href = '/login';
        }
      }
    }
    if (loadingData) {
      getData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  

  return (
    <DataGrid
      rows={data}
      columns={SystemUsers_Columns}
      pageSize={100}
      rowsPerPageOptions={[100]}
      rowHeight={30}
      // onRowClick={handleRowClick}

      initialState={{
        columns: {
          columnVisibilityModel: {
          },
        },
        filter: {
          filterModel: {
            items: [],
            quickFilterLogicOperator: GridLogicOperator.Or,
          },
        },
      }}

      localeText={{
        toolbarColumns: "STULPELIAI",
        toolbarExport: "EXPORTUOTI"
      }}

      loading={loadingData}
      components={{ 
        Toolbar: QuickSearchToolbar,
        LoadingOverlay: LinearProgress,
        Pagination: CustomPagination,
      }}
      componentsProps={{ 
        toolbar: {} 
      }}
    />
  );
};

export default SystemUsers;
