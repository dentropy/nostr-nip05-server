import express from 'express';

import DDSchema from './dd-schema/index.js'
import { validate_dd_token_transaction } from "./lib/dd-token-checker.js"
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
    let nostr_base58 = await bs58.encode(await text_encoder.encode(decoded_npub.data))
    let nostr_did = "did:key:" + nostr_base58



    const multicodec_nostr_key = CID.create(1, 0xe7, await sha256.digest(encode(decoded_npub)))

    // console.log("decoded_npub")
    // console.log(decoded_npub)
    // console.log(nostr_base58)
    // console.log("multicodec_nostr_key")
    // console.log(multicodec_nostr_key)
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
                "content.key": "generate_nostr_dot_json"
            }
        }).exec()
    if (query.length > 0) {
        let nostr_dot_json_query = await MyDDSchema.
            rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.raw_nostr_dot_json"]].
            find({
                "selector": {
                    "id": query[0]._data.content.domain_name
                }
            }).exec()
        if (nostr_dot_json_query.length == 0) {
            res.send({
                "status": "error",
                "error": "nostr_dot_json_query did not return anything"
            })
            return true
        }
        // console.log(nostr_dot_json_query[0])
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
    // console.log("req.body for /napi")
    // console.log(req.body)

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
    // console.log(req.body.tags[0])
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
            // console.log("nostr_content_json.body.query_name")
            // console.log(nostr_content_json.body.query_name)

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

    let nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
    let nostr_did = "did:key:" + nostr_base58
    if (nostr_content_json.function_name == "generate_nostr_dot_json") {
        // Role validation
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
                        "content.domain_name": nostr_content_json.body.domain_name
                    }
                }).exec()
            // Now loop through and generate the nostr.json
            // console.log("WE_LOG_HERE")
            // console.log(nostr_content_json.body.domain_name)
            // console.log(Object.keys(query))
            if (query.length == 0) {
                res.send({
                    "status": "error",
                    "descripiton": "WE_LOG_HERE Could not find anything",
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
                    if (query.length == 0) {
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
                        "description": "Could not update domain name",
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


    if (nostr_content_json.function_name == "upsert_nip05") {
        // Validate the query_data
        var ajv = new Ajv()
        var usert_data_json_schema = ajv.compile({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Generated schema for Root",
            "type": "object",
            "properties": {
                "internet_identifier": {
                    "type": "string"
                },
                "public_key": {
                    "type": "string"
                },
                "relay_list": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": [
                "internet_identifier",
                "public_key",
                "relay_list"
            ]
        })
        if (!usert_data_json_schema(nostr_content_json.body)) {
            res.send({
                "status": "error",
                "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(usert_data_json_schema)}`
            })
            return false
        }
        // Check if internet_identifier matches with public key
        let parsed_internet_identifier = nostr_content_json.body.internet_identifier.split('@')
        if (parsed_internet_identifier.length != 2) {
            res.send({
                "status": "error",
                "error": `Invalid internet identifier\n${JSON.stringify(nostr_content_json.body.internet_identifier)}`
            })
            return false
        }
        // Parse out name and domain name form internet identifier
        let name = parsed_internet_identifier[0]
        let domain_name = parsed_internet_identifier[1]
        // Check if internet identifier is in database
        console.log("nostr_content_json.body.intenret_identifier")
        console.log(nostr_content_json.body.internet_identifier)
        if (nostr_content_json.body.internet_identifier == undefined) {
            res.send({
                "status": "error",
                "error": `body.intenret_identifier can't be undefined`,
                "body": nostr_content_json.body
            })
            return false
        }
        let query = await MyDDSchema.
            rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.internet_identifiers"]].
            find({
                selector: {
                    "id": nostr_content_json.body.internet_identifier
                }
            }).exec()
        if (query.length == 0) {
            res.send({
                "status": "error",
                "error": `internet identifier is not in database`
            })
            return false
        }
        // Check public of nostr event matches with internet_identifier
        console.log("Here_is_internet_identifier")
        console.log(query[0]._data)
        console.log(req.body.pubkey)
        console.log(query[0]._data.content.public_key)
        if (query[0]._data.content.public_key == req.body.pubkey) {
            let uspert_error = null
            try {
                let upsert_data = {
                    id: nostr_content_json.body.internet_identifier,
                    username: name,
                    public_key: nostr_content_json.body.public_key,
                    domain_name: domain_name,
                    relay_list: nostr_content_json.body.relay_list
                }
                // console.log("upsert_date")
                // console.log(upsert_data)
                uspert_error = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.nip05.internet_identifiers",
                    upsert_data
                )
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `dd_upsert failed to update nip05 internet_identifier`,
                    "error_description": error,
                    "uspert_error": uspert_error
                })
                return true
            }
            res.send({
                "status": "success",
                "success": `Got pretty far`,
                "data": query[0]._data
            })
            return true
        } else {
            res.send({
                "status": "error",
                "error": `Public key does not match`,
                "data": query[0]._data
            })
            return true
        }
    }


    if (nostr_content_json.function_name == "dd_token") {
        let raw_token_validation = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Generated schema for Root",
            "type": "object",
            "properties": {
                "app_name": {
                    "type": "string"
                },
                "version": {
                    "type": "string"
                },
                "token_id": {
                    "type": "string"
                },
                "from_did": {
                    "type": "string"
                },
                "to_did": {
                    "type": "string"
                },
                "opteraion_name": {
                    "type": "string"
                },
                "timestamp_ms": {
                    "type": "number"
                },
                "value": {
                    "type": "number"
                },
                "did_nonce": {
                    "type": "number"
                },
                "token_nonce": {
                    "type": "number"
                },
                "memo": {
                    "type": "string"
                },
                "operation_data": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            "required": [
                "app_name",
                "version",
                "token_id",
                "from_did",
                "to_did",
                "operation_name",
                "timestamp_ms",
                "value",
                "did_nonce",
                "token_nonce",
                "memo",
                "operation_data"
            ]
        }
        var ajv = new Ajv()
        var usert_data_json_schema = ajv.compile(raw_token_validation)
        if (!usert_data_json_schema(nostr_content_json.body)) {
            res.send({
                "status": "error",
                "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(raw_token_validation, null, 2)}`,
                "json_schema": JSON.stringify(raw_token_validation, null, 2)
            })
            return false
        }

        // Check the token operations
        if (nostr_content_json.body.operation_name == "deploy") {
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
                    "error": `Failed role validation, only root can deploy tokens`
                })
            }
            let deploy_json_schema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "Generated schema for Root",
                "type": "object",
                "properties": {
                    "token_name": {
                        "type": "string"
                    },
                    "token_ticker": {
                        "type": "string"
                    },
                    "max_supply": {
                        "type": "number"
                    },
                    "limit_per_mint": {
                        "type": "number"
                    },
                    "decimals": {
                        "type": "number"
                    },
                    "inital_token_admins": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": [
                    "token_name",
                    "token_ticker",
                    "max_supply",
                    "limit_per_mint",
                    "decimals",
                    "inital_token_admins"
                ]
            }
            var ajv = new Ajv()
            var dd_json_name_schema_validator = ajv.compile(deploy_json_schema)
            if (!dd_json_name_schema_validator(nostr_content_json.body.operation_data)) {
                res.send({
                    "status": "error",
                    "error": `stringified JSON in content of event does not follow this JSON schema \n\n${JSON.stringify(deploy_json_schema, null, 2)}`
                    , "json_schema": JSON.stringify(deploy_json_schema, null, 2)
                })
                return false
            }
            // Calcualte token_id
            let token_id = null;
            try {
                token_id = String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `Failed to generate token_id`,
                    "description": error
                })
                return false
            }
            // Check if token already exists
            let check_token_state = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            ]
                .find({
                    selector: {
                        "id": token_id
                    }
                }).exec();
            if (check_token_state.length != 0) {
                res.send({
                    "status": "error",
                    "error": `A token with that ID already exists`
                })
                return false
            }
            // Validate token data
            if (nostr_content_json.body.from_did != nostr_did) {
                res.send({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did_": nostr_content_json.body.from_did
                    }
                })
                return false
            }
            if (nostr_content_json.body.did_nonce != 0) {
                res.send({
                    "status": "error",
                    "error": `did_nonce has to equal zero to deploy`
                })
                return false
            }
            if (nostr_content_json.body.token_nonce != 0) {
                res.send({
                    "status": "error",
                    "error": `token_nonce has to equal zero to deploy`
                })
                return false
            }
            if (nostr_content_json.body.operation_data.inital_token_admins.length >= 64) {
                res.send({
                    "status": "error",
                    "error": `Max inital_token_admins is 64`
                })
                return false
            }
            if (nostr_content_json.body.operation_data.idecimals <= 9) {
                res.send({
                    "status": "error",
                    "error": `Max Deciams is set to 9 until we move to bigint`
                })
                return false
            }
            if (nostr_content_json.body.operation_data.max_supply < nostr_content_json.body.value) {
                res.send({
                    "status": "error",
                    "error": `Value can't be higher than max supply`
                })
                return false
            }
            if (nostr_content_json.body.memo.length > 1024) {
                res.send({
                    "status": "error",
                    "error": `Memo has max length of 1024 characters`
                })
                return false
            }
            // Update token_state
            try {
                let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
                let tmp_token_state = {
                    "id": token_id,
                    "max_supply": nostr_content_json.body.operation_data.max_supply,
                    "current_supply": nostr_content_json.body.value,
                    "admin_dids": nostr_content_json.body.operation_data.inital_token_admins,
                    "token_transaction_count": 1,
                    "last_transaction_timestamp_ms": nostr_content_json.body.timestamp_ms,
                    previous_CID: CID_code
                }
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_state",
                    tmp_token_state
                )


                // console.log("query_check_token_state")
                // console.log(tmp_token_state)
                // console.log(Object.keys(query_check))
                // console.log(query_check)
                // let validation_query = await MyDDSchema
                //     .rxdb[ddroot[0]
                //         ._data
                //         .content
                //         .app_ipns_lookup["nostr-nip05-server.dd20.token_state"]]
                //     .find({
                //         selector: {
                //             "content.id" : token_id
                //         }
                //     }).exec();
                // console.log(Object.keys(validation_query))


            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_state" failed`
                })
                return false

            }
            try {
                // Update token_transactions
                let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
                let raw_transaction = JSON.stringify(nostr_content_json.body)
                nostr_content_json.body.id = token_id + "_0"
                nostr_content_json.body.CID = CID_code
                nostr_content_json.body.raw_transaction = raw_transaction
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    nostr_content_json.body
                )

                // console.log("query_check_token_transactions")
                // console.log(Object.keys(query_check))
                // let validation_query = await MyDDSchema
                //     .rxdb[ddroot[0]
                //         ._data
                //         .content
                //         .app_ipns_lookup["nostr-nip05-server.dd20.token_transactions"]]
                //     .find({
                //         selector: {
                //             "id" : token_id + "_0"
                //         }
                //     }).exec();
                // console.log(Object.keys(validation_query))
                // console.log("done_query_check_token_transactions")


            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_transactions" failed`
                })
                return false
            }
            // Update balance
            try {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: token_id + "_" + nostr_did,
                        token_id: token_id,
                        did: nostr_did,
                        nonce: 0,
                        balance: nostr_content_json.body.value

                    }
                )
                res.send({
                    "status": "success",
                    "success": `token ${token_id} created`
                })
                return false
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_balances`
                })
                return false
            }
        }
        if (nostr_content_json.body.operation_name == "mint") {
            if (nostr_content_json.body.from_did != nostr_did) {
                res.send({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did_": nostr_content_json.body.from_did
                    }
                })
                return false
            }
            let check_token_data = await validate_dd_token_transaction(
                MyDDSchema,
                ddroot,
                nostr_content_json.body
            )
            if (check_token_data.status != "success") {
                res.send(check_token_data)
                return false
            }

            // validate_dd_token_transaction does this now
            // let check_token_state = await MyDDSchema.rxdb[
            //     ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            // ]
            //     .find({
            //         selector: {
            //             "id": nostr_content_json.body.token_id
            //         }
            //     }).exec();
            // if (check_token_state.length == 0) {
            //     res.send({
            //         "status": "error",
            //         "error": `That token does not exist`
            //     })
            //     return false
            // }
            // Validate operation_data
            // if (!Object.keys(nostr_content_json.body.operation_data).includes("to_did")) {
            //     res.send({
            //         "status": "error",
            //         "error": `to_did key is not in operation_data`
            //     })
            //     return false
            // }
            // if (Object.keys(nostr_content_json.body.operation_data).length != 1) {
            //     res.send({
            //         "status": "error",
            //         "error": `invalid number of keys, should only be 1 and it should be to_did`
            //     })
            //     return false
            // }
            // check from_did
            if (nostr_content_json.body.from_did != nostr_did) {
                res.send({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did_": nostr_content_json.body.from_did
                    }
                })
                return false
            }
            // Check admin
            if (!check_token_data.token_state[0]._data.content.admin_dids.includes(nostr_did)) {
                res.send({
                    "status": "error",
                    "error": `nostr_did submitted is not in token_admin list`
                })
                return false
            }
            // Check only minting max ammount
            // if (check_token_data.token_state[0]._data.limit_per_mint < nostr_content_json.body.value) {
            //     res.send({
            //         "status": "error",
            //         "error": `Trying to mint too many tokens limit is ${check_token_data.token_state[0]._data.content.limit_per_mint}`
            //     })
            //     return false
            // }
            // Check if minting will reach max supply
            if (check_token_data.token_state[0]._data.max_supply < check_token_data.token_state[0]._data.content.current_supply + nostr_content_json.body.value) {
                res.send({
                    "status": "error",
                    "error": `Minting that many tokens will be more than max supply`,
                    "data": {
                        max_supply: check_token_data.token_state[0]._data.content.max_supply,
                        current_supply: check_token_data.token_state[0]._data.content.current_supply
                    }
                })
                return false
            }
            // Add to transactions
            nostr_content_json.body.id = nostr_content_json.body.token_id + "_" + nostr_content_json.body.token_nonce
            try {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    nostr_content_json.body
                )
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_transactions" failed`
                })
                return false
            }
            // Update to token_state
            try {
                let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
                let tmp_token_state = JSON.parse(JSON.stringify(check_token_data.token_state[0]._data.content))
                tmp_token_state.current_supply += nostr_content_json.body.value
                tmp_token_state.token_transaction_count += 1
                tmp_token_state["previous_CID"] = CID_code
                console.log("tmp_token_state")
                console.log(tmp_token_state)
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_state",
                    tmp_token_state
                )
                // console.log(Object.keys(query_check.query_check))
                // console.log(query_check.query_check._data)
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_state" failed`,
                    "error_description": error
                })
                return false
            }
            // Check Balance
            let check_token_balance = 0;
            try {
                check_token_balance = await MyDDSchema.rxdb[
                    ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
                ]
                    .find({
                        selector: {
                            "id": nostr_content_json.body.token_id + "_" + nostr_content_json.body.operation_data.to_did
                        }
                    }).exec();
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `Can't check token balance`,
                    "error_description": error
                })
                return false
            }

            // Add to balances
            let token_balance_id = nostr_content_json.body.token_id + "_" + nostr_content_json.body.operation_data.to_did
            // console.log("token_balance_id")
            // console.log(token_balance_id)
            if (check_token_balance.length == 0) {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: token_balance_id,
                        token_id: nostr_content_json.body.token_id,
                        did: nostr_content_json.body.operation_data.to_did,
                        nonce: 0,
                        balance: nostr_content_json.body.value

                    }
                )
                res.send({
                    "status": "success",
                    "success": `${nostr_content_json.body.operation_data.to_did} balance set to ${nostr_content_json.body.value}`
                })
                return false
            }
            else {
                let new_balance = check_token_balance[0]._data.balance + nostr_content_json.body.value
                // Check did_nonce
                if (check_token_balance[0]._data.content.did_nonce + 1 != nostr_content_json.body.did_nonce) {
                    res.send({
                        "status": "error",
                        "error": `did nonce did not match, it is currently ${check_token_balance[0]._data.content.did_nonce}`
                    })
                    return false
                }
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: token_balance_id,
                        token_id: nostr_content_json.body.token_id,
                        did: nostr_did,
                        nonce: 0,
                        balance: new_balance

                    }
                )
                res.send({
                    "status": "success",
                    "error": `${nostr_did} balance set to ${new_balance}`
                })
                return false
            }
        }
        if (nostr_content_json.body.operation_name == "transfer") {
            if (nostr_content_json.body.from_did != nostr_did) {
                res.send({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did_": nostr_content_json.body.from_did
                    }
                })
                return false
            }
            let check_token_data = await validate_dd_token_transaction(
                MyDDSchema,
                ddroot,
                nostr_content_json.body
            )
            // console.log("check_token_data")
            // console.log(check_token_data)
            if (check_token_data.status != "success") {
                res.send(check_token_data)
                return false
            }


            // Check if token exists
            let check_token_state = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            ]
                .find({
                    selector: {
                        "id": nostr_content_json.body.token_id
                    }
                }).exec();
            if (check_token_state.length == 0) {
                res.send({
                    "status": "error",
                    "error": `That token does not exist`
                })
                return false
            }
            // Validate operation_data
            if (!Object.keys(nostr_content_json.body.operation_data).includes("to_did")) {
                res.send({
                    "status": "error",
                    "error": `to_did key is not in operation_data`
                })
                return false
            }
            if (Object.keys(nostr_content_json.body.operation_data).length != 1) {
                res.send({
                    "status": "error",
                    "error": `invalid number of keys, should only be 1 and it should be to_did`
                })
                return false
            }
            // check from_did
            if (nostr_content_json.body.from_did != nostr_did) {
                res.send({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did_": nostr_content_json.body.from_did
                    }
                })
                return false
            }
            // Check balance from_did
            let check_from_did_balance = 0;
            try {
                check_from_did_balance = await MyDDSchema.rxdb[
                    ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
                ]
                    .find({
                        selector: {
                            "id": nostr_content_json.body.token_id + "_" + nostr_content_json.body.operation_data.to_did
                        }
                    }).exec();
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `Can't check token balance`,
                    "error_description": error
                })
                return false
            }
            // Check nonce from_did
            if (check_from_did_balance[0]._data.content.balance < nostr_content_json.body.value) {
                res.send({
                    "status": "error",
                    "error": `from_did doesn't have enought balance current balance is ${check_from_did_balance[0]._data.content.balance}`
                })
                return false
            }


            // Verify from_did has enough balance
            if (check_from_did_balance.length == 0) {
                res.send({
                    "status": "error",
                    "error": `from_did doesn't have a balance of that token`
                })
                return false
            }
            if (check_from_did_balance[0]._data.content.balance < nostr_content_json.body.value) {
                res.send({
                    "status": "error",
                    "error": `from_did doesn't have enought balance current balance is ${check_from_did_balance[0]._data.content.balance}`
                })
                return false
            }
            
            // Update to_did balance
            let to_did_balance = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
            ]
                .find({
                    selector: {
                        "id": nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did
                    }
                }).exec();
            if(to_did_balance.length == 0){
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id : nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did,
                        token_id : nostr_content_json.body.token_id,
                        did : nostr_content_json.body.to_did,
                        nonce : 0,
                        balance : nostr_content_json.body.value
                    }
                )
            } else {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id : nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did,
                        token_id : nostr_content_json.body.token_id,
                        did : nostr_content_json.body.to_did,
                        nonce : to_did_balance[0]._data.content.nonce,
                        balance : to_did_balance[0]._data.content.value + nostr_content_json.body.value
                    }
                )
            }
            // Update from_did balance
            await dd_upsert(
                MyDDSchema,
                ddroot,
                "nostr-nip05-server.dd20.token_balances",
                {
                    id : nostr_content_json.body.token_id + "_" + nostr_content_json.body.from_did,
                    token_id : nostr_content_json.body.token_id,
                    did : nostr_content_json.body.from_did,
                    nonce : check_token_data.current_balance[0]._data.content.nonce + 1,
                    balance : check_token_data.current_balance[0]._data.content.value - nostr_content_json.body.value
                }
            )
            // upsert token_state
            let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
            let check_mah_query = null
            try {
                let tmp_token_state = JSON.parse(JSON.stringify(check_token_data.token_state[0].content))
                tmp_token_state.previous_CID = CID_code
                tmp_token_state.token_transaction_count = nostr_content_json.body.token_nonce
                tmp_token_state.last_transaction_timestamp_ms =  nostr_content_json.body.timestamp_ms
                // console.log("tmp_token_state_transfer")
                // console.log(nostr_content_json.body.token_nonce)
                // console.log(tmp_token_state)
                check_mah_query = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_state",
                    tmp_token_state
                )
            } catch (error) {
                res.send({
                    "status": "error",
                    "error": `upsert for transfer "nostr-nip05-server.dd20.token_state" failed`,
                    data : error,
                    check_mah_query : check_mah_query
                })
                return false
            }
            // upsert transaction
            try {
                // Update token_transactions
                let raw_transaction = JSON.stringify(nostr_content_json.body)
                let contextualized_transaction = JSON.parse(JSON.stringify(nostr_content_json.body))
                // console.log("contextualized_transaction")
                // console.log(contextualized_transaction)
                contextualized_transaction.id = nostr_content_json.body.token_id + "_" + String(nostr_content_json.body.token_nonce)
                contextualized_transaction.CID = CID_code
                contextualized_transaction.raw_transaction = raw_transaction
                
                
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    contextualized_transaction
                )
            } catch (error) {
                res.send({
                    "status": "error",
                    "error_description": `upsert "nostr-nip05-server.dd20.token_transactions" failed`,
                    error: error

                })
                return false
            }
            res.send({
                "status": "success",
                "success": `transfer should be complete`
            })
            return false
        }
        if (nostr_content_json.body.operation_name == "rekey") {
            res.send({
                "status": "error",
                "error": `rekey is not yet implimented`
            })
            return false
        }
        if (nostr_content_json.body.operation_name == "burn") {
            res.send({
                "status": "error",
                "error": `deploy is not yet implimented`
            })
            return false
        }
        res.send({
            "status": "error",
            "error": `burn is not yet implimented`
        })
        return false
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