
import React from 'react';
import { useParams } from 'react-router-dom';
import EditableInteractiveImage from '@/components/other/InteractiveImage/InteractiveImageEditor';


function EditQuestion() {
  const { questionID } = useParams();
  return (
    <div style={{margin: 100}}>
      <EditableInteractiveImage
        src={"/api/phishingpictures/"+questionID}
        initialAreasUrl={"/api/phishingpictures/"+questionID+"/links"}
      />
    </div>
  );
};

export default EditQuestion;
