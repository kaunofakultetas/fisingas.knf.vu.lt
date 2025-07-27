'use client';
import Sidebar from "@/components/Admin/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar"
import AdministratorsListTable from "./AdministratorsListTable/AdministratorsListTable"

const AdministratorsListPage = () => {
  return (
    <div>
      <Navbar />
      <div style={{display: 'flex', flexDirection: 'row'}}> 
        <Sidebar/>
        <AdministratorsListTable/>
      </div>
      <div style={{background: 'rgb(123, 0, 63)', height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: "0.7em"}}> 
        Copyright © | All Rights Reserved | VUKnF
      </div>
    </div>

  )
}

export default AdministratorsListPage;