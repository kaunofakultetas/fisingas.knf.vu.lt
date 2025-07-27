'use client';
import styles from "./SystemPage.module.scss";
import React, { useState, useEffect } from "react";

import Sidebar from "@/components/Admin/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar";


// Tabs
import { Box, Tab, Tabs, Paper } from '@mui/material';

import SystemUsers from './systemUsers/SystemUsers';



const SystemPage = () => {
  const [tabIndex, setTabIndex] = useState(1);

  const handleTabChange = (event, newTabIndex) => {
    setTabIndex(newTabIndex);
  };


  return (
    <div>
      <Navbar />
      <div style={{display: 'flex', flexDirection: 'row'}}> 
        <Sidebar />

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
              <Box >
                <div className={styles.datatable} style={{ height: 800 }}>
                  {/* <SystemUsers/> */}
                </div>
              </Box>
            )}
            {tabIndex === 1 && (
              <Box >
                <div className={styles.datatable} style={{ height: 800 }}>
                  <SystemUsers/>
                </div>
              </Box>
            )}
            {tabIndex === 2 && (
              <Box >
                <div className={styles.datatable} style={{ height: 800 }}>
                  {/* <SystemUsers/> */}
                </div>
              </Box>
            )}
            
          </Box>
        </Box>
        
      </div>
    </div>
  );
};

export default SystemPage;
