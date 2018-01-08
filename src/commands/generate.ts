import * as path from 'path'

import { ISchema, ILog } from '../types'
import { absolute } from '../common'

// generators
import joi from '../generators/joi'
import swift from '../generators/swift'
import routes from '../generators/routes'
import implementations from '../generators/implementations'
import interfaces from '../generators/interfaces'
import migration from '../generators/migration'

export default async (schema: ISchema, logs: ILog[], dir: string) => {
  const { express, swift: swiftPath } = schema.paths
  if (express) {
    const expressBase = path.resolve(dir, express)
    await joi(schema, logs, expressBase)
    await routes(schema, logs, expressBase)
    await interfaces(schema, logs, expressBase)
    await implementations(schema, logs, expressBase)
    await migration(schema, logs, expressBase)
  }

  if (swiftPath) {
    const swiftBase = path.resolve(dir, swiftPath)
    await swift(schema, logs, swiftBase)
  }
}
