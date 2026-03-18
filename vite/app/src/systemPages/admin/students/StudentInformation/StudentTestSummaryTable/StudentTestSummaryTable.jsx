import { DataGrid, GridLogicOperator } from "@mui/x-data-grid";
import React from "react";
import { Box, LinearProgress } from '@mui/material';
import useFetchData from "@/hooks/useFetchData";


const columns = [
  { 
    field: "id", 
    headerName: "ID", 
    width: 80,
    renderCell: (params) => {
      return (params.row.questionid)
    }
  },
  {
    field: "phishingpicture",
    headerName: "Laiškas",
    width: 150,
    renderCell: (params) => {
      return (
        <div style={{ border: "1px solid lightgrey", padding: 5, borderRadius: 5 }}> {/* Container div to handle overflow */}
          <img 
            src={"/api/phishingpictures/" + params.row.id} 
            alt=""
            style={{
              height: 75,
              width: 100,
              objectFit: 'cover',
              objectPosition: 'center'
            }} 
          />
        </div>
      )
    }
  },
  {
    // field: "",
    headerName: "Identifikuota",
    width: 180,
    renderCell: (params) => {
      if(params.row.isphishinganswer === params.row.isphishing){
        return (
          <div className="p-[5px] mr-[5px] rounded-[5px]" style={{backgroundColor: 'green', width: 100, textAlign: 'center'}}>TEISINGAI</div>
        );
      }
      else {
        return (
          <div className="p-[5px] mr-[5px] rounded-[5px]" style={{backgroundColor: 'red', width: 100, textAlign: 'center'}}>NETEISINGAI</div>
        );
      }
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
        <div 
          className="p-[5px] mr-[5px] rounded-[5px]"
          style={{backgroundColor: color, width: 50, textAlign: 'center'}}
        >
          {params.row.correctoptionscount} / {params.row.totaloptionscount}
        </div>
      )
    },
  },
  
  
  {
    field: "answerpoints",
    headerName: "Taškai",
    width: 180,
    renderCell: (params) => {

      let color;
      if (params.row.answerpoints === '1.00') {
        color = 'green'; 
      } else if (params.row.answerpoints > '0.00') { 
        color = 'orange'; 
      } else { 
        color = 'red';
      }
  
      return (
        <div className="p-[5px] mr-[5px] rounded-[5px]" style={{backgroundColor: color, width: 50, textAlign: 'center'}}>
          {params.row.answerpoints} tšk.
        </div>
      )
    },
  },
];




// function QuickSearchToolbar({passState}) {

//   return (
//     <Box
//       sx={{
//         p: 0.5,
//         pb: 0,
//       }}
      
//     >
//       <GridToolbarQuickFilter style={{}}
//         quickFilterParser={(searchInput) =>
//           searchInput
//             .split(',')
//             .map((value) => value.trim())
//             .filter((value) => value !== '')
//         }
//         sx={{
//           '& .MuiInput-root:after': {
//             borderBottom: '2px solid #E64164'
//           },
//         }}
//         placeholder="Ieškoti..."
//       />
//       <GridToolbarColumnsButton
//         sx={{
//           marginLeft: '10px',
//           paddingLeft: '15px',
//           paddingRight: '10px',
//           color: 'white',
//           backgroundColor: 'rgb(123, 0, 63)',
//           "&:hover": {
//             backgroundColor: 'rgb(230, 65, 100)',
//           },
//         }}
//       />

//     </Box>
//   );
// }



const StudentTestSummaryTable = ({studentID}) => {
  const { data, loadingData } = useFetchData("/api/admin/students/" + studentID + "/answers");


  const handleRowClick = (params) => {
    // window.location.href="/admin/students/" + params['id'];
  };



  return (
    <Box className="w-full">
      <DataGrid
        rows={data}
        columns={columns}
        pageSize={100}
        rowsPerPageOptions={[100]}
        rowHeight={110}
        onRowClick={handleRowClick}

        localeText={{
          toolbarColumns: "STULPELIAI",
          toolbarExport: "EXPORTUOTI"
        }}


        initialState={{
          columns: {
            columnVisibilityModel: {
              
            },
          },
          filter: {
            filterModel: {
              items: [],
              quickFilterLogicOperator: GridLogicOperator.Or,
            },
          },
        }}

        slots={{ 
          // toolbar: QuickSearchToolbar,
          loadingOverlay: LinearProgress,
          pagination: undefined,
        }}
        
        loading={loadingData}
        

        slotProps={{
          panel: {
            sx: {
              '& .MuiTypography-root': {
                color: 'dodgerblue',
                fontSize: 20,
              },
              '& .MuiDataGrid-filterForm': {
                bgcolor: 'lightblue',
              },
            },
          },
          toolbar: { 
            // passState: setFilterValue
          } 
        }}
        
      />
    </Box>
  );
};

export default StudentTestSummaryTable;
