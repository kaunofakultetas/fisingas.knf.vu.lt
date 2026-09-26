// -----------------------------------------------------------
//  [*] Admin — StudentsListTable
//
//  The students DataGrid, refreshed every 5 s from
//  GET /api/admin/students. Clicking a row opens that
//  student's information page.
//
//  The toolbar has a quick-search box, the column picker and
//  a "Per Paskutinį Mėnesį" switch (on by default) that hides
//  students not seen within the last calendar month.
//
//  A load failing before any list has arrived shows as a
//  failure with a retry (LoadError) in place of the count and
//  the grid — "(0)" over an empty grid would claim nobody has
//  registered. The polls go on meanwhile, so the next good one
//  brings the list in as well. Once a list is on screen, a
//  failed poll keeps it there until the next poll succeeds.
//
//  Split into (root component last):
//
//    STUDENT_COLUMNS    — column definitions
//    oneMonthBefore     — the last-month filter's cutoff
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
import LoadError from '@/components/Other/LoadError/LoadError';
import { dateTimeColumn, parseTimestamp } from '@/utils/timestamps';







// -----------------------------------------------------------
// STUDENT_COLUMNS
// -----------------------------------------------------------
//
// Column definitions. The quick search matches each column's
// printed value, so "Baigta?" prints its 1 / 0 as "BAIGTA" /
// "" (valueFormatter) and draws that word as the green badge
// — searching "BAIGTA" finds the students who finished.
//
// Used by:
//   - StudentsListTable (below) — the grid's columns
// -----------------------------------------------------------

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
    valueFormatter: (value) => (value === 1 ? "BAIGTA" : ""),
    renderCell: (params) => {
      if (params.formattedValue) {
        return (
          <div className="rounded-[9px] w-20 text-center bg-[green]">{params.formattedValue}</div>
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
// oneMonthBefore
// -----------------------------------------------------------
//
// The same local time one calendar month before `date`, the
// day clamped to that month's length: March 31 → February 28
// (29 in a leap year). setMonth alone would ask for "February
// 31", which Date rolls over into March. Works on a copy —
// setMonth / setDate mutate the Date they are called on.
//
// Used by:
//   - StudentsListTable (below) — the "Per Paskutinį
//     Mėnesį" cutoff
// -----------------------------------------------------------

function oneMonthBefore(date) {

  const cutoff = new Date(date);
  cutoff.setMonth(cutoff.getMonth() - 1);

  // Rolled over into date's own month: its day 0 is the last
  // day of the month before
  if (cutoff.getDate() !== date.getDate()) {
    cutoff.setDate(0);
  }
  return cutoff;
}







// -----------------------------------------------------------
// QuickSearchToolbar
// -----------------------------------------------------------
//
// The grid's toolbar: quick-search box, column picker and
// the last-month switch. The switch shows the table's
// `lastMonthOnly` and reports a flip (1/0) back through
// `passState` — controlled, so a toolbar mounted anew (the
// grid returns after a failed first load) still shows the
// filter in force.
//
// The search box holds ONE phrase: the parser keeps the
// trimmed input whole (the grid's default splits it into
// words). Parser and formatter live at module level to keep
// their identity: a new `parser` makes QuickFilter rebuild its
// debounced search, dropping the search still waiting out its
// 150 ms — inline functions would lose it to any re-render of
// the table inside that wait (every 5 s poll re-renders it).
//
// Used by:
//   - StudentsListTable (below) — the grid's `toolbar` slot
// -----------------------------------------------------------

const parseSearch = (searchInput) => [searchInput.trim()];
const formatSearch = (quickFilterValues) => quickFilterValues.join('');

function QuickSearchToolbar({ lastMonthOnly, passState }) {

  const handleSwitchChange = (event) => {
    passState(event.target.checked ? 1 : 0);
  }

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
              checked={lastMonthOnly === 1}
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
  const { data, loadingData, error, refetch } = useFetchData("/api/admin/students", 5);

  // 1 = show only students seen within the last month
  const [lastMonthOnly, setLastMonthOnly] = useState(1);

  // Once a list has arrived, a failed poll keeps it on screen;
  // a load failing before that has nothing to show — `data` is
  // still the hook's initial [], which must not read as "(0)"
  const [listArrived, setListArrived] = useState(false);
  if (!listArrived && !loadingData && !error) {
    setListArrived(true);
  }
  const loadFailed = Boolean(error) && !listArrived;


  const handleRowClick = (params) => {
    navigate("/admin/students/" + params['id']);
  };


  // Compared as Dates: the API timestamps carry their offset,
  // so the cutoff is exact in any browser timezone (a
  // never-seen student has no lastseen and is hidden by the
  // filter)
  const oneMonthAgo = oneMonthBefore(new Date());

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
        {!loadingData && !loadFailed && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({rows.length})
          </Typography>
        )}
      </Box>

      {/* The grid — or the failed first load with its retry */}
      <Box className="rounded-[15px] bg-white p-4 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
        {loadFailed ? (
          <LoadError message="Nepavyko įkelti studentų sąrašo" onRetry={refetch} />
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
                lastMonthOnly,
                passState: setLastMonthOnly,
              },
            }}
          />
        )}
      </Box>

    </Box>
  );
}
