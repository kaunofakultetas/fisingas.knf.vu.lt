
import React from "react";
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";

import { Box } from '@mui/material';

import SystemUsers from './systemUsers/SystemUsers';


const SystemPage = () => {
  return (
    <AdminPageLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 1 }}>
        <h2 className="text-xl text-gray-500 mb-2 ml-1">Sistemos Naudotojai</h2>
        <Box>
          <div style={{ height: 800 }}>
            <SystemUsers/>
          </div>
        </Box>
      </Box>
    </AdminPageLayout>
  );
};

export default SystemPage;
