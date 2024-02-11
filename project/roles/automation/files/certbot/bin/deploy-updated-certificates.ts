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

import { config } from 'dotenv'

import path from 'path'
import fs from 'fs'
import { loadUpdatedCertificates } from '../src/load-updated-certificates'

config({
  path: ['/etc/opt/certbot-role/env', path.join(__dirname, '..', 'default.env')]
})

const updatedCertificates = loadUpdatedCertificates();
