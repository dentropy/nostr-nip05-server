import { dd_upsert } from '../dd-schema/index.js'
import Ajv from 'ajv'


export async function set_web_key_identifier(MyDDSchema, ddroot, req, nostr_content_json){
    // Validate query_data
    const text_encoder = new TextEncoder()
    var ajv = new Ajv()
    var usert_data_json_schema = ajv.compile({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Generated schema for Root",
        "type": "object",
        "properties": {
            "id": {
                "type": "string"
            },
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

    // Generate username hash

    // Upsert into database

    
}