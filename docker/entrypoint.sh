#!/bin/sh
set -e
envsubst '${CRM_API_URL} ${OPAC_API_URL} ${OPAC_APP_URL} ${CRM_APP_URL}' \
  < /usr/share/nginx/html/config.json.template \
  > /usr/share/nginx/html/config.json
exec nginx -g "daemon off;"
