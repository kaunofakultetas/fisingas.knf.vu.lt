############################################################
#  [*] Timestamps — the one place that knows the policy
#
#  Every timestamp column is a DateTimeField (timestamptz in
#  PostgreSQL). Values are stored as aware UTC, whole seconds.
#  The API publishes them as ISO-8601 in Europe/Vilnius with
#  the explicit offset, e.g. "2026-08-26T19:09:07+03:00" —
#  human-readable, DST-proof, and parsed identically by every
#  browser's Date regardless of the viewer's own timezone.
#  A never-set value is null (never "").
#
#  Comparisons (the dashboard's 30-minute window, the
#  retention sweep) are done on real datetimes — no string
#  ordering tricks, no DST fall-back ambiguity.
############################################################


from django.utils import timezone








############################################################
# now
############################################################
#
# The current moment as stored in every timestamp column:
# aware UTC, truncated to whole seconds so the database value
# equals what the API shows for it.
#
# Used by:
#   - every view that stamps lastseen / registration /
#     finished_at / created
#   - admin_home and delete_old_students (cutoffs)
############################################################

def now():
    return timezone.now().replace(microsecond=0)








############################################################
# to_api
############################################################
#
# A stored timestamp as the API publishes it: ISO-8601 in the
# local (Europe/Vilnius) zone with the explicit UTC offset.
# None stays None — the wire value for "never".
#
# Used by:
#   - every serializer that emits a timestamp field
############################################################

def to_api(value):
    if value is None:
        return None
    return timezone.localtime(value).replace(microsecond=0).isoformat()
