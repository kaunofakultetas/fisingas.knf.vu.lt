'use client';
import styles from "./StudentGroupsTable.module.css";
import { DataGrid, GridToolbarQuickFilter, GridLogicOperator, GridToolbarColumnsButton } from "@mui/x-data-grid";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Box, LinearProgress, FormGroup, FormControlLabel } from '@mui/material';

import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';
import IOSSwitch from '@/components/other/IOSSwitch/IOSSwitch';


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

      {/* <FormGroup
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
              // defaultUnchecked={true}
              sx={{
                marginRight: '10px'
              }}
              onChange={handleSwitchChange.bind(this)}
            />}
          label="Prisijungę Per Paskutinį Mėn." 
        />
      </FormGroup> */}

    </Box>
  );
}



const StudentGroupsTable = () => {
  const [loadingData, setLoadingData] = useState(true);
  const [data, setData] = useState([]);
  

  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get(process.env.NEXT_PUBLIC_API_URL_OUTSIDE+"/admin/studentgroups");
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


  const handleRowClick = (params) => {
    //console.log(params['id']);
    window.location.href="/admin/students/" + params['id'];
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
    <Box className={styles.datatable}>
      <Box className={styles.datatableTitle}>
        Studentų Grupių Sąrašas
      </Box>
      <DataGrid
        className={styles.datagrid}
        rows={rows}
        columns={StudentGroups_Columns}
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
              lastseen: false,
              points: false,
              percentage: false,
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

        components={{ 
          Toolbar: QuickSearchToolbar,
          LoadingOverlay: LinearProgress,
          Pagination: CustomPagination,
        }}
        
        loading={loadingData}
        

        componentsProps={{
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

export default StudentGroupsTable;
