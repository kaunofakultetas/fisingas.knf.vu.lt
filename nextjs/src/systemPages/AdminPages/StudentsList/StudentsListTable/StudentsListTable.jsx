'use client';
import styles from "./StudentsListTable.module.css";
import { DataGrid, GridToolbarQuickFilter, GridLogicOperator, GridToolbarColumnsButton } from "@mui/x-data-grid";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Box, LinearProgress, FormGroup, FormControlLabel } from '@mui/material';

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
          <div className={styles.cellStatus} style={{backgroundColor: 'green'}}>BAIGTA</div>
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
  const [loadingData, setLoadingData] = useState(true);
  const [data, setData] = useState([]);
  


  const REFRESH_TIME = 5;
  let updateTimer;
  const [nextUpdate, setNextUpdate] = useState(0);
  const updateCount = (getData) => {
    updateTimer = !updateTimer && setInterval(() => {
      setNextUpdate(prevTime => prevTime - 1);
    }, 1000)
    
    if (nextUpdate === 0) {
      // console.log('Again');
      getData();
      setNextUpdate(REFRESH_TIME);
    }
  }



  useEffect(() => {
    async function getData() {
      try {
        const response = await axios.get(process.env.NEXT_PUBLIC_API_URL_OUTSIDE+"/admin/students");
        setData(response.data);
        setLoadingData(false);
      } catch (error) {
        if (error.response.status === 401) {
          window.location.href = '/login';
        }
      }
    }
    updateCount(getData);
    return () => clearInterval(updateTimer);
  }, [nextUpdate]); // eslint-disable-line react-hooks/exhaustive-deps


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
    <Box className={styles.datatable}>
      <Box className={styles.datatableTitle}>
        Studentų Sąrašas
      </Box>
      <DataGrid
        className={styles.datagrid}
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

export default StudentsListTable;
