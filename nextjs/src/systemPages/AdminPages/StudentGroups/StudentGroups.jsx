'use client';
import Sidebar from "@/components/Admin/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar"
import StudentsListTable from "./StudentGroupsTable/StudentGroupsTable"

const StudentGroupsPage = () => {
  return (
    <div>
      <Navbar />
      <div style={{display: 'flex', flexDirection: 'row'}}> 
        <Sidebar/>
        <StudentsListTable/>
      </div>
      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>

  )
}


export default StudentGroupsPage;