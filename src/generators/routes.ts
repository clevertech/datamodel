import { ISchema, IAction, ILog } from '../types'
import * as fs from 'fs-extra'
import * as path from 'path'

const camelcase = require('camelcase')
const dashify = require('dashify')
const prettier = require('prettier')

export default async (schema: ISchema, logs: ILog[], baseDir: string) => {
  const utils = `
    import * as express from 'express';
    import * as Joi from "joi";

    import { Validator } from './validations';
    ${Object.keys(schema.actions)
      .map(
        group => `
      import ${camelcase(group)} from './routes/${dashify(group)}';
    `
      )
      .join(';\n')}

    const joiOptions = { abortEarly: false };

    type IEndpointAction<T> = (value: T) => any;

    export const endpoint = <T>(action: IEndpointAction<T>, schema: Validator<T>) => async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      try {
        const { error, value } = Joi.validate(req.body || req.query, schema, joiOptions);
        if (error) return res.status(400).json(error.details);
        const response = await action(value);
        res.json(response || {});
      } catch (err) {
        next(err);
      }
    };

    export default (app: express.Application) => {
      ${Object.keys(schema.actions)
        .map(
          group => `
        ${camelcase(group)}(app);
      `
        )
        .join(';\n')}
    }

  `
  await fs.writeFile(path.join(baseDir, 'routes.ts'), prettier.format(utils))
  await fs.mkdirp(path.join(baseDir, 'routes'))

  const methods = {
    create: 'post',
    read: 'get',
    update: 'put',
    delete: 'delete'
  }

  for (const group of Object.keys(schema.actions)) {
    let code = `
      import * as express from 'express';

      import ${camelcase(group)} from '../api/${dashify(group)}';
      import { endpoint } from '../routes';
      import * as validations from '../validations';
    `
    const actions = schema.actions[group]
    const routerName = camelcase(group + 'Router')
    const codeForAction = (action: IAction) => {
      const validation = camelcase(
        [group, action.name, 'RequestSchema'].join(' ')
      )
      const actionFunc = `req => ${camelcase(group)}.${camelcase(
        action.name
      )}(req)`
      return `${routerName}.${methods[action.type]}('/${camelcase(
        action.name
      )}', endpoint(${actionFunc}, validations.${validation}));`
    }
    code += `
      const ${routerName} = express.Router();
      ${actions.map(codeForAction).join(';\n\n')}
    `
    code += `

      export default (app: express.Application) => {
        app.use('/${camelcase(group)}', ${camelcase(group + 'Router')});
      }`

    await fs.writeFile(
      path.join(baseDir, `routes/${dashify(group)}.ts`),
      prettier.format(code)
    )
  }
}
