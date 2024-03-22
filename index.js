import express from 'express';

import DDSchema from './dd-schema/index.js'
import { dd_upsert } from './dd-schema/index.js'
import bs58 from 'bs58'
import { decode } from "nostr-tools/nip19"


import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'

import { verifyEvent } from 'nostr-tools'
import Ajv from 'ajv'

// Configure Express
var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json())

let MyDDSchema = {}
let ddroot = {}
const text_encoder = new TextEncoder()
async function setup() {
    // Check if admin key is loaded from dotenv
    // console.log(Deno.env)
    if (!Deno.env.has("NOSTR_ROOT_PUBLIC_KEY")) {
        throw new Error('You need to set NOSTR_ROOT_PUBLIC_KEY environment variable or use .env file');
    }
    MyDDSchema = await DDSchema()

    // Load ddroot to lookip app schema/tables/indexes
    ddroot = await MyDDSchema.rxdb.ddroot.find({
        selector: {
            id: {
                $eq: "root"
            }
        }
    }).exec();


    // console.log(ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"])

    let decoded_npub = decode(Deno.env.get("NOSTR_ROOT_PUBLIC_KEY"))
    console.log("decoded_npub")
    console.log(decoded_npub)
    let nostr_base58 = await bs58.encode(await text_encoder.encode(decoded_npub.data))
    console.log(nostr_base58)
    let nostr_did = "did:key:" + nostr_base58



    const multicodec_nostr_key = CID.create(1, 0xe7, await sha256.digest(encode(decoded_npub)))
    console.log("multicodec_nostr_key")
    console.log(multicodec_nostr_key)

    console.log("\n\n")
    console.log("HELLOW WORLD")
    // console.log(ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"])
    // console.log(MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]])
    // console.log(Object.keys(MyDDSchema.rxdb.collections))
    let check_RBAC = await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]].find({
        selector: {
            content: {
                did: {
                    $eq: nostr_did
                }
            }
        }
    }).exec();
    if (check_RBAC.length == 0) {
        let tmp_content = {
            user_did: "did:key:" + String(nostr_base58),
            user_multicodec: String(multicodec_nostr_key),
            role: "root"
        }
        let CID_code = await String(CID.create(1, code, await sha256.digest(encode(tmp_content))))
        let tmp_ID = `${multicodec_nostr_key}-root`
        await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]].insert(
            {
                id: tmp_ID,
                CID: CID_code,
                previousCID: "bafkreieghxguqf42lefdhwc2otdmbn5snq23skwewpjlrwl4mbgw6x7wey",
                content: tmp_content
            }
        )
    }


    // console.log("MY SCHEMA")
    // console.log(MyDDSchema)
    // console.log(Object.keys(MyDDSchema))
}
await setup()

app.get('/', (req, res) => {
    res.send("Hello, World! This is a GET request. <a href='/.well-known/nostr.json'>Well Known</a>");
});


app.get('/.well-known/nostr.json', async (req, res) => {
    // Get the first domain name from nip05
    let query = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.domain-name-metadata.domain_name_kv"]].
        find({
            "selector": {
                "content.key" : "generate_nostr_dot_json" 
            }
        }).exec()
    if(query.length > 0) {
        let nostr_dot_json_query = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.raw_nostr_dot_json"]].
        find({
            "selector": {
                "id" : query[0]._data.content.domain_name
            }
        }).exec()
        if(nostr_dot_json_query.length == 0) {
            res.send({
                "status" : "error",
                "error" : "nostr_dot_json_query did not return anything"
            })        
            return true
        }
        console.log(nostr_dot_json_query[0])
        res.send(JSON.parse(nostr_dot_json_query[0]._data.content.nostr_dot_json_stringified))        
        return true
    } else {
        res.send({
            "status": "error",
            "error": "no nostr.json files configured"
        })
        return true
    }
});


app.post("/napi", async function (req, res) {
    console.log("req.body for /napi")
    console.log(req.body)

    // Check if nostr event is valid
    let event_is_verified = await verifyEvent(req.body)
    if (!event_is_verified) {
        res.send({
            "status": "error",
            "error": "Could not verify nostr event"
        })
        return false
    }

    // JSON.prase content form nostr event
    let nostr_content_json = {}
    try {
        nostr_content_json = JSON.parse(req.body.content)
    } catch (error) {
        res.send({
            "status": "error",
            "error": "could not JSON.parse content of nostr event"
        })
        return false
    }

    // Check for DD tag
    console.log(req.body.tags[0])
    if (req.body.tags[0][0] != 'DD') {
        res.send({
            "status": "error",
            "error": "event missing tag 'DD'"
        })
        return false
    }

    // Validate the nostr_content_json has a function_name and body
    let dd_json_name_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Generated schema for Root",
        "type": "object",
        "properties": {
            "function_name": {
                "type": "string"
            },
            "body": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        "required": [
            "function_name",
            "body"
        ]
    }
    var ajv = new Ajv()
    var dd_json_name_schema_validator = ajv.compile(dd_json_name_schema)
    if (!dd_json_name_schema_validator(nostr_content_json)) {
        res.send({
            "status": "error",
            "error": `stringified JSON in content of event does not follow this JSON schema \n\n${JSON.stringify(dd_json_name_schema, null, 2)}`
        })
        return false
    }



    // Series of if statments, with role validation, and actual function logic
    if (nostr_content_json.function_name == "upsert_data") {
        // Role validation
        let nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
        let nostr_did = "did:key:" + nostr_base58
        let check_root_role = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]
        ]
            .findOne({
                selector: {
                    "content.role": "root",
                    "content.user_did": nostr_did
                }
            }).exec();
        if (check_root_role._data.content.user_did != nostr_did) {
            res.send({
                "status": "error",
                "error": `Failed role validation, you can't run function_name = upsert_data`
            })
        }
        // Acutal Function Logic
        let tmp_json_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Generated schema for Root",
            "type": "object",
            "properties": {
                "query_name": {
                    "type": "string"
                },
                "query_data": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string"
                        }
                    },
                    "required": [
                        "id"
                    ]
                }
            },
            "required": [
                "query_name",
                "query_data"
            ]
        }
        var ajv = new Ajv()
        var usert_data_json_schema = ajv.compile(tmp_json_schema)
        if (!usert_data_json_schema(nostr_content_json.body)) {
            res.send({
                "status": "error",
                "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(tmp_json_schema, null, 2)}`
            })
            return false
        }
        // Perform the actual upsert
        try {
            // Find if data already in database
            let query_check = dd_upsert(
                MyDDSchema,
                ddroot,
                nostr_content_json.body.query_name,
                nostr_content_json.body.query_data
            )
            // let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body.query_data))))
            // let previousCID = "bafkreieghxguqf42lefdhwc2otdmbn5snq23skwewpjlrwl4mbgw6x7wey"
            // if (MyDDSchema.schemas[nostr_content_json.body.query_name].index_type == "logged") {
            //     const query_check = await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup[nostr_content_json.body.query_name]]
            //         .findOne({
            //             selector: {
            //                 id: nostr_content_json.body.query_data.id
            //             }
            //         })
            //     if (query_check._result != null) {
            //         res.send({
            //             "status": "error",
            //             "error": `Still need to impliment the CID stuff`
            //         })
            //         return false
            //     }
            // }
            // let tmp_upsert_data = {
            //     id: nostr_content_json.body.query_data.id,
            //     CID: CID_code,
            //     previousCID: previousCID,
            //     content: nostr_content_json.body.query_data
            // }
            // await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup[nostr_content_json.body.query_name]].upsert(
            //     tmp_upsert_data
            // )
            // const query_check = await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup[nostr_content_json.body.query_name]].upsert(nostr_content_json.body.query_data)
            // console.log("query_check NOT logged upsert")
            // console.log(Object.keys(query_check))
            res.send({
                "status": "success",
                "success": `here is query_check\n${JSON.stringify(query_check, null, 2)}`
            })
            return false
        } catch (error) {
            res.send({
                "status": "error",
                "error": `upsert error\n${error}`
            })
            return true
        }

    }


    if (nostr_content_json.function_name == "find_query") {
        // Role validation
        let nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
        let nostr_did = "did:key:" + nostr_base58
        let check_root_role = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]
        ]
            .findOne({
                selector: {
                    "content.role": "root",
                    "content.user_did": nostr_did
                }
            }).exec();
        if (check_root_role._data.content.user_did != nostr_did) {
            res.send({
                "status": "error",
                "error": `Failed role validation, you can't run function_name = upsert_data`
            })
        }
        // Acutal Function Logic
        var ajv = new Ajv()
        var usert_data_json_schema = ajv.compile({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Generated schema for Root",
            "type": "object",
            "properties": {
                "query_name": {
                    "type": "string"
                },
                "query_data": {
                    "type": "object"
                }
            },
            "required": [
                "query_name",
                "query_data"
            ]
        })
        if (!usert_data_json_schema(nostr_content_json.body)) {
            res.send({
                "status": "error",
                "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(usert_data_json_schema)}`
            })
            return false
        }
        // Perform find query
        try {
            console.log("nostr_content_json.body.query_name")
            console.log(nostr_content_json.body.query_name)

            let query = await MyDDSchema.
                rxdb[ddroot[0]._data.content.app_ipns_lookup[nostr_content_json.body.query_name]].
                find(nostr_content_json.body.query_data).exec()

            res.send({
                "status": "success",
                "success": "Here is the find data",
                "data": query
            })
            return true

        } catch (error) {
            res.send({
                "status": "error",
                "error": `Could not execute the rxdb query sucessfully, did you forget the selector?\n${error}\n${JSON.stringify(error)}`
            })
            return false
        }
    }


    if (nostr_content_json.function_name == "generate_nostr_dot_json") {
        // Role validation
        let nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
        let nostr_did = "did:key:" + nostr_base58
        let check_root_role = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]
        ]
            .findOne({
                selector: {
                    "content.role": "root",
                    "content.user_did": nostr_did
                }
            }).exec();
        if (check_root_role._data.content.user_did != nostr_did) {
            res.send({
                "status": "error",
                "error": `Failed role validation, you can't run function_name = upsert_data`
            })
        }
        // Acutal Function Logic
        var ajv = new Ajv()
        var usert_data_json_schema = ajv.compile({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Generated schema for Root",
            "type": "object",
            "properties": {
                "domain_name": {
                    "type": "string"
                }
            },
            "required": [
                "domain_name"
            ]
        })
        if (!usert_data_json_schema(nostr_content_json.body)) {
            res.send({
                "status": "error",
                "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(usert_data_json_schema)}`
            })
            return false
        }
        // Check if we have the nip05 to generate nostr.json
        try {

            let query = await MyDDSchema.
                rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.domain-name-metadata.domain_name_kv"]].
                find({
                    selector: {
                        "content.domain_name" : nostr_content_json.body.domain_name
                    }
                }).exec()
            // Now loop through and generate the nostr.json
            console.log("WE_LOG_HERE")
            console.log(nostr_content_json.body.domain_name)
            console.log(Object.keys(query))
            if(query.length == 0){
                res.send({
                    "status": "error",
                    "descripiton" : "WE_LOG_HERE Could not find anything",
                    "error": `Could not find anything for dns=${nostr_content_json.body.domain_name}`
                })
                return true
            }
            if (query[0]._data.content.key == "generate_nostr_dot_json") {
                try {
                    query = await MyDDSchema.
                        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.internet_identifiers"]].
                        find({
                            // "content.domain_name": undefined// nostr_content_json.body.dns_name
                            "selector": {
                                //"content.domain_name" : nostr_content_json.body.domain_name
                                "id": {
                                    $regex: `.@${nostr_content_json.body.domain_name}`
                                }
                            }
                        }).exec()
                    let tmp_nostr_dot_json = {
                        "names": {},
                        "relays": {}
                    }
                    if(query.length == 0){
                        res.send({
                            "status": "error",
                            "error": `Could not query for nostr-nip05-server.nip05.internet_identifiers`
                        })
                        return false
                    }
                    for (const tmp_internet_identifier of query) {
                        tmp_nostr_dot_json.names[tmp_internet_identifier._data.content.username] = tmp_internet_identifier._data.content.public_key
                        tmp_nostr_dot_json.relays[tmp_internet_identifier._data.content.public_key] = tmp_internet_identifier._data.content.relay_list
                    }
                    // Save nostr.json
                    try {
                        console.log("Do_we_do_the_dd_upsert")
                        let return_status = await dd_upsert(
                            MyDDSchema,
                            ddroot,
                            "nostr-nip05-server.nip05.raw_nostr_dot_json",
                            {
                                id: nostr_content_json.body.domain_name,
                                nostr_dot_json_stringified: JSON.stringify(tmp_nostr_dot_json)
                            }
                        )
                        res.send(return_status)
                        return true
                    } catch (error) {
                        res.send({
                            "status": "error",
                            "error": `dd_upsert failed\n${error}`
                        })
                        return false
                    }
                } catch (error) {
                    res.send({
                        "status": "error",
                        "description" : "Could not update domain name",
                        "error": error
                    })
                    return true
                }
            } else {
                res.send({
                    "status": "error",
                    "error": "That domain name is not configued to genereate nostr.json",
                    "data": JSON.stringify(query, null, 2)
                })
                return true
            }
        } catch (error) {
            res.send({
                "status": "error",
                "error": `Second Could not execute the rxdb query sucessfully, did you forget the selector?\n${error}\n${JSON.stringify(error)}`
            })
            return false
        }
    }


    res.send({
        "status": "error",
        "error": `function_name does not exist or could not be run properly`
    })
    return true
})


var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("\n\nExample app listening at http://%s:%s", host, port)
})