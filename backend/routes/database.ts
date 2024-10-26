// db.ts

import { Database } from './databasetypes'
import { createPool } from 'mysql2'
import { Kysely, MysqlDialect } from 'kysely'
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { processMessages }  from './transcode'



let db: Kysely<Database>;

async function getParameterValue(parameter_name: string): Promise<string | undefined> {
  const ssmClient = new SSMClient({ region: 'ap-southeast-2' })
  try {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: parameter_name,
        WithDecryption: true, 
      })
    )
    return response.Parameter?.Value
  } catch (error) {
    console.log(`Error fetching parameter ${parameter_name}:`, error)
    return undefined
  }
}

(async function initializeDatabase() {
  const client = new SecretsManagerClient({
    region: 'ap-southeast-2',
  })

  let response
  const secretName = await getParameterValue('/n11431415/assignment/secretName') 
  if (!secretName) {
    throw new Error('secretName parameter value could not be retrieved')
  }

  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: 'AWSCURRENT',
      })
    )
  } catch (error) {
    throw error
  }

  const secret = JSON.parse(response.SecretString!)
  const username = secret.username
  const password = secret.password
  const host = secret.host
  const port = secret.port

  const database = await getParameterValue('/n11431415/assignment/database') 
  if (!database) {
    throw new Error('Database parameter value could not be retrieved')
  }

  const dialect = new MysqlDialect({
    pool: createPool({
      database: database,
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
  processMessages();
})()

export { db, getParameterValue }
