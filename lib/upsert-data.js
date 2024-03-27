
import { dd_upsert } from '../dd-schema/index.js'
import bs58 from 'bs58'
import Ajv from 'ajv'


export async function upsert_data(MyDDSchema, ddroot, req, res, nostr_content_json) {
    // Role validation
    const text_encoder = new TextEncoder()
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