import * as dotenv from 'dotenv'

import path from 'path'

dotenv.config({
  path: ['/etc/opt/ansible-runner-role/env', path.join(__dirname, '..', 'default.env')]
})
