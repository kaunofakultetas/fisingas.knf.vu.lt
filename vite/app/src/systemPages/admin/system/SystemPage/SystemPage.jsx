
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
            style={{
              borderStyle: "solid",
              borderWidth: "2px",
              borderRadius: "20px",
              borderColor: "rgb(123, 0, 63)"
            }}

            indicatorColor="primary"
            value={tabIndex}
            onChange={handleTabChange}

            TabIndicatorProps={{
              style: {
                backgroundColor: "rgb(123, 0, 63)",
                height: "100%",
                zIndex: -1,
                borderRadius: "15px",
                textColor: "black"
              }
            }}

            variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': { backgroundColor: "rgb(123, 0, 63) !important" },
              '& .Mui-selected': { color: "white !important"}
            }}
          >

            {/* <Tab value={0} style={{color: "black", fontWeight: "bold"}} disableRipple label="Subsistemų Statusas"/> */}
            <Tab value={1} style={{color: "black", fontWeight: "bold"}} disableRipple label="Sistemos Naudotojai"/>
            {/* <Tab value={2} style={{color: "black", fontWeight: "bold"}} disableRipple label="Duomenų Bazės Dydis"/> */}

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
