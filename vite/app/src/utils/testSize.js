// -----------------------------------------------------------
//  [*] Test size — how many questions a new test deals
//
//  The admin picks it on the dashboard. Until a size has been
//  saved the API reports null, and the backend deals
//  DEFAULT_TEST_SIZE questions (capped at the number of
//  enabled questions) — so the pages treat null as that size.
//
//  Split into:
//
//    TEST_SIZE_CHOICES — the sizes the dashboard offers
//    DEFAULT_TEST_SIZE — the size while none was ever saved
// -----------------------------------------------------------







// -----------------------------------------------------------
// TEST_SIZE_CHOICES
// -----------------------------------------------------------
//
// The sizes the dashboard's test-size picker offers.
//
// Used by:
//   - Home — TestSizePicker
// -----------------------------------------------------------

export const TEST_SIZE_CHOICES = [9, 12, 15, 21, 30];







// -----------------------------------------------------------
// DEFAULT_TEST_SIZE
// -----------------------------------------------------------
//
// What new tests get while no size was ever saved — the
// backend's own fallback.
//
// Used by:
//   - Home — TestSizePicker shows it for a null size
//   - Questions — TestSizeWarning compares against it
// -----------------------------------------------------------

export const DEFAULT_TEST_SIZE = 30;
