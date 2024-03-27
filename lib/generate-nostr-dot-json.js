import { dd_upsert } from '../dd-schema/index.js'
import bs58 from 'bs58'
import Ajv from 'ajv'


export async function generate_nostr_dot_json(MyDDSchema, ddroot, req, res, nostr_content_json) {
    const text_encoder = new TextEncoder()
    let nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
    let nostr_did = "did:key:" + nostr_base58
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