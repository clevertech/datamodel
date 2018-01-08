import { ISchema, IField, IAction, ILog } from '../types'
import { uppercamelcase } from '../common'

import * as fs from 'fs-extra'
import * as path from 'path'

const camelcase = require('camelcase')

export default async (schema: ISchema, logs: ILog[], baseDir: string) => {
  const fieldType = (type: string) => uppercamelcase(type)
  const required = (field: IField) => (field.nullable ? '?' : '!')
  const fieldDescription = (field: IField) => {
    return `var ${field.name}: ${fieldType(field.type)}${required(field)}`
  }
  const fieldMapping = (field: IField) => {
    return `${field.name} <- map["${field.name}"]`
  }
  let code = ''
  schema.entities.forEach(entity => {
    code += `
      struct ${uppercamelcase(entity.name)}: Mappable {
        ${entity.fields.map(fieldDescription).join('\n        ')}

        init?(map: Map) {

        }

        mutating func mapping(map: Map) {
          ${entity.fields.map(fieldMapping).join('\n          ')}
        }
      }
    `
  })

  Object.keys(schema.actions).forEach(group => {
    const actions = schema.actions[group]
    const returnType = (type: string) =>
      type === 'Void' ? type : fieldType(type)
    const codeForAction = (action: IAction) => {
      return `static func ${camelcase(action.name)}(request: ${uppercamelcase(
        group + ' ' + action.name
      )}, completion: @escaping (${returnType(action.returns)}) {
          // Call HTTP endpoint here
        }`
    }
    code += `
      ${actions
        .map(
          action => `struct ${uppercamelcase(group + ' ' + action.name)} {
        ${action.arguments.map(fieldDescription).join('\n        ')}
      }`
        )
        .join('\n\n      ')}

      class ${uppercamelcase(group + ' Service')} {
        ${actions.map(codeForAction).join('\n        ')}
      }
    `
  })

  await fs.writeFile(path.join(baseDir, 'Models.swift'), code)
}
