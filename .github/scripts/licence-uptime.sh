#!/usr/bin/env bash
# Outside uptime check for the licence server, run by .github/workflows/licence-uptime.yml from GitHub's runners,
# so it still alerts when the Beelink itself is down (2026-10-08: offline 13 h, nobody told).
#
# Up means GET $HEALTH_URL answers 200 with {"ok": true}; the companion answers 503 when Keygen is down, and a dead
# box or Funnel gives no answer at all. A run counts as down only after $ATTEMPTS failed tries $RETRY_DELAY s apart,
# so one dropped request is not an outage.
#
# A down run exits 1, so the workflow's own run history is the state: the Discord message goes out only when the
# state changes (up -> down, down -> up), with PREVIOUS (success, failure or empty) the previous run's conclusion.
# ALERT_WEBHOOK_URL comes from a repository secret and goes to curl on stdin (--config -), never as an argument.
set -uo pipefail

HEALTH_URL=${HEALTH_URL:?HEALTH_URL is not set}
PREVIOUS=${PREVIOUS:-}
ATTEMPTS=${ATTEMPTS:-3}
RETRY_DELAY=${RETRY_DELAY:-30}
TEST_ALERT=${TEST_ALERT:-false}
url=${ALERT_WEBHOOK_URL:-}

post() {
  if [[ -z $url ]]; then
    echo "::warning::ALERT_WEBHOOK_URL is not set, so no Discord message was sent: $1"
    return 1
  fi
  # Only a Discord webhook URL of plain characters: nothing that could add curl options to the config below.
  if [[ ! $url =~ ^https://(discord|discordapp)\.com/api/webhooks/[A-Za-z0-9_/.-]+$ ]]; then
    echo "::error::ALERT_WEBHOOK_URL is not a Discord webhook URL"
    return 1
  fi
  local message
  message=$(printf '%s' "$1" | tr -cd 'A-Za-z0-9 .,:/()_>-')  # plain text only: it goes into JSON in a curl config
  if printf 'url = "%s"\nheader = "Content-Type: application/json"\ndata = "{\\"content\\":\\"%s\\"}"\n' "$url" "$message" |
    curl --silent --show-error --fail --max-time 20 --config - > /dev/null; then
    echo "Discord message sent"
  else
    echo "::error::the Discord message failed"
    return 1
  fi
}

if [[ $TEST_ALERT == true ]]; then
  post "Test from the licence uptime check: alerts reach this channel."
  exit
fi

answer=""
for ((try = 1; try <= ATTEMPTS; try++)); do
  answer=$(curl --silent --max-time 20 --write-out ' HTTP %{http_code}' "$HEALTH_URL" 2>&1)
  if [[ $answer =~ ^\{\"ok\":[[:space:]]*true\}\ HTTP\ 200$ ]]; then
    echo "up: $answer"
    if [[ $PREVIOUS == failure ]]; then
      post "Licence server is back UP: $HEALTH_URL answers again." || true  # the server is fine; do not fail the run
    fi
    exit 0
  fi
  echo "try $try of $ATTEMPTS failed: ${answer:0:200}"
  ((try < ATTEMPTS)) && sleep "$RETRY_DELAY"
done

code=${answer##* HTTP }
case $code in
  000) why="no answer (box, network or Funnel down)" ;;
  503) why="503: the companion is up but Keygen is not" ;;
  *)   why="HTTP $code" ;;
esac
echo "::error::licence server DOWN: $why"
if [[ $PREVIOUS != failure ]]; then
  post "Licence server is DOWN: $HEALTH_URL gave $why on $ATTEMPTS tries." || true
fi
exit 1
