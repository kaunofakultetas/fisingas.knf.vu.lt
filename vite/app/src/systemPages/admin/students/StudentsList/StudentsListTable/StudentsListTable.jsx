
import { DataGrid, GridToolbarQuickFilter, GridLogicOperator, GridToolbarColumnsButton } from "@mui/x-data-grid";
import React, { useState } from "react";
import { Box, LinearProgress, FormGroup, FormControlLabel } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';
import IOSSwitch from '@/components/other/IOSSwitch/IOSSwitch';


const AD_Users_Columns = [
  { 
    field: "id", 
    headerName: "ID", 
    width: 80 
  },
  {
    field: "username",
    headerName: "Prisijungimo Vardas",
    width: 300,
  },
  {
    field: "groupname",
    headerName: "Grupė",
    width: 150,
  },
  {
    field: "questioncount",
    headerName: "Kl. Skaičius",
    width: 100,
  },
  {
    field: "testgrade",
    headerName: "Įvertinimas",
    width: 100,
  },
  {
    field: "isfinished",
    headerName: "Baigta?",
    width: 80,
    renderCell: (params) => {
      if(params.row.isfinished === 1){
        return (
          <div className="p-[5px] mr-[5px] rounded-[5px]" style={{backgroundColor: 'green'}}>BAIGTA</div>
        );
      }
      else {
        return (<></>);
      }
    },
  },
  {
    field: "lastseen",
    headerName: "Paskutinįkart Prisijungęs",
    width: 220,
  },
];




function QuickSearchToolbar({passState}) {

  const handleSwitchChange = (event) => {
    if(event.target.checked)
      passState(1);
    else
      passState(0);
  }

  return (
    <Box sx={{ p: 0.5, pb: 0 }}>
      <GridToolbarQuickFilter 
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

      <FormGroup
        sx={{
          marginLeft: '20px',
          display: 'inline'
        }}
      >
        <FormControlLabel
          sx={{
            margin: 'auto',
            paddingLeft: '50px',
          }}
          control={
            <IOSSwitch
              defaultChecked={true}
              sx={{
                marginRight: '10px'
              }}
              onChange={handleSwitchChange.bind(this)}
            />}
          label="Per Paskutinį Mėnesį" 
        />
      </FormGroup>

    </Box>
  );
}



const StudentsListTable = () => {
  const { data, loadingData } = useFetchData("/api/admin/students", 5);


  const handleRowClick = (params) => {
    //console.log(params['id']);
    window.location.href="/admin/students/" + params['id'];
  };


  const [filterValue, setFilterValue] = React.useState(1);
  const rows = (data || []).filter(
    function(row) {
      
      const today = new Date();
      const oneMonthAgo = new Date(today.setMonth(today.getMonth() - 1));
      const oneMonthAgoFormated = oneMonthAgo.toISOString().replace(/T/, ' ').replace(/\..+/, '');
      if(row['lastseen'] < oneMonthAgoFormated && filterValue === 1)
        return false;


      return true;
    }
  );



  return (
    <Box className="h-[calc(100vh-165px)] p-2.5 pb-[50px] w-full">
      <Box className="text-2xl text-gray-500 mb-2.5 flex items-center justify-between">
        Studentų Sąrašas
      </Box>
      <DataGrid
        rows={rows}
        columns={AD_Users_Columns}
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
              groupname: false,
            },
          },
          // sorting: {
          //   sortModel: [{ field: 'id', sort: 'desc' }],
          // },
          filter: {
            filterModel: {
              items: [],
              quickFilterLogicOperator: GridLogicOperator.Or,
            },
          },
        }}

        slots={{ 
          toolbar: QuickSearchToolbar,
          loadingOverlay: LinearProgress,
          pagination: CustomPagination,
        }}
        
        loading={loadingData}
        

        slotProps={{
          panel: {
            sx: {
              '& .MuiTypography-root': {
                color: 'dodgerblue',
                fontSize: 20,
              },
              '& .MuiDataGrid-filterForm': {
                bgcolor: 'lightblue',
              },
            },
          },
          toolbar: { 
            passState: setFilterValue
          } 
        }}
      />
    </Box>
  );
};

export default StudentsListTable;
