import { dd_upsert } from '../dd-schema/index.js'
import Ajv from 'ajv'
import crypto from "node:crypto";
import zbase32 from "zbase32";

export async function set_web_key_identifier(MyDDSchema, ddroot, req, nostr_content_json){
    // Validate query_data
    const text_encoder = new TextEncoder()
    var ajv = new Ajv()
    var usert_data_json_schema = ajv.compile({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Generated schema for Root",
        "type": "object",
        "properties": {
            "username": {
                "type": "string"
            },
            "domain_name": {
                "type": "string"
            },
            "pgp_key" : {
                "type" : "string"
            }
        },
        "required": [
            "username",
            "domain_name",
            "pgp_key"
        ]
    })
    if (!usert_data_json_schema(nostr_content_json.body)) {
        res.send({
            "status": "error",
            "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(usert_data_json_schema)}`
        })
        return false
    }
    // Check if sender owns the internet identifier
    let query = await MyDDSchema.
        rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.internet_identifiers"]].
        find({
            selector: {
                "id": nostr_content_json.body.username + "@" + nostr_content_json.body.domain_name
            }
        }).exec()
    if (query.length == 0) {
        return({
            "status": "error",
            "error": `internet identifier is not in database`
        })
    }
    if(query[0]._data.content.public_key != req.body.pubkey){
        return({
            "status": "error",
            "error": `Invalid Public key please use ${query[0]._data.content.public_key}`
        })
    }
    // Generate username hash
    console.log("Generate Web Key Directory Hash")
    let user_name_hash = crypto.createHash('sha1');
    // console.log(Object.keys(user_name_hash))
    user_name_hash.update(nostr_content_json.body.username);
    // console.log(Object.keys(user_name_hash))
    user_name_hash = user_name_hash.digest('hex');
    // console.log(user_name_hash)
    let tmp_hash = user_name_hash
    user_name_hash = new Uint8Array(Math.ceil(tmp_hash.length / 2));
    for (var i = 0; i < user_name_hash.length; i++) user_name_hash[i] = parseInt(tmp_hash.substr(i * 2, 2), 16);
    // console.log(user_name_hash);
    user_name_hash = zbase32.encode(user_name_hash)
    console.log(user_name_hash)
    // Upsert into database
    try {
        let upsert_data =             {
            id : user_name_hash + "@" + nostr_content_json.body.domain_name,
            username : nostr_content_json.body.username,
            username_hash :  user_name_hash,
            domain_name : nostr_content_json.body.domain_name,
            pgp_key : nostr_content_json.body.pgp_key
        }
        console.log(upsert_data)
        let uspert_error = await dd_upsert(
            MyDDSchema,
            ddroot,
            "nostr-nip05-server.web-key-directory.web_key_identifiers",
            upsert_data
        )
    } catch (error) {
        return({
            "status": "error",
            "error": `Unable to upsert into database`,
            "error" : uspert_error
        })
    }
    return({
        "status" : "Success",
        "success": user_name_hash,
        "description" : "Web Key Directory Data got into database no problem"
    })

    
}