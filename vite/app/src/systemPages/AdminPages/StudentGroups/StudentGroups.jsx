// -----------------------------------------------------------
//  [*] Admin — StudentGroups
//
//  Thin page wrapper: the admin layout around the student
//  groups table. All the logic lives in StudentGroupsTable.
// -----------------------------------------------------------

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import StudentGroupsTable from "./StudentGroupsTable/StudentGroupsTable";


export default function StudentGroups() {
  return (
    <AdminPageLayout>
      <StudentGroupsTable/>
    </AdminPageLayout>
  );
}
