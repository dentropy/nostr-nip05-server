import { dd_upsert } from '../dd-schema/index.js'
import bs58 from 'bs58'
import Ajv from 'ajv'
import { generate_nostr_dot_json } from './generate-nostr-dot-json.js'

export async function generate_nostr_dot_json_with_validation(MyDDSchema, ddroot, req, nostr_content_json) {
    const text_encoder = new TextEncoder()
    let nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
    let nostr_did = "did:key:" + nostr_base58
    // TODO
    // Role validation
    // let check_root_role = await MyDDSchema.rxdb[
    //     ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]
    // ]
    //     .findOne({
    //         selector: {
    //             "content.role": "root",
    //             "content.user_did": nostr_did
    //         }
    //     }).exec();
    // if (check_root_role._data.content.user_did != nostr_did) {
    //     res.send({
    //         "status": "error",
    //         "error": `Failed role validation, you can't run function_name = upsert_data`
    //     })
    // }
    return(  await generate_nostr_dot_json(MyDDSchema, ddroot, req, nostr_content_json)  )

}