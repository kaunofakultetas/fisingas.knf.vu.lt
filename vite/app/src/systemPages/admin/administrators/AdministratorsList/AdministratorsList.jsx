
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import React, { useState } from "react";
import { Box, LinearProgress, Paper } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ToolbarButton from '@/components/DatagridCustomComponents/ToolbarButton';
import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';
import AddEditAdministrator from "./AddEditAdministrator/AddEditAdministrator";




function QuickSearchToolbar({ triggerAddNew }) {
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
      <ToolbarButton label="Įterpti Naują" icon={AddCircleOutlinedIcon} onClick={() => { triggerAddNew() }} />
    </Toolbar>
  );
}



const AdministratorsList = () => {
  const { data, loadingData, refetch: getData } = useFetchData("/api/admin/administrators");
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
      width: 110,

      renderCell: (params) => {
        const isEnabled = params.row.enabled === 1;
        return (
          <div 
            className="px-1 mr-1 rounded w-fit"
            style={{
              backgroundColor: isEnabled ? 'green' : 'grey',
            }}
          >
            {isEnabled ? 'Įjungtas' : 'Išjungtas'}
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
    <AdminPageLayout backgroundColor="#EBECEF">
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
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'rgba(123, 0, 63, 0.08)',
              },
            }}
            rows={data}
            columns={AdministratorsTable_Columns}
            pageSizeOptions={[100]}
            rowHeight={30}
            showToolbar
            onRowClick={handleRowClick}
            loading={loadingData}

            initialState={{
              columns: {
                columnVisibilityModel: {},
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
                triggerAddNew: triggerAddNew
              }
            }}
          />
        </Box>
        {openBackdrop && (
          <AddEditAdministrator 
            rowData={userLineData}
            setOpen={setOpenBackdrop} 
            getData={getData}
          /> 
        )}
      </Paper>
    </AdminPageLayout>
  );
};

export default AdministratorsList;
