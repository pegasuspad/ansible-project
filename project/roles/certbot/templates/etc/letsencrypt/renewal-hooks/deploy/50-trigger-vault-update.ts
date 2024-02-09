#!/usr/local/lib/npm/bin/ts-node

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

import path from 'path'
import fs from 'fs'

const renewedLineage = process.env.RENEWED_LINEAGE

const loadExistingTriggerFile = (filePath: string): string[] => {
  if (!fs.existsSync(filePath)) {
    console.log('No pre-existing trigger file found. Creating a new one.')
    return []
  }

  const oldContent = fs.readFileSync(filePath, 'utf-8')
  try {
    const parsed = JSON.parse(oldContent)
    if (!Array.isArray(parsed)) {
      console.warn(`Pre-existing trigger file did not contain a valid JSON array. Ignoring content: ${oldContent}`)
      return []
    }

    return parsed.map(value => String(value));
  } catch (err) {
    console.warn(`Error parsing pre-existing trigger file`, err)
    return []
  }
}

const DEFAULT_TRIGGER_FILE = '/etc/letsencrypt/updated-certs.json'
const triggerFile = '{{ certbot_updated_domains_file }}'.startsWith('{') ? DEFAULT_TRIGGER_FILE : '{{ certbot_updated_domains_file }}'

if (!renewedLineage) {
  throw new Error('Missing required environment variable: RENEWED_LINEAGE')
}

const host = path.basename(renewedLineage)
console.log(`Adding '${host}' to certificate trigger file: ${triggerFile}`)

const domains = Array.from(new Set([...loadExistingTriggerFile(triggerFile), host])).sort()
console.log(`New domains to update: ${JSON.stringify(domains)}`)

fs.writeFileSync(triggerFile, JSON.stringify(domains, null, 2), 'utf-8')
