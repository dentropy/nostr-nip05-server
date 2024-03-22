
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDenoKV } from 'rxdb/plugins/storage-denokv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
addRxPlugin(RxDBDevModePlugin);


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


const DDSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    CID: {
      type: 'string',
      maxLength: 100
    },
    previousCID: {
      type: 'string',
      maxLength: 100
    },
    content: {
      type: 'object',
      name: {
        type: 'string',
        maxLength: 100
      }
    }
  },
  required: ['id', 'CID', 'previousCID', 'content']
}

const CIDStoreSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    CID: {
      type: 'string'
    }
  },
  required: ['id', 'CID', 'previousCID', 'content']
}


console.log(Object.keys(myRxDatabase.collections))
await myRxDatabase.addCollections({
  dd: {
    schema: DDSchema
  },
  cid_store: {
    schema: CIDStoreSchema
  }
});
console.log(Object.keys(myRxDatabase.collections))


const myDocument = await myRxDatabase.dd.upsert({
  id: 'root',
  CID: 'TODO',
  previousCID: "TODO",
  content: {
    name: "Dave"
  }
});


const foundDocuments = await myRxDatabase.dd.find({
  selector: {
    id: {
      $eq: 'root'
    }
  }
}).exec();


console.log("\n")
console.log("foundDocuments")
console.log(Object.keys(foundDocuments[0]._data))
console.log(foundDocuments[0]._data)


const foundDocuments2 = await myRxDatabase.dd.find({
  selector: {
    content : {
      $eq : {
        name : "Dave"
      }
    }
  }
}).exec();

console.log("\n")
console.log("foundDocuments2")
if (foundDocuments2.length != 0) {
  console.log(foundDocuments2[0]._data)
  console.log(Object.keys(foundDocuments2[0]._data))
}


const foundDocuments3 = await myRxDatabase.dd.find({
  selector: {
    "content.name" : "Dave"
  }
}).exec();

console.log("\n")
console.log("foundDocuments3")
if (foundDocuments3.length != 0) {
  console.log(foundDocuments3[0]._data)
  console.log(Object.keys(foundDocuments3[0]._data))
}


console.log("\n\n")
console.log("List Collections")
console.log(
  Object.keys(myRxDatabase.collections)
)
