// -----------------------------------------------------------
//  [*] Admin — QuestionsList
//
//  The question bank itself: a "Sukurti Naują Klausimą"
//  button (opens the AddQuestion upload dialog) above one
//  self-saving QuestionCard per question.
//
//  A toolbar above the cards filters the bank: quick text
//  search (question text, option text or ID) and status pills
//  (all / enabled / disabled / phishing / real). Filtering
//  only hides cards — they stay mounted so unsaved edits are
//  never lost.
//
//  Split into (root component last):
//
//    FilterBar     — search field + status pills
//    EmptyState    — shown when nothing is displayed
//    QuestionsList — the list (default export)
// -----------------------------------------------------------

import { useState } from "react";

import { Button, InputAdornment, TextField } from '@mui/material';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import SearchIcon from '@mui/icons-material/Search';

import QuestionCard from './QuestionCard/QuestionCard';
import AddQuestion from './AddQuestion/AddQuestion';







// -----------------------------------------------------------
// FilterBar
// -----------------------------------------------------------
//
// The toolbar above the cards: a quick search field and the
// status filter pills, with a "showing X of Y" counter on
// the right. Purely a view — the actual filtering happens
// in QuestionsList.
//
// Used by:
//   - QuestionsList (below)
// -----------------------------------------------------------

const STATUS_FILTERS = [
  { id: "all", label: "Visi" },
  { id: "enabled", label: "Įjungti" },
  { id: "disabled", label: "Išjungti" },
  { id: "phishing", label: "Fišingas" },
  { id: "real", label: "Tikri" },
];

function FilterBar({ searchText, setSearchText, statusFilter, setStatusFilter, shownCount, totalCount }) {
  return (
    <div className="flex items-center gap-4 flex-wrap bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] px-5 py-3">

      {/* Quick search */}
      <TextField
        size="small"
        placeholder="Ieškoti pagal tekstą, opciją ar ID..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{
          width: '320px',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            fontSize: '0.875rem',
            '&:hover fieldset': { borderColor: 'rgb(123,0,63)' },
            '&.Mui-focused fieldset': { borderColor: 'rgb(123,0,63)' },
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 20, color: 'rgb(160,160,160)' }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Status pills */}
      <div className="flex gap-1.5">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={`rounded-full px-4 py-1.5 text-sm cursor-pointer border ${
              statusFilter === filter.id
                ? "bg-[rgb(123,0,63)] text-white border-[rgb(123,0,63)]"
                : "bg-white text-gray-500 border-[rgb(231,228,228)] hover:border-[rgb(123,0,63)] hover:text-[rgb(123,0,63)]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Result counter */}
      <span className="ml-auto text-sm text-gray-400">
        Rodoma {shownCount} iš {totalCount}
      </span>

    </div>
  );
}







// -----------------------------------------------------------
// EmptyState
// -----------------------------------------------------------
//
// Shown when there are no cards to display — either the bank
// is empty, or the active search/filter matches nothing.
//
// Used by:
//   - QuestionsList (below)
// -----------------------------------------------------------

function EmptyState({ isBankEmpty }) {
  return (
    <div className="flex flex-col items-center gap-3 bg-white rounded-[15px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] py-16 text-center">
      <ImageSearchIcon sx={{ fontSize: 64, color: 'rgb(200,200,200)' }} />
      {isBankEmpty ? (
        <>
          <span className="text-lg font-semibold text-[#555]">Klausimų banke dar nieko nėra</span>
          <span className="text-sm text-gray-400">
            Sukurkite pirmą klausimą įkeldami el. laiško paveikslėlį.
          </span>
        </>
      ) : (
        <>
          <span className="text-lg font-semibold text-[#555]">Nieko nerasta</span>
          <span className="text-sm text-gray-400">
            Joks klausimas neatitinka paieškos ar filtro.
          </span>
        </>
      )}
    </div>
  );
}







// -----------------------------------------------------------
// QuestionsList (default export)
// -----------------------------------------------------------
//
// Used by:
//   - Questions.jsx
// -----------------------------------------------------------

export default function QuestionsList({ data, triggerQuestionListUpdate }) {

  const [isAddQuestionModalOpen, setAddQuestionModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const questions = data.questions || [];


  // Which questions pass the active search + status filter.
  // Matching cards are shown, the rest only hidden (display:
  // none) so their unsaved edits survive filter changes.
  const matchesFilters = (question) => {
    if (statusFilter === "enabled" && question.isenabled !== 1) return false;
    if (statusFilter === "disabled" && question.isenabled !== 0) return false;
    if (statusFilter === "phishing" && question.isphishing !== 1) return false;
    if (statusFilter === "real" && question.isphishing !== 0) return false;

    const needle = searchText.trim().toLowerCase();
    if (!needle) return true;

    return (
      String(question.questionid) === needle
      || question.questiontext.toLowerCase().includes(needle)
      || question.questionoptions.some((option) => option.optiontext.toLowerCase().includes(needle))
    );
  };

  const visibleIds = new Set(questions.filter(matchesFilters).map((question) => question.questionid));


  return (
    <div className="flex flex-col gap-5">

      {isAddQuestionModalOpen &&
        <AddQuestion
          setOpen={setAddQuestionModalOpen}
          getData={triggerQuestionListUpdate}
        />
      }

      {/* New question button */}
      <div className="flex justify-center">
        <Button
          variant="contained"
          color="primary"
          onClick={() => setAddQuestionModalOpen(true)}
          sx={{
            fontSize: 18,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 1.5,
            paddingBottom: 1.5,
            borderRadius: '10px',
          }}
        >
          Sukurti Naują Klausimą <AddCircleOutlinedIcon sx={{ fontSize: 24, marginLeft: 1.5 }}/>
        </Button>
      </div>

      {questions.length > 0 && (
        <FilterBar
          searchText={searchText}
          setSearchText={setSearchText}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          shownCount={visibleIds.size}
          totalCount={questions.length}
        />
      )}

      {/* One editable card per question (hidden, not unmounted,
          when filtered out) */}
      {questions.map((question) => (
        <div
          key={question.questionid}
          className={visibleIds.has(question.questionid) ? "" : "hidden"}
        >
          <QuestionCard
            fetchedQuestionData={question}
            triggerQuestionListUpdate={triggerQuestionListUpdate}
          />
        </div>
      ))}

      {visibleIds.size === 0 && (
        <EmptyState isBankEmpty={questions.length === 0} />
      )}

    </div>
  );
}
