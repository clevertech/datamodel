import chalk from 'chalk'
import {
  ISchema,
  ICommand,
  IEntity,
  IField,
  IAction,
  IActionTypes,
  IDroppedField
} from '../types'
import {
  findEntity,
  findAction,
  addAnswers,
  SchemaError,
  findField,
  findFieldIndex,
  findEntityIndex
} from '../utils'
import { nativeFieldTypes } from '../common'

const log = (message: string) => console.log('> ' + message)
const error = (message: string) => console.error('! ' + message)

const suggestEntityNames = (schema: ISchema, info: Map<string, string>) =>
  schema.entities.map(entity => entity.name)

const suggestFieldNames = (schema: ISchema, info: Map<string, string>) => {
  try {
    const entity = findEntity(schema, info.get('entityId'))
    return entity.fields.map(field => field.name)
  } catch (err) {
    if (!(err instanceof SchemaError)) error(err.message)
    return []
  }
}

const typeChoices = (schema: ISchema, inquirer: any, includeVoid?: boolean) => {
  const arr = [...nativeFieldTypes]
  if (includeVoid) {
    arr.push('void')
  }
  arr.push(new inquirer.Separator())
  arr.push(...schema.entities.map(entity => entity.name))
  return arr
}

const suggestActionNames = (schema: ISchema, info: Map<string, string>) =>
  Object.keys(schema.actions).reduce(
    (arr, group) =>
      schema.actions[group].reduce((arr, action) => {
        arr.push(`${group}.${action.name}`)
        return arr
      }, arr),
    new Array<string>()
  )

const suggestArguments = (schema: ISchema, info: Map<string, string>) => {
  try {
    const action = findAction(schema, info.get('actionId'))
    return action.arguments.map(arg => arg.name)
  } catch (err) {
    if (!(err instanceof SchemaError)) error(err.message)
    return []
  }
}

const alterEntityModifyName: ICommand = {
  tokens: ['name'],
  action: async (schema: ISchema, info: Map<string, string>, inquirer: any) => {
    const answers: { name: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: "What's the name of the new entity?",
        validate: Boolean // TODO: do not allow primitive types
      }
    ])

    const entity = findEntity(schema, info.get('entityId'))
    entity.name = answers.name

    schema.entities.forEach(entity => {
      entity.fields.forEach(field => {
        if (field.type === entity.name) field.type = answers.name
      })
    })

    Object.keys(schema.actions).forEach(group => {
      schema.actions[group].forEach(action => {
        action.arguments.forEach(argument => {
          if (argument.type === entity.name) argument.type = answers.name
        })
      })
    })
    addAnswers(info, answers)
    log('OK')
  }
}

const alterEntityModifyFieldSetType: ICommand = {
  tokens: ['type'],
  action: async (schema: ISchema, info: Map<string, any>, inquirer: any) => {
    const { entity, field } = findField(
      schema,
      info.get('entityId'),
      info.get('fieldId')
    )
    const oldField = { ...field }
    fieldQuestions(inquirer, schema, entity, field)
    info.set('oldField', oldField)
    log('OK')
  }
}

const alterEntityModifyFieldSetName: ICommand = {
  tokens: ['name'],
  action: async (schema: ISchema, info: Map<string, string>, inquirer: any) => {
    const { entity, field } = findField(
      schema,
      info.get('entityId'),
      info.get('fieldId')
    )
    const answers: { name: string } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'answer',
        message: "What's the new name for this field?"
      }
    ])
    field.name = answers.name
    info.set('name', answers.name)
    log('OK')
  }
}

const alterEntityModifyFieldSet: ICommand = {
  tokens: ['set'],
  next: [alterEntityModifyFieldSetName, alterEntityModifyFieldSetType]
}

const alterEntityModifyFieldDrop: ICommand = {
  tokens: ['drop'],
  action: async (schema: ISchema, info: Map<string, any>, inquirer: any) => {
    const { entity, index } = findFieldIndex(
      schema,
      info.get('entityId'),
      info.get('fieldId')
    )
    const field = entity.fields[index]
    const oldField = { ...field }
    entity.fields.splice(index, 1)
    info.set('oldField', oldField)
    log('OK')
  }
}

const alterEntityModifyField: ICommand = {
  tokens: ['field'],
  parameter: 'fieldId',
  suggestions: suggestFieldNames,
  next: [
    alterEntityModifyFieldSet,
    // alterEntityModifyFieldAdd,
    alterEntityModifyFieldDrop
  ]
}

const alterEntityModify: ICommand = {
  tokens: ['modify'],
  next: [alterEntityModifyName, alterEntityModifyField]
}

const alterEntityAddField: ICommand = {
  tokens: ['field'],
  action: async (schema: ISchema, info: Map<string, string>, inquirer: any) => {
    const entity = findEntity(schema, info.get('entityId'))
    const field = await fieldQuestions(inquirer, schema, entity)
    info.set('name', field.name)
    log('OK')
  }
}

const alterEntityAdd: ICommand = {
  tokens: ['add'],
  next: [alterEntityAddField]
}

const alterEntity: ICommand = {
  tokens: ['entity'],
  parameter: 'entityId',
  suggestions: suggestEntityNames,
  next: [alterEntityModify, alterEntityAdd]
}

const alterActionModifyArgumentsModify: ICommand = {
  tokens: ['modify'],
  parameter: 'argumentName',
  suggestions: suggestArguments,
  next: [
    {
      tokens: ['set'],
      next: [
        {
          tokens: ['name']
        },
        {
          tokens: ['type']
        }
      ]
    }
  ]
}

const alterActionModifyArgumentsDrop: ICommand = {
  tokens: ['drop'],
  parameter: 'argumentName',
  suggestions: suggestArguments,
  action: async (schema: ISchema, info: Map<string, string>) =>
    console.log('alterActionModifyArgumentsDrop', info)
}

const alterActionModifyArguments: ICommand = {
  tokens: ['arguments'],
  next: [alterActionModifyArgumentsDrop, alterActionModifyArgumentsModify]
}

const alterActionModifyType: ICommand = {
  tokens: ['type'],
  action: async (schema: ISchema, info: Map<string, string>) =>
    console.log('alterActionModifyType', info)
}

const alterActionModifyName: ICommand = {
  tokens: ['name'],
  action: async (schema: ISchema, info: Map<string, string>) =>
    console.log('alterActionModifyName', info)
}

const alterActionModify: ICommand = {
  tokens: ['modify'],
  next: [
    alterActionModifyName,
    alterActionModifyType,
    alterActionModifyArguments
  ]
}

const alterAction: ICommand = {
  tokens: ['action'],
  parameter: 'actionId',
  suggestions: suggestActionNames,
  next: [alterActionModify]
}

const alter: ICommand = {
  tokens: ['alter'],
  next: [alterEntity, alterAction]
}

const dropEntity: ICommand = {
  tokens: ['entity'],
  parameter: 'entityId',
  suggestions: suggestEntityNames,
  action: async (schema: ISchema, info: Map<string, any>) => {
    const entityId = info.get('entityId')
    const index = findEntityIndex(schema, entityId)
    const oldEntity = schema.entities[index]
    schema.entities.splice(index, 1)

    const droppedColumns: IDroppedField[] = []
    schema.entities.forEach(entity => {
      entity.fields = entity.fields.filter(field => field.type !== entityId)
      const dropped = entity.fields.filter(field => field.type === entityId)
      droppedColumns.push({
        entity: entity.name,
        fields: dropped
      })
    })

    Object.keys(schema.actions).forEach(group => {
      schema.actions[group].forEach(action => {
        action.arguments = action.arguments.filter(
          argument => argument.type !== entityId
        )
      })
    })
    info.set('oldEntity', oldEntity)
    info.set('droppedColumns', droppedColumns)
    log('OK')
  }
}

const dropAction: ICommand = {
  tokens: ['action'],
  parameter: 'actionId',
  suggestions: suggestActionNames,
  action: async (schema: ISchema, info: Map<string, string>) => {
    const actionId = info.get('actionId') || ''
    // const action = findAction(schema, actionId)
    // if (!action) return error('Action not found')
    const parts = actionId.split('.')
    const arr = schema.actions[parts[0]]
    if (!arr) return error('Action group not found')
    const indx = arr.findIndex(action => action.name === parts[1])
    if (indx < 0) return error('Action index not found')
    arr.splice(indx, 1)
    log('OK')
  }
}

const drop: ICommand = {
  tokens: ['drop'],
  next: [dropEntity, dropAction]
}

const confirm = async (inquirer: any, message: string) => {
  const answers: { answer: boolean } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'answer',
      message
    }
  ])
  return answers.answer
}

const fieldQuestions = async (
  inquirer: any,
  schema: ISchema,
  entity: IEntity,
  field?: IField
) => {
  const answers = (await inquirer.prompt(
    [
      field
        ? null
        : {
            type: 'input',
            name: 'name',
            message: "What's the name of the new field?"
          },
      {
        type: 'list',
        name: 'type',
        message: "What's the type of the new field?",
        choices: typeChoices(schema, inquirer),
        default: field && field.type,
        validate: Boolean // TODO: must be a primitive type or an existing entity name
      },
      {
        type: 'confirm',
        name: 'array',
        default: field && field.array,
        message: 'Is this an array?'
      },
      {
        type: 'confirm',
        name: 'primary',
        message: 'Is it a primary key?',
        default: () => entity.fields.length === 0 || (field && field.primary)
      },
      {
        type: 'confirm',
        name: 'primaryAuto',
        message: 'Is it auto generated?',
        default: field ? field.primaryAuto : true,
        when: (answers: { primary: boolean }) => answers.primary
      },
      {
        type: 'confirm',
        name: 'nullable',
        message: 'Is it nullable?',
        default: field ? field.nullable : false
      }
    ].filter(Boolean)
  )) as IField
  if (field) {
    Object.assign(field, answers)
  } else {
    entity.fields.push(answers)
  }
  return answers
}

const addArgument = async (inquirer: any, schema: ISchema, action: IAction) => {
  const answers = (await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: "What's the name of the new field?"
    },
    {
      type: 'list',
      name: 'type',
      message: "What's the type of the new field?",
      choices: typeChoices(schema, inquirer),
      validate: Boolean // TODO: must be a primitive type or an existing entity name
    },
    {
      type: 'confirm',
      name: 'nullable',
      message: 'Is it nullable?',
      default: false
    }
  ])) as IField
  action.arguments.push(answers)
}

const createEntity: ICommand = {
  tokens: ['entity'],
  action: async (schema: ISchema, info: Map<string, string>, inquirer: any) => {
    const answers: { name: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: "What's the name of the new entity?",
        validate: Boolean
      }
    ])
    const entity: IEntity = {
      name: answers.name,
      fields: []
    }
    schema.entities.push(entity)
    log('Now we need to add at least one field')
    while (true) {
      await fieldQuestions(inquirer, schema, entity)
      if (!await confirm(inquirer, 'Do you want to add another field?')) break
    }
    addAnswers(info, answers)
  }
}

const createAction: ICommand = {
  tokens: ['action'],
  action: async (schema: ISchema, info: Map<string, string>, inquirer: any) => {
    interface ICreateActionAnswers {
      name: string
      type: IActionTypes
      returns: string
      returnsArray: boolean
      returnsNullable: boolean
    }
    const answers: ICreateActionAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: "What's the name of the action? (use group.action notation)",
        validate: Boolean
      },
      {
        type: 'list',
        name: 'type',
        message: "What's the type of this action?",
        choices: ['create', 'read', 'update', 'delete']
      },
      {
        type: 'list',
        name: 'returns',
        message: "What's the type returned by this action?",
        choices: typeChoices(schema, inquirer),
        validate: Boolean // TODO: must be a primitive type or an existing entity name
      },
      {
        type: 'confirm',
        name: 'returnsArray',
        message: 'Does this action return an array?'
      },
      {
        type: 'confirm',
        name: 'returnsNullable',
        message: 'Can this action return null?'
      }
    ])
    const parts = answers.name.split('.')
    const action: IAction = {
      name: parts[1],
      type: answers.type,
      arguments: [],
      returns: answers.returns,
      returnsArray: answers.returnsArray,
      returnsNullable: answers.returnsNullable
    }
    const actions = (schema.actions[parts[0]] = schema.actions[parts[0]] || [])
    actions.push(action)
    while (true) {
      if (
        !await confirm(
          inquirer,
          `Do you want to add an${action.arguments.length > 0
            ? 'other'
            : ''} argument to the action?`
        )
      )
        break
      await addArgument(inquirer, schema, action)
    }
    addAnswers(info, answers)
  }
}

const create: ICommand = {
  tokens: ['create'],
  next: [createEntity, createAction]
}

const describeEntity: ICommand = {
  tokens: ['entity'],
  parameter: 'entityId',
  suggestions: suggestEntityNames,
  action: async (schema: ISchema, info: Map<string, string>) => {
    const entityId = info.get('entityId')
    const entity = findEntity(schema, entityId)
    if (!entity) return error('Entity not found')

    entity.fields.forEach(field => {
      console.log(chalk.magenta(field.name))
      const arr = [chalk.bold(field.type)]
      if (!field.nullable) arr.push('not null')
      if (field.primary) {
        arr.push('primary key')
        if (!field.primaryAuto) arr.push('auto')
      }
      console.log('  ', arr.join(' '))
    })
  }
}

const describeAction: ICommand = {
  tokens: ['action'],
  parameter: 'actionId',
  suggestions: suggestActionNames,
  action: async (schema: ISchema, info: Map<string, string>) => {
    const actionId = info.get('actionId') || ''
    const action = findAction(schema, actionId)
    if (!action) return error('Action not found')
    action.arguments.forEach(arg => {
      console.log(chalk.magenta(arg.name))
      const arr = [chalk.bold(arg.type)]
      if (!arg.nullable) arr.push('not null')
      console.log('  ', arr.join(' '))
    })
    console.log(chalk.magenta('=>'))
    const arr = [chalk.bold(action.returns)]
    if (!action.returnsNullable) arr.push('not null')
    console.log('  ', arr.join(' '))
  }
}

const describe: ICommand = {
  tokens: ['describe'],
  next: [describeEntity, describeAction]
}

const rootCommands: ICommand[] = [create, alter, drop, describe]

const allCommands = {
  alterEntityModifyName,
  alterEntityModifyFieldSetType,
  alterEntityModifyFieldSetName,
  alterEntityModifyFieldDrop,
  alterEntityAddField,
  alterActionModifyArgumentsDrop,
  alterActionModifyType,
  alterActionModifyName,
  dropEntity,
  dropAction,
  createEntity,
  createAction,
  describeEntity,
  describeAction
}

const indexedCommands: {
  [index: string]: ICommand
} = allCommands

Object.keys(indexedCommands).forEach(name => {
  indexedCommands[name].name = name
})

export { allCommands }

export default rootCommands
