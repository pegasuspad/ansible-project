#!/usr/bin/env bash

# Sample inputs:
# RENEWED_DOMAINS=boox.lab.pegasuspad.com boox2.lab.pegasuspad.com boox3.lab.pegasuspad.com
# RENEWED_LINEAGE=/etc/letsencrypt/live/boox.lab.pegasuspad.com

CERTIFICATE_NAME="$(basename "$RENEWED_LINEAGE")"
SANITIZED_NAME=$(sed -E 's/[^[:alnum:][:space:]]+/_/g' <<<"${CERTIFICATE_NAME}")
TOKEN='{{ certbot_webhook_token }}'
URL='{{ __certbot_url }}'

# use jq to convert our data into the 'put-secret' format, and then post to our control node

jq --null-input \
  --arg COMMENT "deploying updated certificate for: ${CERTIFICATE_NAME}" \
  --arg KEY "vault__certbot_${SANITIZED_NAME}_cert" \
  --arg VALUE "$(cat "${RENEWED_LINEAGE}/fullchain.pem")" \
  '{comment: $COMMENT, key: $KEY, value: $VALUE}' \
  | \
  curl -i -X POST \
  -H 'Content-type: application/json' \
  -H "X-Token: ${TOKEN}" \
  -d @- \
  "${URL}" >> /var/log/certbot-hook.log

jq --null-input \
  --arg COMMENT "deploying updated key for: ${CERTIFICATE_NAME}" \
  --arg KEY "vault__certbot_${SANITIZED_NAME}_key" \
  --arg VALUE "$(cat "${RENEWED_LINEAGE}/privkey.pem")" \
  '{comment: $COMMENT, key: $KEY, value: $VALUE}' \
  | \
  curl -i -X POST \
  -H 'Content-type: application/json' \
  -H "X-Token: ${TOKEN}" \
  -d @- \
  "${URL}" >> /var/log/certbot-hook.log

