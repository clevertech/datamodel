import { ISchema, IEntity, IAction, IField } from './types'

const quote = (name?: string) => (name ? `'${name}'` : 'No name provided')

export class SchemaError extends Error {}

export const findEntity = (schema: ISchema, entityId?: string): IEntity => {
  const entity = schema.entities.find(entity => entity.name === entityId)
  if (!entity)
    throw new SchemaError(`No entity found with name ${quote(entityId)}`)
  return entity
}

export const findEntityIndex = (schema: ISchema, entityId?: string): number => {
  const index = schema.entities.findIndex(entity => entity.name === entityId)
  if (index < 0)
    throw new SchemaError(`No entity found with name ${quote(entityId)}`)
  return index
}

export const findField = (
  schema: ISchema,
  entityId?: string,
  fieldId?: string
) => {
  const entity = schema.entities.find(entity => entity.name === entityId)
  if (!entity)
    throw new SchemaError(`No entity found with name ${quote(entityId)}`)
  const field = entity.fields.find(field => field.name === fieldId)
  if (!field)
    throw new SchemaError(
      `No field found with name ${quote(fieldId)} in ${quote(entity.name)}`
    )
  return { entity, field }
}

export const findFieldIndex = (
  schema: ISchema,
  entityId?: string,
  fieldId?: string
) => {
  const entity = schema.entities.find(entity => entity.name === entityId)
  if (!entity)
    throw new SchemaError(`No entity found with name ${quote(entityId)}`)
  const index = entity.fields.findIndex(field => field.name === fieldId)
  if (index < 0)
    throw new SchemaError(
      `No field found with name ${quote(fieldId)} in ${quote(entity.name)}`
    )
  return { entity, index }
}

export const findAction = (schema: ISchema, actionId?: string): IAction => {
  const parts = (actionId || '').split('.')
  const arr = schema.actions[parts[0]]
  if (!arr)
    throw new SchemaError(`No action group found for action ${quote(actionId)}`)
  const action = arr.find(action => action.name === parts[1])
  if (!action)
    throw new SchemaError(`No action found with name ${quote(actionId)}`)
  return action
}

export const addAnswers = (parameters: Map<string, string>, answers: any) => {
  Object.keys(answers).forEach(key => parameters.set(key, String(answers[key])))
}
