#!/usr/bin/env -S npx --silent ts-node

import '../src/config'

import { logger } from '../src/logger'
import { readRepositoryFile } from '../src/github/read-repository-file';
import { writeRepositoryFile } from '../src/github/write-repository-file';
import { updateYamlValues, ValueToUpdate } from '../src/update-yaml-values';
import { vaultEncrypt } from '../src/vault-encrypt';

// Webhook handler which takes a set of key/value pairs for one or more vault secrets, and updates those
// variables within the Ansible vault. 
//
// This handler expects to receive an environment variable named `PAYLOAD`. This is a JSON string defining
// an object with the following fields:
// 
//   - `comment`: comment to use for the git commit, which defaults to "update secrets via webhook"
//   - `variables`: an array of updated variables, as defined below
//
// Each variable entry must have the following fields:
//
//   - `key`: Key of the secret to update. Nested paths may be represented as an string array (with each element
//      containing the key at one level of nesting) or as a dot-separated path (such as key.child.subkey). The
//      array form allows keys to include dots, whereas the string form does not. All values in the vault are nested
//      under a top level key called "__vault__".
//   - `value`: New value to set at the document path represented by `key`. The value will be encrypted with the
//      `ansible-vault` utility before it is stored.

interface UpdateSecretsPayload {
  /**
   * Comment to use for the git commit.
   * @defaultValue "update secrets via webhook"
   */
  comment?: string;

  /**
   * List of secret variables to update
   */
  variables: Pick<ValueToUpdate, 'key' | 'value'>[]
}

function validatePayload (maybePayload: any): asserts maybePayload is UpdateSecretsPayload {
  if (!Array.isArray(maybePayload.variables)) {
    throw new Error('Invalid Payload')
  }

  if (maybePayload.comment !== undefined && (typeof maybePayload.comment !== 'string')) {
    throw new Error('Invalid Payload')
  }

  maybePayload.variables.forEach((variable: any) => {
    if ((typeof variable.value !== 'string') || ((typeof variable.key !== 'string') && (!Array.isArray(variable.key)))) {
      throw new Error('Invalid Payload')
    } 

    if (Array.isArray(variable.key)) {
      variable.key.forEach((keyPart: any) => {
        if (typeof keyPart !== 'string') {
          throw new Error('Invalid Payload')
        }
      })
    }
  })
}

const parsePayload = (): UpdateSecretsPayload => {
  const payloadString = process.env.PAYLOAD

  // webhook library sends the string 'null' if the payload is missing or if it is not valid JSON
  if (payloadString === undefined || payloadString === null || payloadString === "null" || payloadString.trim().length === 0) {
    throw new Error('Payload is invalid or missing.')
  }

  let payload: UpdateSecretsPayload
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

  logger.info(`Updating ${payload.variables.length} secrets.`);

  logger.info('Encrypting values for storage in Vault.')
  const withEncryptedValues = await Promise.all(payload.variables.map(async ({ value, ...item }) => {
    const encryptedValue = await vaultEncrypt({
      passwordFile,
      value,
      vaultId
    })

    return {
      ...item,
      value,
      encryptedValue
    }
  }))

  logger.info('Retrieving previous vault content.')
  const oldVault = await readRepositoryFile({
    owner,
    path,
    repository,
    token
  })

  const valuesToUpdate = withEncryptedValues.flatMap(({ key, encryptedValue }) => {
    const keyAsArray = Array.isArray(key) ? key : key.split('.')
    return [
      {
        key: ['__vault__', ...keyAsArray],
        tag: '!vault',
        value: encryptedValue
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
    message: payload.comment || 'update secrets via webhook',
    owner,
    path,
    repository,
    token
  })

  logger.info('Secrets update complete.')

  return {
    count: valuesToUpdate.length
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