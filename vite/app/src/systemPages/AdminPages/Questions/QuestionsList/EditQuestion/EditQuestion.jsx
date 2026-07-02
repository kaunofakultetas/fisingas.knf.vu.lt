// -----------------------------------------------------------
//  [*] Admin — EditQuestion
//
//  A standalone page with the link-area editor for one
//  question (/admin/questions/:questionID). The normal
//  editing flow is the fullscreen editor inside QuestionsList;
//  this page is a direct-URL shortcut to the same editor,
//  wrapped in the usual admin layout (navbar, sidebar,
//  toasts).
//
//  Used by:
//    - App.jsx — route /admin/questions/:questionID
// -----------------------------------------------------------

import { useParams } from 'react-router-dom';

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import InteractiveImageEditor from '@/components/Other/InteractiveImage/InteractiveImageEditor';







export default function EditQuestion() {

  const { questionID } = useParams();

  return (
    <AdminPageLayout backgroundColor="#EBECEF">
      <div className="flex-1 p-5">
        <div className="bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] p-5">
          <InteractiveImageEditor
            src={"/api/phishingpictures/" + questionID}
            initialAreasUrl={"/api/phishingpictures/" + questionID + "/links"}
          />
        </div>
      </div>
    </AdminPageLayout>
  );
}
