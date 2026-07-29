# ------------------------------------------------------------
#  [*] Cron — scheduled jobs
#
#  Tiny scheduler container: busybox crond + docker CLI.
#  Runs `docker exec` into other containers on schedule
#  (see ./crontab). Needs /var/run/docker.sock mounted.
#
#  The crontab is baked in at build time so it is owned by
#  root — busybox crond silently ignores crontab files with
#  other owners.
# ------------------------------------------------------------

FROM docker:29-cli

COPY crontab /etc/crontabs/root
RUN chmod 600 /etc/crontabs/root

CMD ["crond", "-f", "-d", "8"]
