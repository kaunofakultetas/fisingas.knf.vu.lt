############################################################
#  [*] Regression test suite
#
#  Pins the CURRENT behaviour of every /api/* endpoint and
#  of the grading math, so refactorings can be verified not
#  to change what the frontend (or the projector) sees —
#  including the exact Lithuanian error strings, the 0/1
#  flag conventions and the ""-vs-null blank-field contract.
#
#  Run the whole suite with ../../runTests.sh — it builds
#  the production image and executes this package inside a
#  throwaway container (in-memory SQLite, nothing that is
#  running is touched).
#
#  Layout:
#    settings.py               — test settings (SQLite)
#    utils.py                  — shared fixtures + helpers
#    test_auth.py              — login / checkauth / sessions
#    test_administrators.py    — admin account management
#    test_students.py          — register / list / detail / delete
#    test_student_test_flow.py — deal / save / finish (+ e2e)
#    test_grading.py           — the scoring math
#    test_admin_questions.py   — dashboard + question bank
#    test_pictures.py          — image upload/serving + links
#    test_leaderboard.py       — public projector endpoints
#    test_routing.py           — routing + request plumbing
#    test_performance.py       — query-count budgets
#    test_contract.py          — responses validated against swagger.yaml
#    test_retention.py         — the delete_old_students sweep
#    test_known_bugs.py        — KNOWN BUGS pinned as expected
#                                failures (see its header)
############################################################
