import * as fs from 'fs-extra'
import * as path from 'path'
import { ISchema, IField, IAction, ILog } from '../types'
import { nativeFieldTypes, uppercamelcase } from '../common'

import * as ts from './typescript'

const camelcase = require('camelcase')
const prettier = require('prettier')

export default async (schema: ISchema, logs: ILog[], baseDir: string) => {
  const imports: string[] = schema.entities
    .map(entity => ts.interfaceName(entity.name))
    .concat(Object.keys(schema.actions).map(ts.interfaceName))
  Object.keys(schema.actions).forEach(group => {
    const actions = schema.actions[group]
    actions.forEach(action => {
      imports.push(ts.requestInterfaceName(group, action))
    })
  })

  await fs.mkdirp(path.join(baseDir, 'api'))

  for (const group of Object.keys(schema.actions)) {
    const implementationPath = path.join(baseDir, `api/${camelcase(group)}.ts`)
    // if (await fs.pathExists(implementationPath)) continue

    let code = `
      import { ${imports.join(', ')} } from '../types';
    `

    const actions = schema.actions[group]
    const codeForAction = (action: IAction) => {
      return `async ${camelcase(action.name)}(
        request: ${ts.requestInterfaceName(group, action)}
      ): Promise<${ts.returnType(action)}> {
        // TODO: implement the action
      }`
    }
    code += `
      class ${uppercamelcase(group)} implements ${ts.interfaceName(group)} {
        ${actions.map(codeForAction).join('\n\n')}
      }

      export default new ${uppercamelcase(group)}()
    `

    await fs.writeFile(implementationPath, prettier.format(code))
  }
}
