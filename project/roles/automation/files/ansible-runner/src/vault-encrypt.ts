import fs from 'node:fs'
import { promisify } from 'node:util'
import * as yaml from 'yaml'
import { logger } from './logger'
import { execFile as execFileRaw } from 'node:child_process'

const execFile = promisify(execFileRaw)

/**
 * Options used to encrypt values for an Ansible vault.
 */
export interface VaultEncryptOptions {
  /**
   * Absolute path to the file containing the vault password.
   */
  passwordFile: string;

  /**
   * Value to encrypt
   */
  value: string

  /**
   * ID of the vault to use for encryption
   * @defaultValue "default"
   */
  vaultId?: string;
}

function isExecError(err: any): err is { code: number, stderr: string } {
  return !!err.stderr && !!err.code
}

/**
 * Encrypts a value for storage in an Ansible vault by invoking the `ansible-vault` CLI utility. Ansible must
 * be installed for this to succeed.
 * 
 * @return the input value, encrypted for storage in Ansible vault
 */
export const vaultEncrypt = async ({
  passwordFile,
  value,
  vaultId = 'default'
}: VaultEncryptOptions): Promise<string> => {
  if (value.length === 0) {
    const message = 'Ansible vault cannot encrypt an empty value.'
    logger.error(message)
    throw new Error(message)
  }

  if (!fs.existsSync(passwordFile)) {
    const message = `Specified Vault password file does not exist: ${passwordFile}.`
    logger.error(message)
    throw new Error(message)
  }

  const fileStat = fs.statSync(passwordFile);
  if (!fileStat.isFile()) {
    const message = `Specified Vault password file is not a file: ${passwordFile}.`
    logger.error(message)
    throw new Error(message)
  }

  logger.debug(`Encrypting value for storage in Ansible vault.`)

  try {
    const vaultProcessPromise = execFile('ansible-vault', [
      'encrypt_string',
      '--vault-id',
      `${vaultId}@${passwordFile}`,
      '--stdin-name',
      'ciphertext'
    ])
    const vaultProcess = vaultProcessPromise.child

    // pass our unencrypted value via stdin
    vaultProcess.stdin?.write(value);
    vaultProcess.stdin?.end();

    const { stdout } = await vaultProcessPromise

    // `ansible-vault encrypt_string ...` will return a single-key Yaml document that includes a tagged value
    // to ensure proper handling of Yaml output, we pass this to a proper parsing library and then extract our single value

    const encryptedContent = stdout.trim()
    const document = yaml.parseDocument(encryptedContent);
    const ciphertext = String(document.get('ciphertext'))

    logger.debug({ ciphertext: { length: ciphertext.length} }, `Encryption successful.`)

    return ciphertext
  } catch (err: any) {
    if (isExecError(err)) {
      logger.error(err.stderr);
      throw new Error(`ansible-vault: exited with code ${err.code}`)
    }

    throw new Error(`ansible-vault: error invoking command [${String(err.message)}]`)
  }
}
