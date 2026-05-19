# This script runs under cron.
# So many usual environment variables for user `tectransit` are not available
# We have to restore the necessary environment
export USER=`/usr/bin/whoami`
export HOSTNAME=`/usr/bin/hostname`
export SECONDS_BACK=600

if [ "$USER" != "tectransit" ]; then
        exec sudo -u tectransit $0 $*
fi

# Setup node environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /srv/elevenlabs

export REPL_PORT=-1
export LIMIT=2
export CALL_SUCCESSFUL=failure
export CALL_START_AFTER_UNIX=$((`date +%s`-${SECONDS_BACK}))
export CALL_DURATION_MIN_SECS=0
# The rest of the variables is in .env

FAILED_CALLS=`npm run monitor`
FAILED_COUNT=$?
if [ "${FAILED_COUNT}" -eq 0 ]; then
	echo "No failed calls within the last ${SECONDS_BACK} seconds from ${HOSTNAME}"
else
        export MONITORING_EMAIL=constantine@tectransit.com
	echo -e "To: ${MONITORING_EMAIL}\nSubject:There are ${FAILED_COUNT} failed calls within the last ${SECONDS_BACK} seconds from ${HOSTNAME}\n${FAILED_CALLS}\nPlease Check ${HOSTNAME}" | /usr/sbin/sendmail ${MONITORING_EMAIL}
        export MONITORING_EMAIL=mkhesin@intempus.net
	echo -e "To: ${MONITORING_EMAIL}\nSubject:There are ${FAILED_COUNT} failed calls within the last ${SECONDS_BACK} seconds from ${HOSTNAME}\nPlease Check ${HOSTNAME}" | /usr/sbin/sendmail ${MONITORING_EMAIL}
fi

