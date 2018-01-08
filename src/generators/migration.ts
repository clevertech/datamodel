import {
  ISchema,
  IAction,
  IField,
  IEntity,
  ILog,
  ICommand,
  IDroppedField
} from '../types'
import * as fs from 'fs-extra'
import * as path from 'path'
import { yyyymmddhhmmss, nativeFieldTypes } from '../common'
import { allCommands } from '../commands/index'
import { findEntity, findField } from '../utils'

const camelcase = require('camelcase')
const dashify = require('dashify')
const prettier = require('prettier')
const snakeCase = require('snake-case')

const hasPrimary = (entity: IEntity) =>
  entity.fields.some(field => !!field.primary)

const primaryKeyColumns = (entity: IEntity) => {
  return entity.fields
    .filter(field => !!field.primary)
    .map(field => snakeCase(field.name))
}

const additional = (field: IField): string => {
  if (field.primary && field.primaryAuto && ['string'].includes(field.type)) {
    return '.defaultTo(knex.raw("uuid_generate_v4()"))'
  }
  return ''
}

const columnType = (schema: ISchema, field: IField): string => {
  if (field.array) return 'jsonb'

  const type = field.type
  if (field.primary && field.primaryAuto) {
    if (['number'].includes(field.type)) return 'increments'
    if (['string'].includes(field.type)) return 'uuid'
  }

  if (nativeFieldTypes.includes(type)) {
    return type
  }
  const entity = schema.entities.find(entity => entity.name === type)
  if (entity) {
    const field = entity.fields.find(field => !!field.primary)
    if (field) return columnType(schema, field)
  }
  return 'jsonb' // TODO: FK
}

const notNullable = (field: IField) => {
  return field.nullable ? '' : '.notNullable()'
}

const describeColumn = (schema: ISchema, field: IField) => {
  return `
    table.${columnType(schema, field)}('${snakeCase(field.name)}')${additional(
    field
  )}${notNullable(field)}
  `
}

type Migration = (
  schema: ISchema,
  logs: ILog[],
  parameters: Map<string, any>
) => string

const upMigrations: { [index: string]: Migration } = {}
const downMigrations: { [index: string]: Migration } = {}

const defineCommandActions = (
  command: ICommand,
  up: Migration,
  down: Migration
) => {
  const name = command.name!
  upMigrations[name] = up
  downMigrations[name] = down
}

defineCommandActions(
  allCommands.createEntity,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const entity = findEntity(schema, parameters.get('name'))
    return `
      await knex.schema.createTable('${snakeCase(entity.name)}', table => {
        ${entity.fields.map(field => describeColumn(schema, field)).join(';')}
      })
    `
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    return `await knex.schema.dropTable('${snakeCase(parameters.get('name'))}')`
  }
)

defineCommandActions(
  allCommands.dropEntity,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const entityId = parameters.get('entityId')
    return `await knex.schema.dropTable('${snakeCase(entityId)}')`
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, any>) => {
    const entityId = parameters.get('entityId')
    const oldEntity = parameters.get('oldEntity') as IEntity
    const droppedColumns = parameters.get('droppedColumns') as IDroppedField[]

    return `
      ${droppedColumns
        .map(
          drop => `
        await knex.schema.table('${snakeCase(drop.entity)}', table => {
          ${drop.fields
            .map(
              field => `
            table.dropColumn('${snakeCase(field.name)}')
          `
            )
            .join(';\n')}
        })
      `
        )
        .join(';\n')}

      await knex.schema.createTable('${snakeCase(oldEntity.name)}', table => {
        ${oldEntity.fields
          .map(field => describeColumn(schema, field))
          .join(';')}
      })
    `
  }
)

defineCommandActions(
  allCommands.alterEntityAddField,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const { entity, field } = findField(
      schema,
      parameters.get('entityId'),
      parameters.get('name')
    )
    return `
      await knex.schema.alterTable('${snakeCase(entity.name)}', table => {
        ${describeColumn(schema, field)}
      })
    `
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const entityId = parameters.get('entityId')
    const name = parameters.get('name')
    return `
      await knex.schema.table('${snakeCase(entityId)}', table => {
        table.dropColumn('${snakeCase(name)}')
      })
    `
  }
)

defineCommandActions(
  allCommands.alterEntityModifyName,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const name = parameters.get('name')
    const entityId = parameters.get('entityId')
    return `
      await knex.schema.renameTable('${snakeCase(entityId)}', '${snakeCase(
      name
    )}')
    `
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const name = parameters.get('name')
    const entityId = parameters.get('entityId')
    return `
      await knex.schema.renameTable('${snakeCase(name)}', '${snakeCase(
      entityId
    )}')
    `
  }
)

defineCommandActions(
  allCommands.alterEntityModifyFieldDrop,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const entityId = parameters.get('entityId')
    const fieldId = parameters.get('fieldId')
    return `
      await knex.schema.table('${snakeCase(entityId)}', table => {
        table.dropColumn('${snakeCase(fieldId)}')
      })
    `
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, any>) => {
    const entityId = parameters.get('entityId')
    const oldField = parameters.get('oldField') as IField
    return `
      await knex.schema.table('${snakeCase(entityId)}', table => {
        ${describeColumn(schema, oldField)}
      })
    `
  }
)

defineCommandActions(
  allCommands.alterEntityModifyFieldSetName,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const oldName = parameters.get('fieldId')
    const { entity, field } = findField(
      schema,
      parameters.get('entityId'),
      parameters.get('name')
    )
    return `
      await knex.schema.table('${snakeCase(entity.name)}', table => {
        table.renameColumn('${snakeCase(oldName)}', '${snakeCase(field.name)}')
      })
    `
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const oldName = parameters.get('fieldId')
    const { entity, field } = findField(
      schema,
      parameters.get('entityId'),
      parameters.get('name')
    )
    return `
      await knex.schema.table('${snakeCase(entity.name)}', table => {
        table.renameColumn('${snakeCase(field.name)}', '${snakeCase(oldName)}')
      })
    `
  }
)

defineCommandActions(
  allCommands.alterEntityModifyFieldSetType,
  (schema: ISchema, logs: ILog[], parameters: Map<string, string>) => {
    const { entity, field } = findField(
      schema,
      parameters.get('entityId'),
      parameters.get('fieldId')
    )
    return `
      await knex.schema.alterTable('${snakeCase(entity.name)}', table => {
        ${describeColumn(schema, field)}.alter()
      })
    `
  },
  (schema: ISchema, logs: ILog[], parameters: Map<string, any>) => {
    const entityId = parameters.get('entityId')
    const oldField = parameters.get('oldField') as IField
    return `
      await knex.schema.alterTable('${snakeCase(entityId)}', table => {
        ${describeColumn(schema, oldField)}.alter()
      })
    `
  }
)

export default async (schema: ISchema, logs: ILog[], baseDir: string) => {
  await fs.mkdirp(path.join(baseDir, 'migrations'))

  if (logs.length === 0) return
  const date = yyyymmddhhmmss(logs[0].date)

  let code = `
    exports.up = async (knex, Promise) => {
  `
  for (const log of logs) {
    const { command, parameters } = log
    const up = upMigrations[command]
    if (up) {
      code += up(schema, logs, parameters) + '\n'
    } else {
      console.warn('No up action for command', command)
    }
  }

  code += `
    };

    exports.down = async (knex, Promise) => {
  `

  for (const log of logs.slice().reverse()) {
    const { command, parameters } = log
    const down = downMigrations[command]
    if (down) {
      code += down(schema, logs, parameters) + '\n'
    } else {
      console.warn('No down action for command', command)
    }
  }

  code += `
    };
  `

  await fs.writeFile(
    path.join(baseDir, `migrations/${date}_datamodel.js`),
    prettier.format(code)
  )
}
