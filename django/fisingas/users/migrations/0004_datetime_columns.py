############################################################
#  [*] Migration — timestamp columns become real datetimes
#
#  SystemUser.last_login, Student.last_login and
#  Student.registration_time
#
#  were CharField(32) holding "YYYY-MM-DD HH:MM:SS" in local
#  Europe/Vilnius time ("" = never). They become
#  DateTimeField(null=True) — timestamptz in PostgreSQL —
#  storing aware UTC; "" becomes NULL.
#
#  The database work is vendor-specific, chosen when the
#  module loads (the model-state change is the same either way):
#
#  PostgreSQL — one ALTER per column with an explicit
#    `AT TIME ZONE 'Europe/Vilnius'`. The plain ::timestamptz
#    cast would read the old strings in the CONNECTION's zone,
#    which Django sets to UTC, and shift every value by 2-3 h.
#
#  SQLite (the test database) — ordinary AlterField operations
#    rebuild the columns, then a RunPython rewrites the copied
#    text: "" → NULL, local text → the naive-UTC text Django
#    stores for aware datetimes on SQLite.
#
#  Reversible on both — the strings are rebuilt in local time.
############################################################


from datetime import datetime
from zoneinfo import ZoneInfo

from django.db import connection, migrations, models


LOCAL = ZoneInfo("Europe/Vilnius")
UTC = ZoneInfo("UTC")
APP = "users"

# (model name, field name)
COLUMNS = [('SystemUser', 'last_login'), ('Student', 'last_login'), ('Student', 'registration_time')]


############################################################
# PostgreSQL
############################################################

def pg_forwards(apps, schema_editor):
    for model_name, column in COLUMNS:
        table = apps.get_model(APP, model_name)._meta.db_table
        schema_editor.execute(
            f'ALTER TABLE "{table}" '
            f'ALTER COLUMN "{column}" DROP NOT NULL, '
            f'ALTER COLUMN "{column}" TYPE timestamp with time zone '
            f'USING (NULLIF("{column}", \'\')::timestamp AT TIME ZONE \'Europe/Vilnius\')'
        )


def pg_backwards(apps, schema_editor):
    for model_name, column in COLUMNS:
        table = apps.get_model(APP, model_name)._meta.db_table
        schema_editor.execute(
            f'ALTER TABLE "{table}" '
            f'ALTER COLUMN "{column}" TYPE varchar(32) '
            f'USING COALESCE(to_char("{column}" AT TIME ZONE \'Europe/Vilnius\', \'YYYY-MM-DD HH24:MI:SS\'), \'\'), '
            f'ALTER COLUMN "{column}" SET NOT NULL'
        )


############################################################
# SQLite
############################################################

def _rewrite_values(schema_editor, table, column, convert):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f'SELECT "id", "{column}" FROM "{table}"')
        rows = cursor.fetchall()
        for row_id, value in rows:
            cursor.execute(f'UPDATE "{table}" SET "{column}" = %s WHERE "id" = %s', [convert(value), row_id])


def _local_text_to_utc_text(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC).replace(tzinfo=None).isoformat(" ")
    local = datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=LOCAL)
    return local.astimezone(UTC).replace(tzinfo=None).isoformat(" ")


def _utc_text_to_local_text(value):
    if value in (None, ""):
        return ""
    if not isinstance(value, datetime):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(LOCAL).strftime("%Y-%m-%d %H:%M:%S")


def sqlite_forwards(apps, schema_editor):
    for model_name, column in COLUMNS:
        _rewrite_values(schema_editor, apps.get_model(APP, model_name)._meta.db_table, column, _local_text_to_utc_text)


def sqlite_backwards(apps, schema_editor):
    for model_name, column in COLUMNS:
        _rewrite_values(schema_editor, apps.get_model(APP, model_name)._meta.db_table, column, _utc_text_to_local_text)


############################################################
# The migration
############################################################

ALTER_FIELDS = [
    migrations.AlterField(
        model_name="systemuser",
        name="last_login",
        field=models.DateTimeField(blank=True, null=True),
    ),
    migrations.AlterField(
        model_name="student",
        name="last_login",
        field=models.DateTimeField(blank=True, null=True),
    ),
    migrations.AlterField(
        model_name="student",
        name="registration_time",
        field=models.DateTimeField(blank=True, null=True),
    ),
]


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_student_registration_time"),
    ]

    if connection.vendor == "postgresql":
        operations = [
            migrations.SeparateDatabaseAndState(
                state_operations=ALTER_FIELDS,
                database_operations=[migrations.RunPython(pg_forwards, pg_backwards)],
            ),
        ]
    else:
        operations = ALTER_FIELDS + [migrations.RunPython(sqlite_forwards, sqlite_backwards)]
