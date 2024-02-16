import * as dotenv from 'dotenv'

import path from 'path'

dotenv.config({
  debug: true,
  encoding: 'utf-8',
  path: [
    '/etc/opt/ansible-runner-role/env',
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env.default')
  ]
})
