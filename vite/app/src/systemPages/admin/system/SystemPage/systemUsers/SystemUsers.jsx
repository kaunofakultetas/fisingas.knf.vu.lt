import { DataGrid, GridToolbarQuickFilter, GridLogicOperator, GridToolbarColumnsButton } from "@mui/x-data-grid";

import React from "react";
import useFetchData from "@/hooks/useFetchData";



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

        <div
          className="no-underline text-green-600 text-base font-normal border border-green-600 py-1 px-1 mt-1.5 rounded-[5px] cursor-pointer ml-5 w-max inline-flex"
          onClick={openAddSystemUser}
        >
          Pridėti Naują
        </div>

        {open? <AddSystemUser userLineData={userLineData} setOpen={setOpen}/>:<></>}

      </Box>
    </Box>
  );
}






const SystemUsers = () => {

  const { data, loadingData } = useFetchData("/api/systemusers");



  

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
      slots={{
        toolbar: QuickSearchToolbar,
        loadingOverlay: LinearProgress,
        pagination: CustomPagination,
      }}
      slotProps={{
        toolbar: {}
      }}
    />
  );
};

export default SystemUsers;
