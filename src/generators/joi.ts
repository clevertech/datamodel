import * as fs from 'fs-extra'
import * as path from 'path'

import * as ts from './typescript'
import { ISchema, IField, IAction, ILog } from '../types'
import { nativeFieldTypes } from '../common'

const camelcase = require('camelcase')
const prettier = require('prettier')

const schemaName = (entityName: string) => camelcase(entityName + 'Schema')

export default async (schema: ISchema, logs: ILog[], baseDir: string) => {
  const supportedValidations: { [index: string]: string[] } = {
    string: [
      'min',
      'max',
      'lowecase',
      'uppercase',
      'trim',
      'creditCard',
      'hex',
      'base64',
      'ip',
      'uri',
      'guid',
      'uuid'
    ],
    number: ['min', 'max', 'integer', 'positive', 'negative']
  }
  const validationForField = (field: IField) => {
    let typeDefinition = ''
    if (nativeFieldTypes.includes(field.type)) {
      const supported = supportedValidations[field.type]
      const validations = (supported && field.validations) || {}
      const validtCode = Object.keys(validations)
        .map(key => {
          if (!supported.includes(key)) return ''
          const value = validations[key]
          if (value === true) return `.${key}()`
          return `.${key}(${value})`
        })
        .join('')
      typeDefinition = `Joi.${field.type}()${validtCode}`
    } else {
      typeDefinition = schemaName(field.type)
    }
    if (field.array) {
      typeDefinition = `Joi.array().items(${typeDefinition})`
    }
    typeDefinition = field.nullable
      ? typeDefinition
      : `${typeDefinition}.required()`
    return `${field.name}: ${typeDefinition}`
  }
  const thingsToExport: string[] = []
  let code = `
    import * as Joi from 'joi';
    import * as types from './types'

    export interface Validator<T> extends Joi.ObjectSchema {
      // Adds generics support to Joi.ObjectSchema
    }

  `
  code += '\n\n// Validators for entities'
  const validatorType = (name: string) => {
    return `: Validator<types.${ts.interfaceName(name)}>`
  }
  schema.entities.forEach(entity => {
    const name = schemaName(entity.name)
    thingsToExport.push(name)
    code += `
      const ${name}${validatorType(entity.name)} = Joi.object().keys({
        ${entity.fields.map(validationForField).join(', ')}
      });
    `
  })

  code += '\n\n// Validators for actions\n'
  Object.keys(schema.actions).forEach(group => {
    const actions = schema.actions[group]
    const codeForAction = (action: IAction) => {
      const name = camelcase([group, action.name, 'RequestSchema'].join(' '))
      thingsToExport.push(name)
      return `const ${name}${validatorType(
        [group, action.name, 'Request'].join(' ')
      )} = Joi.object().keys({
        ${action.arguments.map(validationForField).join(',')}
      });`
    }
    code += actions.map(codeForAction).join(';\n\n')
  })

  code += `export {${thingsToExport.join(', ')}}`

  await fs.writeFile(
    path.join(baseDir, 'validations.ts'),
    prettier.format(code, { printWidth: 120 })
  )
}
