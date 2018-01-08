export interface ISchema {
  entities: IEntity[]
  actions: {
    [index: string]: IAction[]
  }
  paths: {
    [index: string]: string
  }
}

export interface IEntity {
  name: string
  fields: IField[]
  include?: string[]
  exclude?: string[]
}

export interface IField {
  name: string
  type: string
  primary?: boolean
  primaryAuto?: boolean
  nullable?: boolean
  array?: boolean
  validations?: {
    [index: string]: any
  }
  include?: string[]
  exclude?: string[]
}

export type IActionTypes = 'create' | 'read' | 'update' | 'delete'

export interface IAction {
  name: string
  type: IActionTypes
  arguments: IField[]
  returns: string
  returnsNullable?: boolean
  returnsArray?: boolean
  include?: string[]
  exclude?: string[]
}

export interface IRootCommand {
  next: ICommand[]
}

export interface ICommand {
  name?: string
  tokens: string[]
  next?: ICommand[]
  parameter?: string
  suggestions?: (schema: ISchema, info: Map<string, string>) => string[]
  action?: (
    schema: ISchema,
    info: Map<string, any>,
    inquirer: any
  ) => Promise<void>
}

export interface ILog {
  date: Date
  command: string
  parameters: Map<string, string>
}

export interface IDroppedField {
  entity: string
  fields: IField[]
}
