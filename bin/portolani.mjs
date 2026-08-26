#!/usr/bin/env node
import { createRequire } from 'node:module'
import { run, usage } from '../lib/cli.js'

const { name, version } = createRequire(import.meta.url)('../package.json')

try {
  process.exitCode = await run(process.argv.slice(2), {
    generator: { name, version },
    stdout: process.stdout,
    stderr: process.stderr,
  })
} catch (error) {
  process.stderr.write(`portolani: ${error.message}\n`)
  if (/Unknown option|not allowed/i.test(error.message)) process.stderr.write(`\n${usage()}`)
  process.exitCode = 1
}
