// -----------------------------------------------------------
//  [*] Admin — SystemPage
//
//  ⚠ Unfinished stub, kept for parity with the old app.
//
//  Meant to manage "system users", but the backend never got
//  the /api/systemusers endpoint — the grid just stays empty
//  and the AddSystemUser dialog doesn't submit anywhere. The
//  Sidebar links here ("Sistemos Naudotojai") all the same,
//  as it did in the old app.
// -----------------------------------------------------------

import { Box } from '@mui/material';

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import SystemUsers from './SystemUsers/SystemUsers';


export default function SystemPage() {
  return (
    <AdminPageLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', padding: 1 }}>
        <h2 className="text-xl text-gray-500 mb-2 ml-1">Sistemos Naudotojai</h2>
        <Box>
          <div className="h-[800px]">
            <SystemUsers/>
          </div>
        </Box>
      </Box>
    </AdminPageLayout>
  );
}
