#!/usr/bin/env -S npx --yes ts-node --esm

// Adds a domain to the list of those with updated certs. The list is a json file containing a single array.
// The location of this file is intended to be set via an Ansible template variable (`certbot_updated_domains_file`).
// If this variable replacement does not occur, then a default path will be used instead.
//
// A cron job periodically checks this list, and updates the proxy server configuration
// with the new configuration.

// This script is configured via environment variables as follows:
//
//  - RENEWED_DOMAINS: space-delimited list of fully-qualified domain names to which the new cert applies
//  - RENEWED_LINEAGE: full path to the updated certs (e.g. /etc/letsencrypt/live/foo.pegasuspad.com)
//

import '../src/config.js'

import path from 'path'
import fs from 'fs'
import { logger } from '../src/logger.js'
import { loadUpdatedCertificates } from '../src/load-updated-certificates.js'

const updatedCertificatesFile = process.env.UPDATED_CERTIFICATES_FILE
const renewedLineage = process.env.RENEWED_LINEAGE

if (!updatedCertificatesFile) {
  throw new Error('Missing required environment variable: UPDATED_CERTIFICATES_FILE')
}

if (!renewedLineage) {
  throw new Error('Missing required environment variable: RENEWED_LINEAGE')
}

const updatedCertificates = loadUpdatedCertificates();

const host = path.basename(renewedLineage)
logger.info(`Adding '${host}' to certificate update file: ${updatedCertificatesFile}`)

const newUpdatedCertificates = Array.from(new Set([...updatedCertificates, host])).sort()
logger.info(`New updated certificates list: ${JSON.stringify(newUpdatedCertificates)}`)

fs.writeFileSync(updatedCertificatesFile, JSON.stringify(newUpdatedCertificates, null, 2), 'utf-8')

console.log(`Updated certificate change list. See ${process.env.LOG_FILE} for details.`)