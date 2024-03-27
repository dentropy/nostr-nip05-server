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
import { generate_nostr_dot_json } from './lib/generate-nostr-dot-json.js';


// Configure Express
var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json())


// Setup stuff
let setup_data = await express_setup()
let MyDDSchema = setup_data.MyDDSchema
let ddroot = setup_data.ddroot


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
        res.send(await upsert_data(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }


    if (nostr_content_json.function_name == "find_query") {
        res.send(await find_query(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }

    if (nostr_content_json.function_name == "generate_nostr_dot_json") {
        res.send(await generate_nostr_dot_json(MyDDSchema, ddroot, req, res, nostr_content_json))
        return true
    }


    if (nostr_content_json.function_name == "upsert_nip05") {
        res.send(await upsert_nip05(MyDDSchema, ddroot, req, res, nostr_content_json))
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