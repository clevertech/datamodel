import * as path from 'path'
import { ISchema } from './types'

const camelcase = require('camelcase')

export const nativeFieldTypes = ['string', 'number', 'boolean']

export const uppercamelcase = (str: string) =>
  camelcase('x ' + str).substring(1)

// Ensure that we have 2 places for each of the date segments.
const padDate = (segment: number) => {
  const part = segment.toString()
  return part[1] ? part : `0${part}`
}

// Get a date object in the correct format, without requiring a full out library
// like "moment.js".
export const yyyymmddhhmmss = (d: Date) => {
  return (
    d.getFullYear().toString() +
    padDate(d.getMonth() + 1) +
    padDate(d.getDate()) +
    padDate(d.getHours()) +
    padDate(d.getMinutes()) +
    padDate(d.getSeconds())
  )
}

export const includesScope = (scope: string, scopes?: string[]): boolean =>
  (scopes || []).includes(scope)

export const absolute = (file: string) => path.resolve(process.cwd(), file)
