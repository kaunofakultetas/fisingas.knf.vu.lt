
import React, { useState } from "react";
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import { Box, Tab, Tabs } from '@mui/material';

import SystemUsers from './systemUsers/SystemUsers';



const SystemPage = () => {
  const [tabIndex, setTabIndex] = useState(1);

  const handleTabChange = (event, newTabIndex) => {
    setTabIndex(newTabIndex);
  };


  return (
    <AdminPageLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 1 }}>
        <Box>
          <Tabs
            className="border-2 border-solid rounded-[20px] border-[rgb(123,0,63)]"
            indicatorColor="primary"
            value={tabIndex}
            onChange={handleTabChange}
            TabIndicatorProps={{
              style: {
                backgroundColor: "rgb(123, 0, 63)",
                height: "100%",
                borderRadius: "15px",
              }
            }}
            variant="fullWidth"
            sx={{
              position: 'relative',
              '& .MuiTabs-indicator': { 
                backgroundColor: "rgb(123, 0, 63) !important",
                zIndex: 0
              },
              '& .MuiTab-root': {
                zIndex: 1,
                color: "black",
                fontWeight: "bold",
                flex: 1,
                maxWidth: 'none',
              },
              '& .Mui-selected': { 
                color: "white !important" 
              }
            }}
          >
            <Tab value={1} disableRipple label="Sistemos Naudotojai"/>
          </Tabs>
        </Box>

        <Box sx={{ marginTop: 2, marginBottom: 2 }}>
          {tabIndex === 0 && (
            <Box>
              <div style={{ height: 800 }}>
                {/* <SystemUsers/> */}
              </div>
            </Box>
          )}
          {tabIndex === 1 && (
            <Box>
              <div style={{ height: 800 }}>
                <SystemUsers/>
              </div>
            </Box>
          )}
          {tabIndex === 2 && (
            <Box>
              <div style={{ height: 800 }}>
                {/* <SystemUsers/> */}
              </div>
            </Box>
          )}
          
        </Box>
      </Box>
    </AdminPageLayout>
  );
};

export default SystemPage;
