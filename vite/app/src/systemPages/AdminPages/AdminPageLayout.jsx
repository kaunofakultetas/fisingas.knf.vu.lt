// -----------------------------------------------------------
//  [*] Admin — AdminPageLayout
//
//  The shared frame of every admin page: the burgundy Navbar
//  on top, the collapsible Sidebar on the left, and the page
//  content in a scrollable area next to it. Also mounts the
//  react-hot-toast <Toaster> that the admin forms use for
//  save/delete feedback.
//
//  `backgroundColor` tints the content area (the dashboard
//  passes the grey #EBECEF, tables stay white).
//
//  Used by:
//    - every AdminPages/* page
// -----------------------------------------------------------

import { Toaster } from 'react-hot-toast';

import Navbar from "@/components/Navbar/Navbar";
import Sidebar from "@/components/Admin/Sidebar/Sidebar";


export default function AdminPageLayout({ children, backgroundColor = 'white' }) {
  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <Toaster position="top-center" containerStyle={{ top: 20 }}/>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-auto" style={{ backgroundColor }}>
          {children}
        </div>
      </div>
    </div>
  );
}
