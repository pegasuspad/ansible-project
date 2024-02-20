#!/usr/bin/env -S npx ts-node

// Deploys all certificates in the updated certificates file. Deployment is done by saving the new key
// and certificate data in the Ansible controller's vault, and then triggering a reconfiguration of the
// reverse proxy host.
//
// This job is meant to be run on a high(-ish) frequency cron. At least as frequently as the certificate
// renewal cron job.

// This script is configured via environment variables as follows:
//
//  - UPDATED_CERTIFICATES_FILE: path to a JSON file containing an array of certs to update
//

import '../src/config'

import path from 'path'
import fs from 'fs'
import { loadUpdatedCertificates } from '../src/load-updated-certificates'
import { logger } from '../src/logger'

const handler = async () => {
  const certificateInstallUrl = process.env.CERTIFICATE_INSTALL_URL
  const certificatePath = process.env.CERTIFICATE_PATH
  const configManagerToken = process.env.CONFIG_MANAGER_TOKEN
  const proxyDeployUrl = process.env.PROXY_DEPLOY_URL
  const updatedCertificatesFile = process.env.UPDATED_CERTIFICATES_FILE

  if (!certificateInstallUrl) {
    throw new Error('Missing required environment variable: CERTIFICATE_INSTALL_URL')
  }
  if (!certificatePath) {
    throw new Error('Missing required environment variable: CERTIFICATE_PATH')
  }
  if (!configManagerToken) {
    throw new Error('Missing required environment variable: CONFIG_MANAGER_TOKEN')
  }
  if (!proxyDeployUrl) {
    throw new Error('Missing required environment variable: PROXY_DEPLOY_URL')
  }
  if (!updatedCertificatesFile) {
    throw new Error('Missing required environment variable: UPDATED_CERTIFICATES_FILE')
  }

  logger.debug(`Checking for updated certificates in ${updatedCertificatesFile}`)

  const updatedCertificates = loadUpdatedCertificates();
  if (updatedCertificates.length > 0) {
    logger.info(`Found ${updatedCertificates.length} updated certificate(s): ${updatedCertificates.join(', ')}`)

    const payload = {
      certificates: updatedCertificates.map((domain) => {
        const certificate = fs.readFileSync(path.join(certificatePath, domain, 'fullchain.pem'), 'utf-8');
        const key = fs.readFileSync(path.join(certificatePath, domain, 'privkey.pem'), 'utf-8');

        return {
          domain,
          certificate,
          key
        }
      })
    }

    const result = await fetch(certificateInstallUrl, {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'X-Token': configManagerToken
      },
      method: 'PUT',
    })
    if (!result.ok) {
      logger.error(`Certificate webhook invocation failed: ${result.status} ${result.statusText}`)
      throw new Error(`Certificate webhook invocation failed: ${result.status} ${result.statusText}`)
    }
    logger.info('Successfully saved new certificates in vault.')

    const provisionResult = await fetch(proxyDeployUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Token': configManagerToken
      },
      method: 'POST',
    })
    if (!provisionResult.ok) {
      logger.error(`Proxy deployment webhook invocation failed: ${provisionResult.status} ${provisionResult.statusText}`)
      throw new Error(`Proxy deployment webhook invocation failed: ${provisionResult.status} ${provisionResult.statusText}`)
    }
    logger.info('Successfully redeployed proxy server.')

    // @todo race condition if a cert updates at the same time
    fs.writeFileSync(updatedCertificatesFile, JSON.stringify([], null, 2), 'utf-8')
  }
}

handler()
  .catch(err => {
    console.error(`Failed to update certificates: ${String(err.message)}`, err)
    process.exit(1)
  })