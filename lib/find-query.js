import bs58 from 'bs58'
import Ajv from 'ajv'

export async function find_query(MyDDSchema, ddroot, req, res, nostr_content_json){
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
            return({
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