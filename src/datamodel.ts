import * as fs from 'fs-extra'
import * as path from 'path'

import generate from './commands/generate'
import { ICommand, IRootCommand, ISchema, ILog } from './types'
import commands from './commands/index'
import { absolute } from './common'

const fuzzy = require('fuzzy')
const inquirer = require('inquirer')

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))

interface SuggestionsInformation {
  schema: ISchema
  command: ICommand
  knownWords: string[]
  parameters: Map<string, string>
  value?: string
}

const suggestions = (info: SuggestionsInformation) => {
  const { command, knownWords, parameters, value, schema } = info
  const arr =
    (command.suggestions && command.suggestions(schema, parameters)) || []
  const suggestions: string[] = value
    ? fuzzy.filter(value, arr).map((el: any) => el.string)
    : arr
  return suggestions.map(sug => knownWords.join(' ') + ' ' + sug)
}

interface InputInformation {
  schema: ISchema
  logs: ILog[]
  input: string
  mode: 'autocomplete' | 'validate' | 'run'
}

const handleInput = (
  info: InputInformation
): true | string[] | Promise<void> => {
  const { input, schema, mode } = info
  const endsWithNamespace = /\s$/.test(input)
  const words = input.match(/[\w\.]+/g) || []
  const lastWord = words[words.length - 1]
  const nWords = words.length

  let nextCommands = commands
  let lastCommand: ICommand | IRootCommand = { next: commands }
  const knownWords: string[] = []
  const parameters = new Map<string, string>()
  while (words.length > 0) {
    const word = words.shift()!
    knownWords.push(word)
    let found = false
    for (const command of nextCommands) {
      if (command.tokens.includes(word)) {
        lastCommand = command
        if (command.parameter) {
          if (words.length > 0) {
            const value = words.shift()!
            parameters.set(command.parameter, value)
            if (!endsWithNamespace && knownWords.length === nWords - 1) {
              return suggestions({
                schema,
                command,
                knownWords,
                parameters,
                value
              })
            }
            // TODO: compare with suggestions to see if it's valid?
            knownWords.push(value)
          } else {
            return suggestions({
              schema,
              command,
              knownWords,
              parameters
            })
          }
        }
        if (command.action) {
          if (mode === 'validate') return true
          if (mode === 'run') {
            return command.action(schema, parameters, inquirer).then(() => {
              info.logs.push({
                command: command.name || 'UnkownCommandName',
                date: new Date(),
                parameters
              })
            })
          }
        }
        found = true
        if (!command.next) break
        nextCommands = command.next
        break
      }
    }
    if (!found) {
      knownWords.pop()
      break
    }
  }
  if (lastCommand && lastCommand.next) {
    const suggestions: string[] = []
    lastCommand.next.forEach(command => {
      if (command.tokens) {
        suggestions.push(command.tokens[0])
      }
    })
    const knownString = knownWords.join(' ') + ' '
    if (endsWithNamespace) return suggestions.map(str => knownString + str)
    return fuzzy
      .filter(lastWord || '', suggestions)
      .map((el: any) => knownString + el.string)
  }
  if (knownWords.length === nWords) {
    return [knownWords.join(' ')]
  }
  return []
}

async function searchCommand(
  schema: ISchema,
  logs: ILog[],
  answers: {},
  input?: string
) {
  try {
    return handleInput({
      schema,
      input: input || '',
      mode: 'autocomplete',
      logs
    })
  } catch (err) {
    console.error(err)
    return []
  }
}

const saveSchema = async (dir: string, schema: ISchema) => {
  await fs.writeFile(
    path.join(dir, 'datamodel.json'),
    JSON.stringify(schema, null, 2)
  )
}

const runNextCommand = async (
  schema: ISchema,
  logs: ILog[],
  dir: string
): Promise<void> => {
  const answers: { command: string } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'command',
      suggestOnly: true,
      message: '>',
      source: (answers: {}, input?: string) =>
        searchCommand(schema, logs, answers, input),
      pageSize: 10,
      validate: (input: string) => {
        const result = handleInput({
          schema,
          input,
          mode: 'validate',
          logs
        })
        return result === true ? result : 'Continue typing'
      }
    }
  ])
  try {
    await handleInput({
      schema,
      input: answers.command,
      mode: 'run',
      logs
    })
    await generate(schema, logs, dir)
    await saveSchema(dir, schema)
  } catch (err) {
    console.error(err.message || String(err))
  }
  return runNextCommand(schema, logs, dir)
}

const readSchema = async (dir: string): Promise<ISchema> => {
  const fullPath = path.resolve(dir, 'datamodel.json')
  if (!await fs.pathExists(fullPath)) {
    const answers: any = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'init',
        message:
          'No `datamodel.json` file found. Do you want to create an empty one?'
      },
      {
        type: 'input',
        name: 'express',
        message: 'Specify where is your express app? (leave empty for none)',
        when: (answers: any) => answers.init
      },
      {
        type: 'input',
        name: 'swift',
        message: 'Specify where is your Swift app? (leave empty for none)',
        when: (answers: any) => answers.init
      }
    ])
    if (!answers.init) {
      console.log("Ok. Then there's nothing I can do for you")
      process.exit(0)
    }

    const defaultSchema: ISchema = {
      entities: [],
      actions: {},
      paths: {
        express: answers.express || void 0,
        swift: answers.swift || void 0
      }
    }
    await saveSchema(dir, defaultSchema)
    return defaultSchema
  }
  return JSON.parse(await fs.readFile(fullPath, 'utf8')) as ISchema
}

const run = async (): Promise<void> => {
  console.log(
    'It is recommended to start clean (with no uncommited changes) so you can undo any action done.'
  )
  console.log()
  const dir = process.argv[2] || process.cwd()
  const schema = await readSchema(dir)
  const logs: ILog[] = []
  return runNextCommand(schema, logs, dir)
}

run().catch((err: any) => console.error(err))
