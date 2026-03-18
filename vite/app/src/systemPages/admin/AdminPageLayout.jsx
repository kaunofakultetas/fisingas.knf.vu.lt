import Sidebar from "@/components/Admin/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar";

import { Toaster } from 'react-hot-toast';


const AdminPageLayout = ({ children, authData, backgroundColor = 'white' }) => {
  return (
    <div className="h-screen flex flex-col">
      <Navbar authData={authData} />
      <Toaster position="top-center" containerStyle={{ top: 20 }}/>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar authData={authData}/>
        <div className="flex-1 overflow-auto" style={{ backgroundColor }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminPageLayout;