import { gridPageCountSelector, gridPageSelector, useGridApiContext, useGridSelector } from "@mui/x-data-grid";
import Pagination from '@mui/material/Pagination';
import PaginationItem from '@mui/material/PaginationItem';



function CustomPagination() {
    const apiRef = useGridApiContext();
    const page = useGridSelector(apiRef, gridPageSelector);
    const pageCount = useGridSelector(apiRef, gridPageCountSelector);
  
    return (
      <Pagination
        boundaryCount={4}
        showFirstButton
        showLastButton
        variant="outlined"
        shape="rounded"
        page={page + 1}
        count={pageCount}
        // @ts-expect-error
        renderItem={(props2) => <PaginationItem {...props2} disableRipple />}
        onChange={(event, value) => apiRef.current.setPage(value - 1)}
        sx={{
          '& .MuiPaginationItem-root': {
            '&.Mui-selected': {
              background: 'rgb(123, 0, 63)',
              color: 'white',
              // borderRadius: '50%',
              "&:hover": {
                backgroundColor: 'rgb(230, 65, 100)',
              },
            },
            "&:hover": {
              backgroundColor: 'rgb(230, 65, 100)',
            },
          },
        }}
      />
    );
  }


export default CustomPagination;
