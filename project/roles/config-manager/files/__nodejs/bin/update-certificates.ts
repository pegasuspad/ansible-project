#!/usr/bin/env -S npx --yes --silent ts-node

import '../src/config'

import { logger } from '../src/logger'
import { readRepositoryFile } from '../src/github/read-repository-file';
import { writeRepositoryFile } from '../src/github/write-repository-file';
import { updateYamlValues } from '../src/update-yaml-values';
import { vaultEncrypt } from '../src/vault-encrypt';

// Webhook handler which takes a set of key/certificate pairs for one or more domains, and updates them
// in the Ansible configuration.
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
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.VAULT_REPOSITORY_OWNER
  const repository = process.env.VAULT_REPOSITORY_NAME
  const path = process.env.VAULT_REPOSITORY_PATH ?? 'vault.yml'
  const vaultId = process.env.VAULT_ID
  const passwordFile = process.env.VAULT_PASSWORD_FILE

  if (!token) {
    throw new Error('Missing configuration: GITHUB_TOKEN')
  }
  if (!owner) {
    throw new Error('Missing configuration: VAULT_REPOSITORY_OWNER')
  }
  if (!repository) {
    throw new Error('Missing configuration: VAULT_REPOSITORY_NAME')
  }
  if (!passwordFile) {
    throw new Error('Missing configuration: VAULT_PASSWORD_FILE')
  }

  const payload = parsePayload();

  const updatedDomains = payload.certificates.map(certificate => certificate.domain)
  logger.info({ domains: updatedDomains }, `Updating TLS certificates for ${updatedDomains.length} domains.`);

  logger.info('Encrypting server keys for storage in Vault.')
  const withEncryptedKeys = await Promise.all(payload.certificates.map(async ({ key, ...certificate }) => {
    const encryptedKey = await vaultEncrypt({
      passwordFile,
      value: key,
      vaultId
    })

    return {
      ...certificate,
      key,
      encryptedKey
    }
  }))

  logger.info('Retrieving previous vault content.')
  const oldVault = await readRepositoryFile({
    owner,
    path,
    repository,
    token
  })

  const valuesToUpdate = withEncryptedKeys.flatMap(({ certificate, domain, encryptedKey }) => {
    return [
      {
        key: ['__vault__', 'reverse_proxy_tls_certs', domain, 'cert'],
        value: certificate
      },
      {
        key: ['__vault__', 'reverse_proxy_tls_certs', domain, 'key'],
        tag: '!vault',
        value: encryptedKey
      }
    ]
  })

  logger.info('Save new vault content.')
  const newVault = updateYamlValues({
    content: oldVault,
    updatedValues: valuesToUpdate
  })

  await writeRepositoryFile({
    content: newVault,
    message: `Updated TLS certificates: ${updatedDomains.join(', ')}`,
    owner,
    path,
    repository,
    token
  })

  logger.info({ domains: updatedDomains }, 'Certificate update complete.')

  return {
    updatedCertificates: updatedDomains
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