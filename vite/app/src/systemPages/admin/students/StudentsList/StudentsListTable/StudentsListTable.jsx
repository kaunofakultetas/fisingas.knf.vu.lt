
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, LinearProgress, FormGroup, FormControlLabel } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
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
    width: 100,
    renderCell: (params) => {
      if(params.row.isfinished === 1){
        return (
          <div className="px-1 mr-1 rounded w-fit" style={{backgroundColor: 'green'}}>BAIGTA</div>
        );
      }
      return null;
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
    <Toolbar sx={{ justifyContent: 'flex-start' }}>
      <QuickFilter
        expanded
        parser={(searchInput) => [searchInput.trim()]}
        formatter={(quickFilterValues) => quickFilterValues.join('')}
      >
        <QuickFilterControl placeholder="Ieškoti..." size="small" />
      </QuickFilter>
      <ColumnsButton />

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
              onChange={handleSwitchChange}
            />}
          label="Per Paskutinį Mėnesį" 
        />
      </FormGroup>

    </Toolbar>
  );
}



const StudentsListTable = () => {
  const navigate = useNavigate();
  const { data, loadingData } = useFetchData("/api/admin/students", 5);


  const handleRowClick = (params) => {
    navigate("/admin/students/" + params['id']);
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
    <Box className="h-[calc(100vh-85px)] p-2.5 pb-[50px] w-full">
      <Box className="text-2xl text-gray-500 mb-2.5 flex items-center justify-between">
        Studentų Sąrašas
      </Box>
      <DataGrid
        sx={{
          cursor: 'pointer',
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(123, 0, 63, 0.08)',
          },
        }}
        rows={rows}
        columns={AD_Users_Columns}
        pageSizeOptions={[100]}
        rowHeight={30}
        showToolbar
        onRowClick={handleRowClick}
        loading={loadingData}

        initialState={{
          columns: {
            columnVisibilityModel: {
              groupname: false,
            },
          },
          filter: {
            filterModel: {
              items: [],
              quickFilterLogicOperator: GridLogicOperator.Or,
              quickFilterExcludeHiddenColumns: false,
            },
          },
          pagination: {
            paginationModel: { pageSize: 100 },
          },
        }}

        slots={{ 
          toolbar: QuickSearchToolbar,
          loadingOverlay: LinearProgress,
          pagination: CustomPagination,
        }}

        slotProps={{
          panel: { placement: 'bottom-start' },
          toolbar: { 
            passState: setFilterValue
          } 
        }}
      />
    </Box>
  );
};

export default StudentsListTable;
