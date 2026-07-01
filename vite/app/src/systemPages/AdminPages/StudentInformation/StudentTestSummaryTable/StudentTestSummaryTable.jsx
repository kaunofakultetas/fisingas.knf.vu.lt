// -----------------------------------------------------------
//  [*] Admin — StudentTestSummaryTable
//
//  The compact one-row-per-question summary grid of a
//  student's test: email thumbnail, whether it was identified
//  correctly, how many options were right and the points —
//  all color-coded green/orange/red.
//
//  Same data source as StudentAnswers
//  (GET /api/admin/students/<id>/answers), just condensed.
//
//  Used by:
//    - StudentInformation.jsx — the "Testo Apibendrinimas" tab
// -----------------------------------------------------------

import { DataGrid, GridLogicOperator } from "@mui/x-data-grid";
import { Box, LinearProgress } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";

import ButtonsPagination from '@/components/Other/ButtonsPagination/ButtonsPagination';


const SUMMARY_COLUMNS = [
  {
    field: "id",
    headerName: "ID",
    width: 80,
    renderCell: (params) => {
      return (params.row.questionid);
    },
  },
  {
    field: "phishingpicture",
    headerName: "Laiškas",
    width: 150,
    renderCell: (params) => {
      return (
        <div style={{ border: "1px solid lightgrey", padding: 5, borderRadius: 5 }}>
          <img
            src={"/api/phishingpictures/" + params.row.id}
            alt=""
            style={{
              height: 75,
              width: 100,
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
        </div>
      );
    },
  },
  {
    field: "identified",
    headerName: "Identifikuota",
    width: 180,
    renderCell: (params) => {
      if (params.row.isphishinganswer === params.row.isphishing) {
        return (
          <span style={{ backgroundColor: 'green', padding: '8px 16px', borderRadius: 5 }}>TEISINGAI</span>
        );
      }
      return (
        <span style={{ backgroundColor: 'red', padding: '8px 16px', borderRadius: 5 }}>NETEISINGAI</span>
      );
    },
  },
  {
    field: "correctoptionscount",
    headerName: "Opcijos",
    width: 120,
    renderCell: (params) => {
      const percentage = params.row.totaloptionscount > 0 ? params.row.correctoptionscount / params.row.totaloptionscount : 0;

      let color;
      if (percentage === 1.0) {
        color = 'green';
      } else if (percentage > 0.0) {
        color = 'orange';
      } else {
        color = 'red';
      }

      return (
        <span style={{ backgroundColor: color, padding: '8px 16px', borderRadius: 5 }}>
          {params.row.correctoptionscount} / {params.row.totaloptionscount}
        </span>
      );
    },
  },
  {
    field: "answerpoints",
    headerName: "Taškai",
    width: 180,
    renderCell: (params) => {
      // answerpoints is a "0.00".."1.00" string — string
      // comparison happens to work for this range
      let color;
      if (params.row.answerpoints === '1.00') {
        color = 'green';
      } else if (params.row.answerpoints > '0.00') {
        color = 'orange';
      } else {
        color = 'red';
      }

      return (
        <span style={{ backgroundColor: color, padding: '8px 16px', borderRadius: 5 }}>
          {params.row.answerpoints} tšk.
        </span>
      );
    },
  },
];


export default function StudentTestSummaryTable({ studentID }) {

  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID + "/answers");


  return (
    <Box className="w-full">
      <DataGrid
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
