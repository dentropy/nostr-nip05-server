
import { createRxDatabase } from 'rxdb';
import { getRxStorageDenoKV } from 'rxdb/plugins/storage-denokv';

const myRxDatabase = await createRxDatabase({
    name: 'exampledb',
    storage: getRxStorageDenoKV({
      /**
       * Consistency level, either 'strong' or 'eventual'
       * (Optional) default='strong'
       */
      consistencyLevel: 'strong',
      /**
       * Path which is used in the first argument of Deno.openKv(settings.openKvPath)
       * (Optional) default=''
       */
      openKvPath: './deno-kv/deno-kv.db',
      /**
       * Some operations have to run in batches,
       * you can test different batch sizes to improve performance.
       * (Optional) default=100
       */
      batchSize: 100
    })
});

const todoSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
      id: {
          type: 'string',
          maxLength: 100 // <- the primary key must have set maxLength
      },
      name: {
          type: 'string'
      },
      done: {
          type: 'boolean'
      },
      timestamp: {
          type: 'string',
          format: 'date-time'
      }
  },
  required: ['id', 'name', 'done', 'timestamp']
}

await myRxDatabase.addCollections({
  todos: {
    schema: todoSchema
  }
});


const myDocument = await myRxDatabase.todos.insert({
  id: 'todo1',
  name: 'Learn RxDB',
  done: false,
  timestamp: new Date().toISOString()
});

const foundDocuments = await myRxDatabase.todos.find({
  selector: {
      done: {
          $eq: false
      }
  }
}).exec();