// -----------------------------------------------------------
//  [*] Admin — StudentTestSummaryTable
//
//  The compact one-row-per-question summary grid of a
//  student's test: email thumbnail, whether it was identified
//  correctly, how many options were right and the points —
//  solid green/amber/red chips, the same visual language as
//  the StudentAnswers cards.
//
//  Same data source as StudentAnswers
//  (GET /api/admin/students/<id>/answers), just condensed.
//
//  Split into (root component last):
//
//    SUMMARY_COLUMNS         — column definitions
//    StudentTestSummaryTable — the grid itself (default export)
// -----------------------------------------------------------

import { DataGrid, GridLogicOperator } from "@mui/x-data-grid";
import { Box, LinearProgress } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import useFetchData from "@/hooks/useFetchData";

import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';







// -----------------------------------------------------------
// SUMMARY_COLUMNS
// -----------------------------------------------------------
//
// Column definitions. The results render as solid chips in
// the same visual language as the StudentAnswers cards:
// green = fully correct, amber = partially, red = wrong.
// -----------------------------------------------------------

const SUMMARY_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 80,
    renderCell: (params) => {
      return (
        <span className="font-semibold text-gray-400">#{params.row.questionid}</span>
      );
    },
  },
  {
    field: "phishingpicture",
    headerName: "Laiškas",
    width: 150,
    renderCell: (params) => {
      return (
        <div className="border border-gray-200 p-[5px] rounded-lg bg-white shadow-sm">
          <img
            src={"/api/phishingpictures/" + params.row.id}
            alt=""
            className="h-[75px] w-[100px] object-cover object-center rounded"
          />
        </div>
      );
    },
  },
  {
    field: "identified",
    headerName: "Identifikuota",
    width: 200,
    renderCell: (params) => {
      if (params.row.isphishinganswer === params.row.isphishing) {
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white bg-green-600 shadow-[0_2px_6px_rgba(22,163,74,0.35)]">
            <CheckIcon sx={{ fontSize: 14 }} />
            Teisingai
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white bg-red-500 shadow-[0_2px_6px_rgba(239,68,68,0.35)]">
          <CloseIcon sx={{ fontSize: 14 }} />
          Neteisingai
        </span>
      );
    },
  },
  {
    field: "correctoptionscount",
    headerName: "Opcijos",
    width: 160,
    renderCell: (params) => {
      const total = params.row.totaloptionscount;
      const correct = params.row.correctoptionscount;
      const percentage = total > 0 ? correct / total : 0;

      let barColor;
      if (percentage === 1.0) {
        barColor = 'bg-green-600';
      } else if (percentage > 0.0) {
        barColor = 'bg-amber-500';
      } else {
        barColor = 'bg-red-500';
      }

      // A mini progress bar with the count underneath — reads
      // at a glance across many rows
      return (
        <div className="flex flex-col justify-center gap-1 h-full w-full pr-4">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${percentage * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-500">{correct} / {total}</span>
        </div>
      );
    },
  },
  {
    field: "answerpoints",
    headerName: "Taškai",
    width: 140,
    renderCell: (params) => {
      // answerpoints is a "0.00".."1.00" string — string
      // comparison happens to work for this range
      let chip;
      if (params.row.answerpoints === '1.00') {
        chip = 'bg-green-600 shadow-[0_2px_6px_rgba(22,163,74,0.35)]';
      } else if (params.row.answerpoints > '0.00') {
        chip = 'bg-amber-500 shadow-[0_2px_6px_rgba(245,158,11,0.35)]';
      } else {
        chip = 'bg-red-500 shadow-[0_2px_6px_rgba(239,68,68,0.35)]';
      }

      return (
        <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg text-white ${chip}`}>
          {params.row.answerpoints} tšk.
        </span>
      );
    },
  },
];







// -----------------------------------------------------------
// StudentTestSummaryTable (default export)
// -----------------------------------------------------------
//
// Used by:
//   - StudentInformation.jsx — the "Testo Apibendrinimas" tab
// -----------------------------------------------------------

export default function StudentTestSummaryTable({ studentID }) {

  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID + "/answers");


  return (
    <Box className="w-full">
      <DataGrid
        sx={{ border: 'none' }}
        rows={data}
        columns={SUMMARY_COLUMNS}
        pageSizeOptions={[100]}
        rowHeight={110}
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
          loadingOverlay: LinearProgress,
          pagination: ButtonsPagination,
        }}

        slotProps={{
          panel: { placement: 'bottom-start' },
        }}
      />
    </Box>
  );
}
