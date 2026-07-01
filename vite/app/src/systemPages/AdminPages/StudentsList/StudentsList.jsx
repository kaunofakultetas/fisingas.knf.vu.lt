// -----------------------------------------------------------
//  [*] Admin — StudentsList
//
//  Thin page wrapper: the admin layout around the students
//  table. All the logic lives in StudentsListTable.
// -----------------------------------------------------------

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import StudentsListTable from "./StudentsListTable/StudentsListTable";


export default function StudentsList() {
  return (
    <AdminPageLayout>
      <StudentsListTable/>
    </AdminPageLayout>
  );
}
