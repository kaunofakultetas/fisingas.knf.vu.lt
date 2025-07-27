'use client';
import React from 'react';
import EditableInteractiveImage from '@/components/other/InteractiveImage/InteractiveImageEditor';


function EditQuestion({questionID}) {
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
