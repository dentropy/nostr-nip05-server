import { dd_upsert } from '../dd-schema/index.js'
import Ajv from 'ajv'

export async function upsert_nip05(MyDDSchema, ddroot, req, res, nostr_content_json) {
    // Validate the query_data
    const text_encoder = new TextEncoder()
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
            return({
                "status": "error",
                "error": `dd_upsert failed to update nip05 internet_identifier`,
                "error_description": error,
                "uspert_error": uspert_error
            })
        }
        return({
            "status": "success",
            "success": `Got pretty far`,
            "data": query[0]._data
        })
    } else {
        return({
            "status": "error",
            "error": `Public key does not match`,
            "data": query[0]._data
        })
    }
}