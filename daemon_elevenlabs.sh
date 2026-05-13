#!/bin/sh
if [ "$USER" != "tectransit" ]; then
        exec sudo -u tectransit $0 $*
fi

# Setup node environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"


cd /srv/elevenlabs

# Run the server
export REPL_PORT=1338
# The rest of the variables is in .env

npx tsx web.ts /srv/elevenlabs/config.js >>/var/log/elevenlabs/server.log 2>&1
echo "Server Exited with code $?. Restarting it..." >>/var/log/elevenlabs/server.log

