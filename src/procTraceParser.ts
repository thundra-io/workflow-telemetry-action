import * as fs from 'fs'
import * as readline from 'readline'
import * as logger from './logger'
import { CompletedCommand, ProcEventParseOptions } from './interfaces'

const SYS_PROCS_TO_BE_IGNORED: Set<string> = new Set([
  'awk',
  'basename',
  'cat',
  'cut',
  'date',
  'echo',
  'envsubst',
  'expr',
  'dirname',
  'grep',
  'head',
  'id',
  'ip',
  'ln',
  'ls',
  'lsblk',
  'mkdir',
  'mktemp',
  'mv',
  'ps',
  'readlink',
  'rm',
  'sed',
  'seq',
  'sh',
  'uname',
  'whoami'
])

export async function parse(
  filePath: string,
  procEventParseOptions: ProcEventParseOptions
): Promise<CompletedCommand[]> {
  const minDuration: number =
    (procEventParseOptions && procEventParseOptions.minDuration) || -1
  const traceSystemProcesses: boolean =
    (procEventParseOptions && procEventParseOptions.traceSystemProcesses) ||
    false

  const fileStream: fs.ReadStream = fs.createReadStream(filePath)
  const rl: readline.Interface = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input file as a single line break.

  const completedCommands: CompletedCommand[] = []

  for await (let line of rl) {
    line = line.trim()
    if (!line || !line.length) {
      continue
    }
    try {
      if (logger.isDebugEnabled()) {
        logger.debug(`Parsing trace process event: ${line}`)
      }
      const event: CompletedCommand = JSON.parse(line)

      // filter out short living processes.
      if (event.durationNs < minDuration){
        continue
      }

      completedCommands.push(event)
    } catch (error: any) {
      logger.debug(`Unable to parse process trace event (${error}): ${line}`)
    }
  }

  completedCommands.sort((a: CompletedCommand, b: CompletedCommand) => {
    return a.startTimeNs - b.startTimeNs
  })

  if (logger.isDebugEnabled()) {
    logger.debug(`Completed commands: ${JSON.stringify(completedCommands)}`)
  }

  return completedCommands
}
