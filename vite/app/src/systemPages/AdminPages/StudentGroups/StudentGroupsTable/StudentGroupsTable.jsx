// -----------------------------------------------------------
//  [*] Admin — StudentGroupsTable
//
//  The student groups DataGrid (/admin/studentgroups), from
//  GET /api/admin/studentgroups. Row click navigates to
//  /admin/students/<row id> — inherited from the old app
//  as-is. Groups are managed in the database directly; this
//  page is read-only.
//
//  Split into (root component last):
//
//    QuickSearchToolbar — search + column picker
//    StudentGroupsTable — the grid itself (default export)
// -----------------------------------------------------------

import { useNavigate } from "react-router-dom";
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import { Box, LinearProgress, Typography } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import useFetchData from "@/hooks/useFetchData";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';


const STUDENT_GROUP_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 80,
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
  },
];







// -----------------------------------------------------------
// QuickSearchToolbar
// -----------------------------------------------------------
//
// The grid's toolbar: quick-search box + column picker.
//
// Used by:
//   - StudentGroupsTable (below)
// -----------------------------------------------------------

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







// -----------------------------------------------------------
// StudentGroupsTable (default export)
// -----------------------------------------------------------
//
// Used by:
//   - StudentGroups.jsx
// -----------------------------------------------------------

export default function StudentGroupsTable() {

  const navigate = useNavigate();
  const { data, loadingData } = useFetchData("/api/admin/studentgroups");


  const handleRowClick = (params) => {
    navigate("/admin/students/" + params['id']);
  };


  return (
    <Box className="flex-1 p-5">

      {/* Page heading with group count */}
      <Box className="flex items-center gap-2 mb-4">
        <GroupsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Studentų Grupių Sąrašas
        </Typography>
        {!loadingData && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({data.length})
          </Typography>
        )}
      </Box>

      {/* The grid */}
      <Box className="rounded-[10px] bg-white p-4 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
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
          columns={STUDENT_GROUP_COLUMNS}
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
          }}
        />
      </Box>

    </Box>
  );
}
