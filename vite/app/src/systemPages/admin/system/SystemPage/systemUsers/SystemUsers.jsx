import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";

import React, { useState } from "react";
import { LinearProgress } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ToolbarButton from '@/components/DatagridCustomComponents/ToolbarButton';
import AddSystemUser from './AddSystemUser/AddSystemUser';
import CustomPagination from '@/components/other/ButtonsPagination/ButtonsPagination';



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
      <ToolbarButton label="Pridėti Naują" onClick={() => { triggerAddNew() }} />
    </Toolbar>
  );
}




const SystemUsers = () => {

  const { data, loadingData } = useFetchData("/api/systemusers");

  const [openModal, setOpenModal] = useState(false);
  const [userLineData, setUserLineData] = useState(undefined);

  const triggerAddNew = () => {
    setUserLineData(undefined);
    setOpenModal(true);
  };

  return (
    <>
      <DataGrid
        rows={data}
        columns={SystemUsers_Columns}
        showToolbar
        pageSizeOptions={[100]}
        rowHeight={30}
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

      {openModal && (
        <AddSystemUser userLineData={userLineData} setOpen={setOpenModal} />
      )}
    </>
  );
};

export default SystemUsers;
