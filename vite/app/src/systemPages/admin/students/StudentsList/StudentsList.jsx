
import AdminPageLayout from "@/systemPages/admin/AdminPageLayout";
import StudentsListTable from "./StudentsListTable/StudentsListTable"

const StudentsListPage = () => {
  return (
    <AdminPageLayout>
      <StudentsListTable/>
    </AdminPageLayout>
  )
}

export default StudentsListPage;
