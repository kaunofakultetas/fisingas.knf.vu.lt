
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import React, { useState } from "react";
import { Box, LinearProgress } from '@mui/material';
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
    <AdminPageLayout>
      <Box className="h-[calc(100vh-85px)] p-2.5 pb-[50px] w-full">
        <Box className="text-2xl text-gray-500 mb-2.5 flex items-center justify-between">
          Administratorių Sąrašas
        </Box>
        <DataGrid
          sx={{
            cursor: 'pointer',
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
    </AdminPageLayout>
  );
};

export default AdministratorsList;
