import fs from 'fs'
import path from 'path'
import { pino } from 'pino'
import './config.js'

// make sure the directory containing our log file exists
// receives a "sonic boom" error from pino otherwise
if (process.env.LOG_FILE) {
  fs.mkdirSync(path.dirname(process.env.LOG_FILE), { recursive: true })  
}

// creates a logger with the given log level ('info') default that logs to
// LOG_FILE (stdout by default)
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info'
}, pino.destination({
  dest: process.env.LOG_FILE ?? 1,
  sync: true
}))
