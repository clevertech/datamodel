import { IAction, IField } from '../types'
import { nativeFieldTypes } from '../common'

const camelcase = require('camelcase')

export const interfaceName = (entityName: string) =>
  'I' + camelcase('I ' + entityName).substring(1)

export const requestInterfaceName = (group: string, action: IAction) =>
  interfaceName(camelcase([group, action.name, 'Request'].join(' ')))

export const fieldType = (type: string) =>
  nativeFieldTypes.includes(type) ? type : interfaceName(type)

export const required = (field: IField) => (field.nullable ? '?' : '')

export const fieldDescription = (field: IField) => {
  let type = fieldType(field.type)
  if (field.array) type = `${type}[]`
  return `${field.name}${required(field)}: ${type}`
}

export const returnType = (action: IAction) => {
  if (action.returns === 'void') return 'void'
  const type = action.returns
  const basicType = fieldType(type)
  const returnType = action.returnsArray ? `${basicType}[]` : basicType
  if (action.returnsNullable) return returnType + ' | null'
  return returnType
}
