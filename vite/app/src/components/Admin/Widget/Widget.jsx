// -----------------------------------------------------------
//  [*] Admin — Widget
//
//  White stat card of the admin dashboard: a label, a big
//  number and an icon in the corner. Optional extras:
//    - children   — custom content in the middle (the
//                   dashboard puts the test-size picker here)
//    - link       — makes the icon a router link
//    - difference — green/red up/down badge (not used by the
//                   dashboard right now, kept from the design)
//
//  Used by:
//    - AdminPages/Home — the "Studentų" and "Klausimai" cards
// -----------------------------------------------------------

import { Link } from "react-router-dom";
import ArrowUpwardSharpIcon from '@mui/icons-material/ArrowUpwardSharp';
import ArrowDownwardSharpIcon from '@mui/icons-material/ArrowDownwardSharp';


export default function Widget({ text, bottomtext, count, icon, link, difference, children }) {
  return (
    <div className="flex justify-between flex-1 p-2.5 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] rounded-[15px] h-[100px] w-full bg-white">

      {/* Label + number */}
      <div className="flex flex-col justify-between">
        <span className="font-bold text-sm text-gray-400">{text}</span>
        <span className="text-[28px] font-light">{count}</span>
        <span className="w-max text-xs border-b border-gray-500">{bottomtext}</span>
      </div>

      {/* Custom content (e.g. the test-size picker) */}
      <div className="ml-auto">
        {children}
      </div>

      <div className="flex flex-col justify-between mr-2.5">

        {/* Up/down difference badge */}
        <div className="flex">
          {(difference > 0 &&
            <div className="flex items-center text-lg rounded-[5px] text-white bg-green-600 p-[3px] pr-[5px] ml-5">
              <ArrowUpwardSharpIcon />
              {difference}
            </div>
          ) || (difference < 0 &&
            <div className="flex items-center text-lg rounded-[5px] text-white bg-red-600 p-[3px] pr-[5px] ml-5">
              <ArrowDownwardSharpIcon />
              {difference}
            </div>
          ) || (
            <div className="ml-20"></div>
          )}
        </div>

        {/* Corner icon, optionally linking to a page */}
        <div className="flex justify-end">
          {link ?
            <Link to={link} className="no-underline m-0 p-0">
              {icon}
            </Link>
            :
            <div className="self-end">
              {icon}
            </div>
          }
        </div>

      </div>
    </div>
  );
}
