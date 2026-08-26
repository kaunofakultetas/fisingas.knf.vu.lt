############################################################
#  [*] Regression tests — the timestamp policy
#
#  common/timestamps.py: aware UTC whole seconds in the
#  database, ISO-8601 with the Europe/Vilnius offset on the
#  wire, null for "never". Both DST offsets are pinned.
############################################################


from datetime import datetime, timezone as dt_timezone

from django.test import TestCase
from django.utils import timezone

from fisingas.common.timestamps import now, to_api

from .utils import is_recent, local


class NowTests(TestCase):

    def test_now_is_aware_utc_with_whole_seconds(self):
        value = now()
        self.assertTrue(timezone.is_aware(value))
        self.assertEqual(value.utcoffset().total_seconds(), 0)
        self.assertEqual(value.microsecond, 0)
        self.assertTrue(is_recent(value))


class ToApiTests(TestCase):

    def test_summer_offset(self):
        self.assertEqual(to_api(local("2026-08-26 19:09:07")), "2026-08-26T19:09:07+03:00")

    def test_winter_offset(self):
        self.assertEqual(to_api(local("2026-01-15 10:00:00")), "2026-01-15T10:00:00+02:00")

    def test_utc_input_is_rendered_in_local_time(self):
        # What the database hands back (UTC) comes out as Vilnius time
        stored = datetime(2026, 8, 26, 16, 9, 7, tzinfo=dt_timezone.utc)
        self.assertEqual(to_api(stored), "2026-08-26T19:09:07+03:00")

    def test_microseconds_are_dropped(self):
        stored = datetime(2026, 8, 26, 16, 9, 7, 123456, tzinfo=dt_timezone.utc)
        self.assertEqual(to_api(stored), "2026-08-26T19:09:07+03:00")

    def test_never_is_null(self):
        self.assertIsNone(to_api(None))

    def test_dst_fall_back_hour_is_unambiguous(self):
        # 2026-10-25 03:30 local happens twice (EEST → EET). Stored
        # as UTC the two moments stay distinct and each renders with
        # its own offset — the old wall-clock strings could not tell
        # them apart
        first = datetime(2026, 10, 25, 0, 30, tzinfo=dt_timezone.utc)    # still EEST
        second = datetime(2026, 10, 25, 1, 30, tzinfo=dt_timezone.utc)   # already EET
        self.assertEqual(to_api(first), "2026-10-25T03:30:00+03:00")
        self.assertEqual(to_api(second), "2026-10-25T03:30:00+02:00")
        self.assertLess(first, second)
