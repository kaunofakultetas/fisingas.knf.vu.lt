############################################################
#  [*] Known bugs — pinned as EXPECTED FAILURES
#
#  The ledger of defects that are known but not fixed yet.
#  Every test here asserts the CORRECT behaviour and is
#  decorated with @expectedFailure, so the suite stays green
#  while each defect stays documented and executable.
#
#  When one of these bugs gets fixed, its test flips to
#  "unexpected success" and FAILS the suite — the fix is
#  then completed by moving the test (minus the decorator)
#  into the proper topic file.
#
#  One numbered class per bug (KB-01 ...), each banner
#  stating: WHERE the defect lives, the TRIGGER, the IMPACT
#  and a SUGGESTED FIX.
#
#  Currently EMPTY: KB-01 .. KB-16 have all been fixed and
#  their tests promoted (login body checks → test_auth,
#  username length and the finished-without-frozen-row
#  fallback → test_students, save value checks →
#  test_student_test_flow, links validation and the 405 →
#  test_pictures, the points floor → test_grading, the
#  administrator field checks → test_administrators, the
#  question-action body checks and the test-size overflow →
#  test_admin_questions, the question_id index →
#  test_performance). KB-09 (X_FRAME_OPTIONS) was resolved by
#  removing the inert setting — framing is governed by the
#  Caddy CSP.
############################################################
