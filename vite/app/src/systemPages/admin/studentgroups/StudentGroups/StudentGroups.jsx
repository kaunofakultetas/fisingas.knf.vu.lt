
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";
import StudentGroupsTable from "./StudentGroupsTable/StudentGroupsTable"

const StudentGroupsPage = () => {
  return (
    <AdminPageLayout>
      <StudentGroupsTable/>
    </AdminPageLayout>
  )
}

export default StudentGroupsPage;
