// -----------------------------------------------------------
//  [*] Admin — Questions
//
//  The question bank page (/admin/questions):
//    - top: title card + summary tiles (total questions,
//      real vs. phishing split, option count — the last one
//      is a "XXX" placeholder, the backend doesn't send it)
//    - below: QuestionsList — every question with its inline
//      editor
//
//  Data comes from GET /api/admin/questions; `refetch` is
//  passed down so the list can refresh itself after adding
//  a question or editing link areas.
// -----------------------------------------------------------

import useFetchData from "@/hooks/useFetchData";

import AdminPageLayout from "@/systemPages/AdminPages/AdminPageLayout";
import QuestionsList from "./QuestionsList/QuestionsList";

import { FaQuestion } from 'react-icons/fa';
import { BsHandThumbsUp } from 'react-icons/bs';
import { GrCheckboxSelected } from 'react-icons/gr';
import { MdPhishing } from 'react-icons/md';


const CARD_SHADOW_STYLE = {
  WebkitBoxShadow: '2px 4px 10px 1px rgba(0, 0, 0, 0.47)',
  boxShadow: '2px 4px 10px 1px rgba(201, 201, 201, 0.47)',
};

const TILE_STYLE = {
  display: 'table-cell',
  textAlign: 'center',
  padding: '30px',
  fontSize: '15px',
  verticalAlign: 'top',
};

const TILE_ICON_STYLE = {
  backgroundColor: 'lightgrey',
  borderRadius: '15px',
  padding: '10px',
  display: 'block',
  margin: '0 auto',
};







// -----------------------------------------------------------
// Questions (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /admin/questions
// -----------------------------------------------------------

export default function Questions() {

  const { data, loadingData, refetch: triggerQuestionListUpdate } = useFetchData("/api/admin/questions");


  if (loadingData) {
    return null;
  }


  return (
    <AdminPageLayout>
      <div>

        <div className="p-5 flex gap-5">

          {/* Left — title card */}
          <div
            className="flex-1 p-5 relative rounded-[10px]"
            style={CARD_SHADOW_STYLE}
          >
            <div className="flex gap-5">
              <div style={{ backgroundColor: '#E8E8E8', padding: '10px', height: 'fit-content', borderRadius: '15px' }}>
                <MdPhishing size={170} style={{ borderRadius: '15px', padding: '10px' }} />
              </div>

              <div className="flex-1 flex flex-col">
                <h1 className="mb-2.5 text-[#555] text-2xl font-bold">Testo Klausimai</h1>
              </div>
            </div>
          </div>

          {/* Right — summary tiles */}
          <div
            className="relative rounded-[10px]"
            style={{
              display: 'table',
              width: '65%',
              tableLayout: 'fixed',
              ...CARD_SHADOW_STYLE,
            }}
          >
            <div style={TILE_STYLE}>
              <FaQuestion size={50} style={TILE_ICON_STYLE} />
              <span className="block">Viso <br/> Klausimų:</span>
              <br/>
              <span className="block">{data.questioncount}</span>
            </div>

            <div style={TILE_STYLE}>
              <BsHandThumbsUp size={50} style={TILE_ICON_STYLE} />
              <span className="block">Tikri<br/>Pavyzdžiai:</span>
              <br/>
              <span className="block">{data.goodcount} / {(data.goodcount * 100 / data.questioncount).toFixed(2)}%</span>
            </div>

            <div style={TILE_STYLE}>
              <MdPhishing size={50} style={TILE_ICON_STYLE} />
              <span className="block">Fišingo<br/>Pavyzdžiai:</span>
              <br/>
              <span className="block">{data.phishingcount} / {(data.phishingcount * 100 / data.questioncount).toFixed(2)}%</span>
            </div>

            <div style={TILE_STYLE}>
              <GrCheckboxSelected size={50} style={TILE_ICON_STYLE} />
              <span className="block">Opcijų<br/>Skaičius:</span>
              <br/>
              <span className="block">XXX</span>
            </div>
          </div>
        </div>

        {/* The question list with inline editors */}
        <div className="rounded-[10px] p-5 pb-2.5 mx-5 my-2.5" style={{ ...CARD_SHADOW_STYLE, minHeight: 'calc(100vh - 353px)' }}>
          <QuestionsList data={data} triggerQuestionListUpdate={triggerQuestionListUpdate}/>
        </div>

      </div>
    </AdminPageLayout>
  );
}
