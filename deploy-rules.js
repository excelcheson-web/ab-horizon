#!/usr/bin/env node
/* global process */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'td-project-pro'
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const nodeOptions = new Set((process.env.NODE_OPTIONS || '').split(/\s+/).filter(Boolean))
nodeOptions.add('--use-system-ca')

const rulesPath = join(rootDir, 'firestore.rules')
if (!existsSync(rulesPath)) {
  console.error('firestore.rules file not found.')
  process.exit(1)
}

console.log(`Deploying Firestore rules to ${projectId}...`)

try {
  execFileSync(
    npxBin,
    [
      '--yes',
      'firebase-tools',
      'deploy',
      '--only',
      'firestore:rules',
      '--project',
      projectId,
      '--non-interactive',
    ],
    {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        NODE_OPTIONS: Array.from(nodeOptions).join(' '),
      },
    }
  )
  console.log('Firestore rules deployed successfully.')
} catch (err) {
  console.error('Firestore rules deployment failed.')
  if (err.message) console.error(err.message)
  process.exit(err.status || 1)
}
