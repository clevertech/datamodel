import { ISchema, IField, IAction, ILog } from '../types'
import { nativeFieldTypes } from '../common'
import * as ts from './typescript'
import * as fs from 'fs-extra'
import * as path from 'path'

const camelcase = require('camelcase')
const prettier = require('prettier')

export default async (schema: ISchema, logs: ILog[], baseDir: string) => {
  let code = '// Entities'
  schema.entities.forEach(entity => {
    code += `
      export interface ${ts.interfaceName(entity.name)} {
        ${entity.fields.map(ts.fieldDescription).join(';\n')}
      }
    `
  })

  Object.keys(schema.actions).forEach(group => {
    code += `\n// Interaces for ${group} actions`
    const actions = schema.actions[group]
    const codeForAction = (action: IAction) => {
      return `${camelcase(action.name)}(
        request: ${ts.requestInterfaceName(group, action)}
      ): Promise<${ts.returnType(action)}>`
    }
    code += `
      ${actions
        .map(
          action => `export interface ${ts.requestInterfaceName(
            group,
            action
          )} {
        ${action.arguments.map(ts.fieldDescription).join(',')}
      }`
        )
        .join(';\n')}

      export interface ${ts.interfaceName(group)} {
        ${actions.map(codeForAction).join(';\n')}
      }
    `
  })

  await fs.writeFile(path.join(baseDir, 'types.ts'), prettier.format(code))
}
