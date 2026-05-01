
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, LinearProgress } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';


const StudentGroups_Columns = [
  { 
    field: "id", 
    headerName: "ID", 
    width: 80 
  },
  {
    field: "name",
    headerName: "Pavadinimas",
    width: 250,
  },
  {
    field: "description",
    headerName: "Aprašymas",
    width: 400,
  },
  {
    field: "showanswers",
    headerName: "Rodyti Atsakymus",
    width: 150,
  },
  {
    field: "timelimit",
    headerName: "Laiko Limitas",
    width: 100,
  }
];




function QuickSearchToolbar() {
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
    </Toolbar>
  );
}



const StudentGroupsTable = () => {
  const navigate = useNavigate();
  const { data, loadingData } = useFetchData("/api/admin/studentgroups");


  const handleRowClick = (params) => {
    navigate("/admin/students/" + params['id']);
  };


  const [filterValue, setFilterValue] = React.useState(0);
  const rows = (data || []).filter(
    function(row) {
      
      if(row['istimetable'] !== 1 && filterValue === 1)
        return false;

      return true;
     
    }
  );



  return (
    <Box className="h-[calc(100vh-165px)] p-2.5 pb-[50px] w-full">
      <Box className="text-2xl text-gray-500 mb-2.5 flex items-center justify-between">
        Studentų Grupių Sąrašas
      </Box>
      <DataGrid
        sx={{
          cursor: 'pointer',
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(123, 0, 63, 0.08)',
          },
        }}
        rows={rows}
        columns={StudentGroups_Columns}
        pageSizeOptions={[100]}
        rowHeight={30}
        showToolbar
        onRowClick={handleRowClick}
        loading={loadingData}

        initialState={{
          columns: {
            columnVisibilityModel: {
              lastseen: false,
              points: false,
              percentage: false,
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

export default StudentGroupsTable;
