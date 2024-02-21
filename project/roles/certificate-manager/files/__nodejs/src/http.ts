import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import nodeFetch, { RequestInit } from 'node-fetch'

/**
 * Return an array of strings, each of which contains a custom trusted root CA certificate. The default trusted
 * certs will be overridden by this array. If 'undefined' is returned, the defaults will not be changed.
 * 
 * This method works by looking for any files in a specific directory, and returning their contents as a cert. 
 * The directory defaults to '/usr/local/share/ca-certificates', but can be overridden by setting the
 * CA_CERTIFICATE_INSTALL_PATH environment variable. If the configured directory is empty (or does not exist), 
 * undefined is returned.
 */
const getTrustedCaCertificates = (): string[] | undefined => {
  const certRoot = process.env.CA_CERTIFICATE_INSTALL_PATH ?? '/usr/local/share/ca-certificates'
  if (!fs.existsSync(certRoot)) {
    return undefined;
  }

  const files = fs.readdirSync(certRoot);
  return files.length === 0 ? undefined : files.map(file => fs.readFileSync(path.join(certRoot, file), 'utf-8'))
}

const createFetch = (defaultOptions: RequestInit):  typeof nodeFetch => {
  const trustedCertificates = getTrustedCaCertificates();
  const agent = trustedCertificates === undefined ? undefined : new https.Agent({
    ca: trustedCertificates
  })

  return (url, init) => nodeFetch(url, {
    agent,
    ...defaultOptions,
    ...init
  })
}
export const get: typeof nodeFetch = createFetch({ method: 'GET' })
export const post: typeof nodeFetch = createFetch({ method: 'POST' })
export const put: typeof nodeFetch = createFetch({ method: 'PUT' })
