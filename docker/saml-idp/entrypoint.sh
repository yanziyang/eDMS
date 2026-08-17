#!/usr/bin/env bash
set -euo pipefail

# The certificate is intentionally generated into the shared development volume.
# It is used only to sign assertions from this local test IdP; no private key is
# stored in the repository. The API consumes the public certificate from /shared.
mkdir -p /shared /var/simplesamlphp/cert
if [[ ! -s /shared/server.crt || ! -s /shared/server.pem ]]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
    -days 3650 \
    -subj "/CN=edms-saml-idp" \
    -keyout /shared/server.pem \
    -out /shared/server.crt
  chmod 600 /shared/server.pem
fi
cp /shared/server.crt /var/simplesamlphp/cert/server.crt
cp /shared/server.pem /var/simplesamlphp/cert/server.pem

exec /opt/simplesaml/ssp-startup.sh
