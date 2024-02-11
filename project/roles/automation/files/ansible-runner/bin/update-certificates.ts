#!/usr/bin/env -S npx --silent ts-node

import { execSync } from 'node:child_process'

// Webhook handler which takes a set of key/certificate pairs for one or more domains, and deploys them.
// Deployment of a certificate includes the following steps:
//
//   - Save each key/certificate pair in the Ansible vault
//   - Reconfigure reverse-proxy hosts with the new vault values, after all certificate pairs are saved
//
// This handler expects to receive an environment variable named `PAYLOAD`. This is a JSON string defining
// an object with the following fields:
// 
//   - `certificates`: an array of updated certificates, as defined below
//
// Each certificate entry must have the following fields:
//
//   - `domain`: name of the certificate, which is a fully qualified domain name (e.g. foo.pegasuspad.com)
//   - `certificate`: content of the newly generated certificate
//   - `key`: content of the newly generated server private key

interface UpdatedCertificate {
  /**
   * content of the newly generated certificate
   */
  certificate: string;

  /**
   * name of the certificate, which is a fully qualified domain name (e.g. foo.pegasuspad.com)
   */
  domain: string;

  /**
   * content of the newly generated server private key
   */
  key: string;
}

interface UpdatedCertificatesPayload {
  /**
   * List of certificates which have been updated
   */
  certificates: UpdatedCertificate[]
}

function validatePayload (maybePayload: any): asserts maybePayload is UpdatedCertificatesPayload {
  if (!Array.isArray(maybePayload.certificates)) {
    throw new Error('Invalid Payload')
  }

  maybePayload.certificates.forEach((certificate: any) => {
    if ((typeof certificate.certificate !== 'string') || (typeof certificate.domain !== 'string') || (typeof certificate.key !== 'string')) {
      throw new Error('Invalid Payload')
    } 
  })
}

const parsePayload = (): UpdatedCertificatesPayload => {
  const payloadString = process.env.PAYLOAD

  // webhook library sends the string 'null' if the payload is missing or if it is not valid JSON
  if (payloadString === undefined || payloadString === null || payloadString === "null" || payloadString.trim().length === 0) {
    throw new Error('Payload is invalid or missing.')
  }

  let payload: UpdatedCertificatesPayload
  try {
     payload = JSON.parse(payloadString)
  } catch (err) {
    // webhook invoker does not pass invalid JSON, but we handle this anyway to future proof our handler in case that changes
    throw new Error('Invalid Payload')
  }

  validatePayload(payload)
  return payload
}

const handler = async () => {
  const payload = parsePayload();
  // payload.certificates.forEach(certificate => {
  //   console.log(`Updated: ${certificate.domain}`)
  // })

  payload.certificates.forEach(({ certificate, domain, key }) => {
    try {
      console.log(execSync('/etc/webhook/hooks/put-secret', {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          COMMENT: `updating certificate for ${domain}`,
          KEY: `vault__reverse_proxy_tls_certs.${domain}.cert`,
          VALUE: certificate
        }
      }))
    
      console.log(execSync('/etc/webhook/hooks/put-secret', {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          COMMENT: `updating key for ${domain}`,
          KEY: `vault__reverse_proxy_tls_certs.${domain}.key`,
          VALUE: key
        }
      }))
    } catch (err: any) {
      throw new Error(`Failed to update certificate for ${domain}: ${err.message}`)
    }
  })

  return {
    updatedCertificates: payload.certificates.map(certificate => certificate.domain)
  }
}

handler()
  .then((data) => {
    console.log(JSON.stringify({ data, status: 'OK' }))
  })
  .catch(err => {
    console.log(JSON.stringify({
      error: err.message ?? 'Unknown Error',
      status: 'ERROR'
    }))

    process.exit(1)
  })