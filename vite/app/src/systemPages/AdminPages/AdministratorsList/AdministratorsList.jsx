// -----------------------------------------------------------
//  [*] Admin — AdministratorsList
//
//  The administrators DataGrid (/admin/administrators), from
//  GET /api/admin/administrators. Clicking a row opens the
//  AddEditAdministrator dialog with that admin's data; the
//  toolbar's "Įterpti Naują" opens the same dialog empty.
//
//  Split into (root component last):
//
//    QuickSearchToolbar — search + columns + add-new button
//    AdministratorsList — the page itself (default export)
// -----------------------------------------------------------

import { useState } from "react";
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import { Box, LinearProgress } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import AddEditAdministrator from "./AddEditAdministrator/AddEditAdministrator";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ToolbarButton from '@/components/DatagridCustomComponents/ToolbarButton';
import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';


const ADMINISTRATOR_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 70,
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







// -----------------------------------------------------------
// QuickSearchToolbar
// -----------------------------------------------------------
//
// The grid's toolbar: quick-search box, column picker and
// the "Įterpti Naują" button.
//
// Used by:
//   - AdministratorsList (below)
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
      <ToolbarButton label="Įterpti Naują" icon={AddCircleOutlinedIcon} onClick={() => triggerAddNew()} />
    </Toolbar>
  );
}







// -----------------------------------------------------------
// AdministratorsList (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /admin/administrators
// -----------------------------------------------------------

export default function AdministratorsList() {

  const { data, loadingData, refetch: getData } = useFetchData("/api/admin/administrators");

  // The dialog: open/closed + the clicked row (undefined = new admin)
  const [openBackdrop, setOpenBackdrop] = useState(false);
  const [userLineData, setUserLineData] = useState();


  const handleRowClick = (params) => {
    setUserLineData({ ...params });
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
          columns={ADMINISTRATOR_COLUMNS}
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
            pagination: ButtonsPagination,
          }}

          slotProps={{
            panel: { placement: 'bottom-start' },
            toolbar: {
              triggerAddNew: triggerAddNew,
            },
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
}
