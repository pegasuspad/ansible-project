import * as dotenv from 'dotenv'

import path from 'path'

dotenv.config({
  debug: false,
  encoding: 'utf-8',
  path: [
    '/etc/opt/config-manager/env',
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env.default')
  ]
})
