// -----------------------------------------------------------
//  [*] Admin — StudentsListTable
//
//  The students DataGrid, refreshed every 5 s from
//  GET /api/admin/students. Clicking a row opens that
//  student's information page.
//
//  The toolbar has a quick-search box, the column picker and
//  a "Per Paskutinį Mėnesį" switch (on by default) that hides
//  students not seen within the last month.
//
//  Split into (root component last):
//
//    QuickSearchToolbar — search + columns + last-month switch
//    StudentsListTable  — the grid itself (default export)
// -----------------------------------------------------------

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataGrid, Toolbar, QuickFilter, QuickFilterControl, GridLogicOperator } from "@mui/x-data-grid";
import { Box, LinearProgress, FormGroup, FormControlLabel, Typography } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import useFetchData from "@/hooks/useFetchData";

import ColumnsButton from '@/components/DatagridCustomComponents/ColumnsButton';
import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';
import IOSSwitch from '@/components/Other/IOSSwitch/IOSSwitch';
import { dateTimeColumn, parseTimestamp } from '@/utils/timestamps';


const STUDENT_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 80,
  },
  {
    field: "username",
    headerName: "Prisijungimo Vardas",
    width: 350,
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
    // The API sends the grade as a fixed 2-decimal STRING ("7.50",
    // "" when the test was never started). Without a numeric type
    // the grid sorts lexicographically and puts "10.00" below
    // "2.00" — so sort on the number, still print the string
    type: "number",
    align: "left",
    headerAlign: "left",
    valueGetter: (value) => (value === "" || value == null ? null : Number(value)),
    valueFormatter: (value) => (value == null ? "" : value.toFixed(2)),
  },
  {
    field: "isfinished",
    headerName: "Baigta?",
    width: 100,
    renderCell: (params) => {
      if (params.row.isfinished === 1) {
        return (
          <div className="rounded-[9px] w-20 text-center bg-[green]">BAIGTA</div>
        );
      }
      return null;
    },
  },
  {
    field: "registrationtime",
    headerName: "Registracijos Laikas",
    width: 180,
    ...dateTimeColumn,
  },
  {
    field: "lastseen",
    headerName: "Paskutinįkart Pastebėtas",
    width: 180,
    ...dateTimeColumn,
  },
];







// -----------------------------------------------------------
// QuickSearchToolbar
// -----------------------------------------------------------
//
// The grid's toolbar: quick-search box, column picker and
// the last-month switch. `passState` reports the switch
// position (1/0) back up to the table's filter.
//
// Used by:
//   - StudentsListTable (below)
// -----------------------------------------------------------

function QuickSearchToolbar({ passState }) {

  const handleSwitchChange = (event) => {
    passState(event.target.checked ? 1 : 0);
  }

  return (
    <Toolbar sx={{ justifyContent: 'flex-start', flexWrap: 'wrap', rowGap: '4px' }}>
      <QuickFilter
        expanded
        parser={(searchInput) => [searchInput.trim()]}
        formatter={(quickFilterValues) => quickFilterValues.join('')}
      >
        <QuickFilterControl placeholder="Ieškoti..." size="small" />
      </QuickFilter>
      <ColumnsButton />

      <FormGroup
        sx={{
          marginLeft: '20px',
          display: 'inline',
        }}
      >
        <FormControlLabel
          sx={{
            margin: 'auto',
            paddingLeft: '20px',
          }}
          control={
            <IOSSwitch
              defaultChecked={true}
              sx={{
                marginRight: '10px',
              }}
              onChange={handleSwitchChange}
            />}
          label="Per Paskutinį Mėnesį"
        />
      </FormGroup>

    </Toolbar>
  );
}







// -----------------------------------------------------------
// StudentsListTable (default export)
// -----------------------------------------------------------
//
// Used by:
//   - StudentsList.jsx
// -----------------------------------------------------------

export default function StudentsListTable() {

  const navigate = useNavigate();
  const { data, loadingData } = useFetchData("/api/admin/students", 5);

  // 1 = show only students seen within the last month
  const [lastMonthOnly, setLastMonthOnly] = useState(1);


  const handleRowClick = (params) => {
    navigate("/admin/students/" + params['id']);
  };


  // Cutoff computed once on a fresh Date — setMonth mutates
  // the object it is called on, so it must not touch a date
  // that is still used afterwards. Compared as Dates: the API
  // timestamps carry their offset, so this is exact in any
  // browser timezone (a never-seen student has no lastseen
  // and is hidden by the filter)
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const rows = (data || []).filter((row) => {
    if (lastMonthOnly === 1) {
      const lastSeen = parseTimestamp(row.lastseen);
      if (!lastSeen || lastSeen < oneMonthAgo) return false;
    }

    return true;
  });


  return (
    <Box className="flex-1 p-5">

      {/* Page heading with student count */}
      <Box className="flex items-center gap-2 mb-4">
        <PersonOutlineIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Studentų Sąrašas
        </Typography>
        {!loadingData && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({rows.length})
          </Typography>
        )}
      </Box>

      {/* The grid */}
      <Box className="rounded-[15px] bg-white p-4 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
        <DataGrid
          sx={{
            height: 'calc(100vh - 230px)',
            cursor: 'pointer',
            border: 'none',
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'rgba(123, 0, 63, 0.08)',
            },
          }}
          rows={rows}
          columns={STUDENT_COLUMNS}
          pageSizeOptions={[100]}
          rowHeight={30}
          showToolbar
          onRowClick={handleRowClick}
          loading={loadingData}

          initialState={{
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
              passState: setLastMonthOnly,
            },
          }}
        />
      </Box>

    </Box>
  );
}
