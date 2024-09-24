// db.ts

import { Database } from './databasetypes'
import { createPool } from 'mysql2'
import { Kysely, MysqlDialect } from 'kysely'

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

const secret_name = 'n11431415_database'

let db: Kysely<Database>

;(async function initializeDatabase() {
  const client = new SecretsManagerClient({
    region: 'ap-southeast-2',
  })

  let response

  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: 'AWSCURRENT',
      })
    )
  } catch (error) {
    throw error
  }

  const secret = JSON.parse(response.SecretString!)
  const username = secret.username
  const password = secret.password
  const host = secret.host;
  const port = secret.port;

  const dialect = new MysqlDialect({
    pool: createPool({
      database: 'cloudcomputing',
      host: host,
      user: username,
      password: password,
      port: port,
      connectionLimit: 10,
    }),
  })

  db = new Kysely<Database>({
    dialect,
  })
})()

export { db }
