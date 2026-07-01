// -----------------------------------------------------------
//  [*] Admin — SystemUsers
//
//  ⚠ Unfinished stub, kept for parity with the old app —
//  see SystemPage.jsx. GET /api/systemusers does not exist
//  on the backend, so the grid never gets rows.
//
//  Split into (root component last):
//
//    QuickSearchToolbar — search + columns + add-new button
//    SystemUsers        — the grid itself (default export)
// -----------------------------------------------------------

import { useState } from "react";
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import { LinearProgress } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import AddSystemUser from './AddSystemUser/AddSystemUser';
import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ToolbarButton from '@/components/DatagridCustomComponents/ToolbarButton';
import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';


const SYSTEM_USER_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 40,
  },
  {
    field: "namesurname",
    headerName: "Vardas Pavardė",
    width: 240,
  },
  {
    field: "email",
    headerName: "Email",
    width: 300,
  },
  {
    field: "lastlogin",
    headerName: "Paskutinįkart Prisijungė",
    width: 220,
  },
  {
    field: "lastusage",
    headerName: "Paskutinįkart Naudojosi",
    width: 220,
  },
];







// -----------------------------------------------------------
// QuickSearchToolbar
// -----------------------------------------------------------
//
// The grid's toolbar: quick-search box, column picker and
// the "Pridėti Naują" button.
//
// Used by:
//   - SystemUsers (below)
// -----------------------------------------------------------

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
      <ToolbarButton label="Pridėti Naują" onClick={() => triggerAddNew()} />
    </Toolbar>
  );
}







// -----------------------------------------------------------
// SystemUsers (default export)
// -----------------------------------------------------------
//
// Used by:
//   - SystemPage.jsx
// -----------------------------------------------------------

export default function SystemUsers() {

  const { data, loadingData } = useFetchData("/api/systemusers");

  const [openModal, setOpenModal] = useState(false);


  const triggerAddNew = () => {
    setOpenModal(true);
  };


  return (
    <>
      <DataGrid
        rows={data}
        columns={SYSTEM_USER_COLUMNS}
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
          pagination: ButtonsPagination,
        }}

        slotProps={{
          panel: { placement: 'bottom-start' },
          toolbar: {
            triggerAddNew: triggerAddNew,
          },
        }}
      />

      {openModal && (
        <AddSystemUser setOpen={setOpenModal} />
      )}
    </>
  );
}
