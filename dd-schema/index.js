
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDenoKV } from 'rxdb/plugins/storage-denokv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import fs from 'node:fs';
import ipns from 'ed25519-keygen/ipns';
import { randomBytes } from 'ed25519-keygen/utils';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBDevModePlugin);

import { encode, decode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'


let DDSchema = {}
// Consolodate all dependencies into single JSON object
DDSchema.specification = JSON.parse(fs.readFileSync('./dd-schema/DD-schema.json'));
// console.log(DDSchema.specification)
for (let depdenency of DDSchema.specification.dependencies) {
  try {
    let tmp_dependency = JSON.parse(fs.readFileSync(`./dd-schema/${depdenency}/DD-schema.json`));
    // console.log("tmp_dependency")
    // console.log(tmp_dependency)
    if (Object.keys(DDSchema.specification).includes("schemas")) {
      for (let tmp_schema of tmp_dependency.schemas) {
        tmp_schema.schema_name = DDSchema.specification.app_names[0] + "." + tmp_dependency.app_names[0] + "." + tmp_schema.schema_name
        DDSchema.specification.schemas.push(tmp_schema)
      }
    }

  } catch (error) {
    // console.log(`dd-schema error could not import dependency ${depdenency}`)
  }
}


DDSchema.rxdb = await createRxDatabase({
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


const RootSchema = {
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
      type: 'object'
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

const IPNSStoreSchema = {
  version: 0,
  primaryKey: 'ipns',
  type: 'object',
  "properties": {
    "ipns": {
      "type": "string",
      maxLength: 100
    },
    "private_key": {
      "type": "string"
    },
    "timestamp_ms": {
      "type": "number"
    }
  },
  "required": [
    "ipns",
    "private_key",
    "timestamp_ms"
  ]
}


await DDSchema.rxdb.addCollections({
  ddroot: {
    schema: RootSchema
  },
  cid_store: {
    schema: CIDStoreSchema
  },
  ipns_store: {
    schema: IPNSStoreSchema
  }
});


async function setup_schema() {
  console.log("setup started")

  // Check if every dependency is included in the root schema



  // console.log(JSON.stringify(DDSchema.specification, null, 2))


  // Create all IPNS directories

  // console.log(Object.keys(DDSchema.specification.schemas))

  // Get root data to save updated IPNS name to root
  let rootData = {
    id: "root",
    app_name : DDSchema.specification.app_names[0],
    CID: "CID_TODO",
    previousCID: "bafkreieghxguqf42lefdhwc2otdmbn5snq23skwewpjlrwl4mbgw6x7wey",
    content: {
      initialized: true,
      app_ipns_lookup: {}
    }
  }

  for (let tmp_schema of DDSchema.specification.schemas) {
    console.log(`Schema Name ${tmp_schema.schema_name}`)
    let tmp_properties = JSON.parse(JSON.stringify(tmp_schema.rxdb_json.properties))
    let tmp_required = JSON.parse(JSON.stringify(tmp_schema.rxdb_json.required))
    // Generate IPNS name
    const iseed = randomBytes(32);
    const ikeys = await ipns(iseed);
    console.log("\n")
    console.log("IPNS_KEY")
    console.log(ikeys.base36.substring(7))
    if (tmp_schema.index_type == "logged") {
      tmp_schema.rxdb_json.properties = {
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
          properties: tmp_properties,
          required: tmp_required
        }
      }
      tmp_schema.rxdb_json.required = [
        "id",
        "CID",
        "previousCID",
        "content"
      ]
    }
    var data = {
      ipns: ikeys.base36.substring(7),
      private_key: ikeys.privateKey,
      timestamp_ms: new Date()
    }
    // Save IPNS name to ipns_store
    await DDSchema.rxdb.ipns_store.upsert(data);
    rootData.content.app_ipns_lookup[tmp_schema.schema_name] = ikeys.base36.substring(7)
    // Add schema
    let collection_schema = {}
    collection_schema[ikeys.base36.substring(7)] = {
      schema: tmp_schema.rxdb_json
    }
    await DDSchema.rxdb.addCollections(collection_schema)
  }
  // Upsert root data
  rootData.CID = String(CID.create(1, code, await sha256.digest(encode(rootData.content))))
  await DDSchema.rxdb.ddroot.upsert(rootData);
  console.log("schema setup complete")
  DDSchema.schemas = {}
  for (const schema of DDSchema.specification.schemas) {
    DDSchema.schemas[schema.schema_name] = schema
  }
  return DDSchema
}


export default async function init() {
  // Check if root schema exists or not
  try {
    const query = await DDSchema.rxdb.ddroot
      .findOne({
        selector: {
          id: 'root'
        }
      })
    console.log("Found previous root schema")
    console.log(query.documentInDb)
    if (query.documentInDb == undefined) {
      return await setup_schema()
    }
  } catch (error) {
    console.log("Can't find root schema, setting on up")
    console.log(error)
    return await setup_schema()
  }
}

export async function dd_upsert(MyDDSchema, ddroot, query_name, query_data) {
  let previousCID = "bafkreieghxguqf42lefdhwc2otdmbn5snq23skwewpjlrwl4mbgw6x7wey"
  let query_ipns = ddroot[0]._data.content.app_ipns_lookup[query_name]
  let query_check = null
  let CID_code = null
  if (!Object.keys(query_data).includes("id")) {
    return {
      "status": "error",
      "success": "your query_data requires an id key to use dd_upsert",
      "query_data": query_data
    }
  }
  let tmp_upsert_data = query_data
  // console.log("MyDDSchema.schemas[query_name]")
  // console.log(query_name)
  // console.log(MyDDSchema.schemas[query_name])
  // console.log(MyDDSchema.schemas)
  try {
    if (MyDDSchema.schemas[query_name].index_type == "logged") {
      query_check = await MyDDSchema.rxdb[query_ipns]
        .findOne({
          selector: {
            "id": query_data.id
          }
        })
      if (query_check._result != null) {
        previousCID = query_check[0]._data.id
      }
      if (previousCID == undefined) {
        previousCID = "bafkreieghxguqf42lefdhwc2otdmbn5snq23skwewpjlrwl4mbgw6x7wey"
      }
      try {
        CID_code = await String(CID.create(1, code, await sha256.digest(encode(query_data))))
        // console.log("tmp_upsert_data")
        // console.log(tmp_upsert_data)
        // console.log("CID_code")
        // console.log(CID_code)
        // console.log("query_data")
        // console.log(query_data)
        let cid_insert = await MyDDSchema.rxdb.cid_store.upsert({
          id : CID_code,
          CID : JSON.stringify(query_data)
        })
      } catch (error) {
        return {
          "status": "error",
          "error_description": error,
          "error": "dd_upsert failed",
          "data": query_data
        }
      }
      tmp_upsert_data = {
        id: query_data.id,
        CID: CID_code,
        previousCID: previousCID,
        content: query_data
      }
    }
  } catch (error) {
    console.log({
      "status": "error",
      "error": error,
      "error_description": "Unable to perform dd_upsert due to error"
    })
    return {
      "status": "error",
      "error": error,
      "error_description": "Unable to perform dd_upsert due to error"
    }
  }

  // console.log("tmp_upsert_data")
  // console.log(tmp_upsert_data)
  query_check = await MyDDSchema.rxdb[query_ipns].upsert(tmp_upsert_data)


  // let actually_check_query = await MyDDSchema.rxdb[query_ipns].find({
  //   "selector" : {
  //     "id" : tmp_upsert_data.id
  //   }
  // }).exec()
  // if(actually_check_query.length == 0){
  //   return {
  //     "status": "error",
  //     "success": "Could not find data that was supposed to be upserted",
  //     "query_check": actually_check_query
  //   }
  // }
  // console.log("actually_check_query")
  // console.log(actually_check_query[0]._data)

  return {
    "status": "success",
    "success": "Seems to have inserted",
    "query_check": query_check._data
  }

}


// const myDocument = await myRxDatabase.dd.upsert({
//   id: 'root',
//   CID: 'TODO',
//   previousCID: "TODO",
//   content: {
//     timestamp_ms: new Date()
//   }
// });


// const foundDocuments = await myRxDatabase.dd.find({
//   selector: {
//     id: {
//       $eq: 'root'
//     }
//   }
// }).exec();


// console.log("\n")
// console.log("foundDocuments")
// console.log(Object.keys(foundDocuments[0]._data))


// console.log("List Collections")
// console.log(
//   Object.keys(myRxDatabase.collections)
// )
