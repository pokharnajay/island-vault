import { execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type { AiAction } from '@shared/types'
import { getSettings } from './settings'

const CANDIDATES = [
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude',
  join(homedir(), '.claude/local/claude'),
  join(homedir(), '.local/bin/claude')
]

const MAX_CONCURRENT = 2
const TIMEOUT_MS = 90_000
const MAX_OUT_BYTES = 4 * 1024 * 1024

let claudePath: string | null = null
let resolveAttempted = false

// GUI apps inherit only /usr/bin:/bin:/usr/sbin:/sbin — find claude ourselves.
export async function resolveClaude(): Promise<string | null> {
  if (resolveAttempted) return claudePath
  resolveAttempted = true
  const override = getSettings().claudePath
  if (override && existsSync(override)) {
    claudePath = override
    return claudePath
  }
  for (const c of CANDIDATES) {
    if (existsSync(c)) {
      claudePath = c
      return claudePath
    }
  }
  claudePath = await new Promise<string | null>((resolve) => {
    execFile('/bin/zsh', ['-lc', 'command -v claude'], { timeout: 3000 }, (err, stdout) => {
      const p = stdout?.trim()
      resolve(!err && p ? p : null)
    })
  })
  return claudePath
}

export function aiAvailable(): { ok: boolean; path?: string } {
  return { ok: claudePath != null, path: claudePath ?? undefined }
}

function promptFor(action: AiAction): string {
  const target = getSettings().translateTarget || 'English'
  switch (action) {
    case 'cleanup':
      return 'Clean up the text provided on stdin: fix whitespace, line breaks, casing, and obvious typos. Preserve meaning and language. Output ONLY the cleaned text.'
    case 'summarize':
      return 'Summarize the text on stdin in at most 3 sentences. Output ONLY the summary.'
    case 'translate':
      return `Translate the text on stdin to ${target}. If it is already ${target}, translate to English. Output ONLY the translation.`
    case 'extract':
      return 'Extract all URLs and email addresses from the text on stdin, one per line, URLs first, deduplicated. Output ONLY the list. If none, output exactly: (none found)'
  }
}

export interface RunnerEvent {
  jobId: number
  clipId: number
  action: AiAction
  status: 'running' | 'done' | 'error'
  result?: string
  message?: string
}

interface Job {
  jobId: number
  clipId: number
  action: AiAction
  text: string
}

let nextJobId = 1
let running = 0
const queue: Job[] = []
const active = new Set<string>()
let emit: (ev: RunnerEvent) => void = () => {}

export function onJobEvent(cb: (ev: RunnerEvent) => void): void {
  emit = cb
}

export function enqueue(clipId: number, action: AiAction, text: string): void {
  const key = `${clipId}:${action}`
  if (active.has(key)) return
  active.add(key)
  queue.push({ jobId: nextJobId++, clipId, action, text })
  pump()
}

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    run(queue.shift()!)
  }
}

function run(job: Job): void {
  if (!claudePath) {
    active.delete(`${job.clipId}:${job.action}`)
    emit({ ...job, status: 'error', message: 'claude CLI not found' })
    return
  }
  running++
  emit({ jobId: job.jobId, clipId: job.clipId, action: job.action, status: 'running' })

  const settings = getSettings()
  const args = [
    '-p',
    promptFor(job.action),
    '--output-format',
    'text',
    '--no-session-persistence',
    '--tools',
    '',
    '--max-budget-usd',
    '0.50'
  ]
  if (settings.aiModel) args.push('--model', settings.aiModel)

  const env = { ...process.env, PATH: `${dirname(claudePath)}:${process.env.PATH ?? ''}` }
  const child = spawn(claudePath, args, { env, stdio: ['pipe', 'pipe', 'pipe'] })

  let out = ''
  let errOut = ''
  let timedOut = false
  let settled = false

  const termTimer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 5000)
  }, TIMEOUT_MS)

  const settle = (ev: Omit<RunnerEvent, 'jobId' | 'clipId' | 'action'>): void => {
    if (settled) return
    settled = true
    clearTimeout(termTimer)
    running--
    active.delete(`${job.clipId}:${job.action}`)
    emit({ jobId: job.jobId, clipId: job.clipId, action: job.action, ...ev })
    pump()
  }

  child.stdout.on('data', (d: Buffer) => {
    out += d.toString()
    if (out.length > MAX_OUT_BYTES) {
      timedOut = true
      child.kill('SIGKILL')
    }
  })
  child.stderr.on('data', (d: Buffer) => {
    errOut += d.toString()
  })
  child.on('error', (err) => settle({ status: 'error', message: String(err) }))
  child.on('close', (code) => {
    const result = out.trim()
    if (!timedOut && code === 0 && result) {
      settle({ status: 'done', result })
    } else {
      settle({
        status: 'error',
        message: timedOut ? 'Timed out' : errOut.trim().slice(0, 300) || `claude exited ${code}`
      })
    }
  })
  child.stdin.on('error', () => {
    // EPIPE if the process dies before stdin flushes — surfaced via 'close'
  })
  child.stdin.end(job.text)
}
