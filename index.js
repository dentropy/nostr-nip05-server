import express from 'express';

import DDSchema from './dd-schema/index.js'
import { dd_upsert } from './dd-schema/index.js'
import { dd_token_logic } from './lib/dd-token-logic.js'
import { upsert_nip05 } from './lib/upsert-nip05.js';
import { check_coupon } from './lib/check-coupon.js'


import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'

import bs58 from 'bs58'
import { generateSecretKey, verifyEvent, getPublicKey } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import { decode } from "nostr-tools/nip19"

import Ajv from 'ajv'
import { find_query } from './lib/find-query.js';
import { upsert_data } from './lib/upsert-data.js';
import { claim_coupon } from './lib/claim-coupon.js';
import { express_setup } from './lib/express-setup.js';
import { generate_nostr_dot_json_with_validation } from './lib/generate-nostr-dot-json-with-validation.js';
import { claim_internet_identifier } from './lib/claim-internet-identifier.js';
import { set_web_key_identifier } from './lib/upsert-web-key-identifier.js'
import { list_dd_tokens } from './lib/list-dd-tokens.js';
import { get_dd_token_state } from './lib/get-dd-token-state.js';
import { internet_identifier_token_checker } from './lib/internet-identifier-token-checker.js';
import { query_dd_token_balances } from './lib/query-dd-token-balances.js';
import { query_dd_token_transactions } from './lib/query-dd-token-transactions.js';

// Configure Express
var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json())


// Setup stuff
let setup_data = await express_setup()
let MyDDSchema = setup_data.MyDDSchema
let ddroot = setup_data.ddroot

const nostr_event_log = await Deno.openKv("./nostr_event_log/nostr_event_log.db");

app.get('/', (req, res) => {
    res.send("Hello, World! This is a GET request. <a href='/.well-known/nostr.json'>Well Known</a>");
});


app.get('/.well-known/nostr.json', async (req, res) => {
    // Get the default domain name
    let default_domain_name = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["default_well_known_domain_name"]].
        find({
            "selector": {
                "id": "default"
            }
        }).exec()
    if(default_domain_name.length == 0){
        res.send({
            "status": "error",
            "error": "No default domain name configured"
        })
        return true
    }
    // Get the first domain name from nip05
    let check_nostr_dot_json = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.domain-name-metadata.domain_name_kv"]].
        find({
            "selector": {
                "content.key": "generate_nostr_dot_json"
                ,"content.domain_name" : default_domain_name[0]._data.domain_name

            }
        }).exec()
    if (check_nostr_dot_json.length > 0) {
        let nostr_dot_json_query = await MyDDSchema.
            rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.raw_nostr_dot_json"]].
            find({
                "selector": {
                    "id": check_nostr_dot_json[0]._data.content.domain_name
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

app.get('/.well-known/openpgpkey/hu/:key_identifier', async (req, res) => {
    // Get the default domain name
    console.log(req.params.key_identifier)
    let default_domain_name = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["default_well_known_domain_name"]].
        find({
            "selector": {
                "id": "default"
            }
        }).exec()
    if(default_domain_name.length == 0){
        res.send({
            "status": "error",
            "error": "No default domain name configured"
        })
        return true
    }
    // Try ans resolve the hash of username
    let resolve_hash = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.web-key-directory.web_key_identifiers"]].
        find({
            "selector": {
                "content.username_hash": req.params.key_identifier
                ,"content.domain_name" : default_domain_name[0]._data.domain_name

            }
        }).exec()
    if (resolve_hash.length == 0) {
        res.send({
            "status": "error",
            "error": "Could not resolve hash of username"
        })
    } else {
        res.send(resolve_hash[0]._data.content.pgp_key)
        return true
    }
});

app.get('/dd/:domain_name/.well-known/openpgpkey/hu/:key_identifier', async (req, res) => {
    // Try ans resolve the hash of username
    let resolve_hash = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.web-key-directory.web_key_identifiers"]].
        find({
            "selector": {
                "content.username_hash": req.params.key_identifier
                ,"content.domain_name" : req.params.domain_name

            }
        }).exec()
    if (resolve_hash.length == 0) {
        res.send({
            "status": "error",
            "error": "Could not resolve hash of username"
        })
    } else {
        res.send(resolve_hash[0]._data.content.pgp_key)
        return true
    }
});

app.get('/dd/:domain_name/.well-known/nostr.json', async (req, res) => {
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
                    "id": req.params.domain_name
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


app.get('/apps', async (req, res) => {
    res.send({
        app_name  : setup_data.ddroot[0]._data.app_name,
        app_key   : setup_data.ddroot[0].CID,
        admin_did : setup_data.admin_did
    })
    return true
})

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
    await nostr_event_log.set([req.body.id], JSON.stringify(req.body))
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


    if(nostr_content_json.app_name != setup_data.ddroot[0]._data.app_name){
        res.send({
            "status": "error",
            "error": `Invalid app_name please check /apps to discover what apps you can interact with\n${nostr_content_json.app_name}!=${setup_data.ddroot[0]._data.app_name}`,
            "nostr_content_json" : nostr_content_json
        })
        return true
    }
    if(nostr_content_json.app_key != setup_data.ddroot[0].CID){
        res.send({
            "status": "error",
            "error": `Invalid app_key please check /apps to discover what apps you can interact with`
        })
        return true
    }

    // Series of if statments, with role validation, and actual function logic
    if (nostr_content_json.function_name == "upsert_data") {
        res.send(await upsert_data(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "find_query") {
        res.send(await find_query(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "generate_nostr_dot_json") {
        res.send(await generate_nostr_dot_json_with_validation(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "upsert_nip05") {
        res.send(await upsert_nip05(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "set_web_key_identifier") {
        res.send(await set_web_key_identifier(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "dd_token") {
        res.send(await dd_token_logic(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "check_coupon") {
        res.send(await check_coupon(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "claim_coupon") {
        res.send(await claim_coupon(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "claim_internet_identifier") {
        res.send(await claim_internet_identifier(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "internet_identifier_token_checker") {
        res.send(await internet_identifier_token_checker(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }

    // Token Data Functions
    if (nostr_content_json.function_name == "list_dd_tokens") {
        res.send(await list_dd_tokens(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "query_dd_token_balances") {
        res.send(await query_dd_token_balances(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "get_dd_token_state") {
        res.send(await get_dd_token_state(MyDDSchema, ddroot, req, nostr_content_json))
        return true
    }
    if (nostr_content_json.function_name == "query_dd_token_transactions") {
        res.send(await query_dd_token_transactions(MyDDSchema, ddroot, req, nostr_content_json))
        return true
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