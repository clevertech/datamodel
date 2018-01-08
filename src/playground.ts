import * as fs from 'fs-extra'
import * as path from 'path'

import { allCommands } from './commands/index'
import { ILog, ISchema, ICommand } from './types'
import generate from './commands/generate'
import { addAnswers } from './utils'

const inquierMock = (answers: any[]) => {
  return {
    async prompt(questions: any[]) {
      const nextAnswers = answers.shift()
      questions.forEach(question => {
        console.log(question.message + ':', nextAnswers[question.name])
      })
      return nextAnswers
    }
  }
}

const run = async (): Promise<void> => {
  const schema: ISchema = {
    entities: [],
    actions: {},
    paths: {
      express: 'node-app/src',
      swift: 'ios-app'
    }
  }
  const logs: ILog[] = []

  const commitChanges = async () => {
    await generate(schema, logs, path.resolve(__dirname, '../../datamodel-lab'))
    logs.splice(0)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const runCommand = async (
    command: ICommand,
    parameters: Map<string, string>,
    answers: any[]
  ) => {
    await command.action!(schema, parameters, inquierMock(answers))
    logs.push({
      command: command.name || 'UnkownCommandName',
      date: new Date(),
      parameters
    })
  }

  await runCommand(
    allCommands.createEntity,
    new Map(Object.entries({ name: 'Foo' })),
    [
      { name: 'Foo' },
      {
        name: 'id',
        type: 'number',
        primary: true,
        primaryAuto: true,
        nullable: false
      },
      { answer: false }
    ]
  )

  await commitChanges()

  await runCommand(
    allCommands.alterEntityModifyName,
    new Map(Object.entries({ entityId: 'Foo' })),
    [{ name: 'Bar' }]
  )

  await commitChanges()

  await runCommand(
    allCommands.dropEntity,
    new Map(Object.entries({ entityId: 'Bar' })),
    []
  )

  await runCommand(
    allCommands.createEntity,
    new Map(Object.entries({ name: 'User' })),
    [
      { name: 'User' },
      {
        name: 'id',
        type: 'number',
        primary: true,
        primaryAuto: true,
        nullable: false,
        array: false
      },
      { answer: true },
      {
        name: 'firstName',
        type: 'string',
        primary: false,
        nullable: false,
        array: false
      },
      { answer: true },
      {
        name: 'lastName',
        type: 'string',
        primary: false,
        nullable: false,
        array: false
      },
      { answer: true },
      {
        name: 'tags',
        type: 'string',
        primary: false,
        nullable: false,
        array: true
      },
      { answer: false }
    ]
  )

  await runCommand(allCommands.createAction, new Map(Object.entries({})), [
    {
      name: 'users.login',
      type: 'create',
      returns: 'User',
      returnsNullable: true
    },
    { answer: true },
    { name: 'email', type: 'string', nullable: false, array: false },
    { answer: true },
    { name: 'password', type: 'string', nullable: false, array: false },
    { answer: false }
  ])

  await runCommand(allCommands.createAction, new Map(Object.entries({})), [
    {
      name: 'users.list',
      type: 'read',
      returns: 'User',
      returnsNullable: false,
      returnsArray: true
    },
    { answer: false }
  ])

  await runCommand(allCommands.createAction, new Map(Object.entries({})), [
    {
      name: 'users.delete',
      type: 'delete',
      returns: 'void',
      returnsNullable: false,
      returnsArray: false
    },
    { answer: false }
  ])

  await commitChanges()

  await runCommand(
    allCommands.dropAction,
    new Map(Object.entries({ actionId: 'users.delete' })),
    []
  )

  await runCommand(
    allCommands.alterEntityModifyFieldSetType,
    new Map(Object.entries({ entityId: 'User', fieldId: 'tags' })),
    [
      {
        type: 'string',
        primary: false,
        primaryAuto: false,
        nullable: false,
        array: false
      }
    ]
  )

  await commitChanges()

  await runCommand(
    allCommands.alterEntityModifyFieldSetName,
    new Map(Object.entries({ entityId: 'User', fieldId: 'tags' })),
    [{ name: 'skills' }]
  )

  await commitChanges()

  await runCommand(
    allCommands.alterEntityModifyFieldDrop,
    new Map(Object.entries({ entityId: 'User', fieldId: 'skills' })),
    []
  )

  await commitChanges()
}

run().catch((err: any) => console.error(err))
