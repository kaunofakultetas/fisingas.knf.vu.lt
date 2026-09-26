// -----------------------------------------------------------
//  [*] Admin — AdministratorsList
//
//  The administrators DataGrid (/admin/administrators), from
//  GET /api/admin/administrators, with a quick search, a
//  column picker and an "Įterpti Naują" button.
//
//  Clicking a row (edit) or the add button (create) opens the
//  AddEditAdministrator modal; after a successful save/delete
//  the grid refetches.
//
//  A list that failed to load shows as a failure with a retry
//  (LoadError) in place of the count and the grid — an empty
//  grid would claim there are no administrators at all. A
//  failed refetch keeps the last list on screen.
//
//  Split into (root component last):
//
//    ADMINISTRATOR_COLUMNS — column definitions
//    QuickSearchToolbar    — search + columns + add-new button
//    AdministratorsList    — the page itself (default export)
// -----------------------------------------------------------

import { useState } from "react";
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import { Box, LinearProgress, Typography } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import BadgeIcon from '@mui/icons-material/Badge';
import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import AddEditAdministrator from "./AddEditAdministrator/AddEditAdministrator";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ToolbarButton from '@/components/DatagridCustomComponents/ToolbarButton';
import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';
import LoadError from '@/components/Other/LoadError/LoadError';
import { dateTimeColumn } from '@/utils/timestamps';







// -----------------------------------------------------------
// ADMINISTRATOR_COLUMNS
// -----------------------------------------------------------
//
// Column definitions. "Įjungtas?" prints its 1 / 0 as the
// words "Įjungtas" / "Išjungtas" (valueFormatter) and draws
// that word as a colored pill (enabled = green, disabled =
// grey). The quick search matches each column's printed
// value, so it finds the word the pill shows.
//
// Used by:
//   - AdministratorsList (below) — the grid's columns
// -----------------------------------------------------------

const ADMINISTRATOR_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 70,
  },
  {
    field: "email",
    headerName: "El. Paštas",
    width: 300,
  },
  {
    field: "enabled",
    headerName: "Įjungtas?",
    width: 110,
    valueFormatter: (value) => (value === 1 ? 'Įjungtas' : 'Išjungtas'),
    renderCell: (params) => {
      const isEnabled = params.value === 1;
      return (
        <div className={`rounded-[9px] w-20 text-center ${isEnabled ? 'bg-[green]' : 'bg-[grey]'}`}>
          {params.formattedValue}
        </div>
      );
    },
  },
  {
    field: "lastseen",
    headerName: "Paskutinįkart Pastebėtas",
    width: 220,
    ...dateTimeColumn,
  },
];







// -----------------------------------------------------------
// QuickSearchToolbar
// -----------------------------------------------------------
//
// Grid toolbar: quick search field ("Ieškoti..."), column
// picker and the "Įterpti Naują" button. triggerAddNew comes
// in through the grid's slotProps.toolbar.
//
// The search box holds ONE phrase: the parser keeps the
// trimmed input whole (the grid's default splits it into
// words). Parser and formatter live at module level to keep
// their identity: a new `parser` makes QuickFilter rebuild its
// debounced search, dropping the search still waiting out its
// 150 ms — inline functions would lose it to any re-render of
// the page inside that wait (a refetch landing, the dialog
// opening).
//
// Used by:
//   - AdministratorsList (below) — the grid's `toolbar` slot
// -----------------------------------------------------------

const parseSearch = (searchInput) => [searchInput.trim()];
const formatSearch = (quickFilterValues) => quickFilterValues.join('');

function QuickSearchToolbar({ triggerAddNew }) {
  return (
    <Toolbar sx={{ justifyContent: 'flex-start', flexWrap: 'wrap', rowGap: '4px' }}>
      <QuickFilter
        expanded
        parser={parseSearch}
        formatter={formatSearch}
      >
        <QuickFilterControl placeholder="Ieškoti..." size="small" />
      </QuickFilter>
      <ColumnsButton />
      <ToolbarButton label="Įterpti Naują" icon={AddCircleOutlinedIcon} onClick={triggerAddNew} />
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

  const { data, loadingData, error, refetch: getData } = useFetchData("/api/admin/administrators");

  // A load failed before any list arrived: `data` is still the
  // hook's initial [], which must not read as "(0)"
  // administrators (a failed refetch keeps the last list)
  const loadFailed = Boolean(error) && data.length === 0;

  // Modal state — userLineData undefined means "create new"
  const [openModal, setOpenModal] = useState(false);
  const [userLineData, setUserLineData] = useState(undefined);


  const handleRowClick = (params) => {
    setUserLineData({ ...params });
    setOpenModal(true);
  };

  const triggerAddNew = () => {
    setUserLineData(undefined);
    setOpenModal(true);
  };


  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <Box className="flex-1 p-5">

        {/* Page heading with administrator count */}
        <Box className="flex items-center gap-2 mb-4">
          <BadgeIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Administratorių Sąrašas
          </Typography>
          {!loadingData && !loadFailed && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              ({data.length})
            </Typography>
          )}
        </Box>

        {/* The grid — or the failed load with its retry, which
            also keeps "Įterpti Naują" away from a list nobody
            has seen */}
        <Box className="rounded-[15px] bg-white p-4 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
          {loadFailed ? (
            <LoadError message="Nepavyko įkelti administratorių sąrašo" onRetry={getData} />
          ) : (
            <DataGrid
              sx={{
                height: 'calc(100vh - 230px)',
                cursor: 'pointer',
                border: 'none',
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'rgba(123, 0, 63, 0.08)',
                },
              }}
              rows={data}
              loading={loadingData}
              columns={ADMINISTRATOR_COLUMNS}
              pageSizeOptions={[100]}
              rowHeight={30}
              showToolbar
              onRowClick={handleRowClick}

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
                  triggerAddNew,
                },
              }}
            />
          )}
        </Box>

        {/* Add / edit modal */}
        {openModal && (
          <AddEditAdministrator
            rowData={userLineData}
            setOpen={setOpenModal}
            getData={getData}
          />
        )}

      </Box>
    </AdminPageLayout>
  );
}
