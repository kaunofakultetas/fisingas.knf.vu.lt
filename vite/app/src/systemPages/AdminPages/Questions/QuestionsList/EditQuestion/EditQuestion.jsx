// -----------------------------------------------------------
//  [*] Admin — EditQuestion
//
//  A bare standalone page with just the link-area editor for
//  one question (/admin/questions/:questionID). The normal
//  editing flow is the fullscreen editor inside QuestionsList;
//  this page is a direct-URL shortcut to the same editor.
//
//  Used by:
//    - App.jsx — route /admin/questions/:questionID
// -----------------------------------------------------------

import { useParams } from 'react-router-dom';

import InteractiveImageEditor from '@/components/Other/InteractiveImage/InteractiveImageEditor';







export default function EditQuestion() {

  const { questionID } = useParams();

  return (
    <div className="m-[100px]">
      <InteractiveImageEditor
        src={"/api/phishingpictures/" + questionID}
        initialAreasUrl={"/api/phishingpictures/" + questionID + "/links"}
      />
    </div>
  );
}
