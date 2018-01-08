# Datamodel

**This is an experiment which is work in progress**.

This is a datamodel definition tool that at this moment generates:

- TypeScript code for defining your data model
- Joi validations that validate user input and any defined entity
- REST interface with input already validated and type checking for the output
- Database migrations (knex)
- Swift code (still in the early stages)

Generating frontend code (redux and redux sagas) is on the works.

# Benefits

Having in sync the data model across all your apps (backend, frontend, mobile,...). Not having to worry about validations, not having to write migrations by hand, frontend networking layer already implemented and type-safe.

# Running

`yarn run build`

```
cd your-project
node path-to-datamodel-working-copy/compiled/datamodel.js
```
