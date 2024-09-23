import { Database } from './databasetypes' // this is the Database interface we defined earlier
import { createPool } from 'mysql2' // do not use 'mysql2/promises'!
import { Kysely, MysqlDialect } from 'kysely'


const dialect = new MysqlDialect({
    pool: createPool({
        database: 'cloudcomputing',
        host: '127.0.0.1', //mysql
        user: 'root',
        password: 'root',
        port: 3306,
        connectionLimit: 10,
    })
})


export const db = new Kysely<Database>({
    dialect,
})

