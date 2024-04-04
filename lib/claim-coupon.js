import { finalizeEvent, verifyEvent } from 'nostr-tools';
import * as nip19 from 'nostr-tools/nip19'
import { dd_token_logic } from './dd-token-logic.js';
import bs58 from 'bs58'
// import { dd_token_checker } from './dd-token-checker.js' 


export async function claim_coupon(MyDDSchema, ddroot, req, res, nostr_content_json) {
    const text_encoder = new TextEncoder()
    let check_coupon = null;
    let check_private_key = null;
    let check_from_did_balance = 0;
    let get_token_state = null;
    try {
        // Check coupon exists
        check_coupon = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.coupon-to-dd20.coupon_codes"]
        ]
            .find({
                selector: {
                    "id": nostr_content_json.body.coupon_code
                }
            }).exec();
        if (check_coupon.length == 0) {
            return({
                "status": "error",
                "error": `coupon_code_does_not_exist`
            })
        }
        // Get private key from PKI
        check_private_key = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-private-key-infastructure.private_keys"]
        ]
            .find({
                selector: {
                    "id": check_coupon[0]._data.did_owner
                }
            }).exec();
        if (check_private_key.length == 0) {
            return({
                "status": "error",
                "error": `private_key_did_does_not_exist_coupon_creation_was_invalid`
            })
        }
        // Check balance of token using public key (did)
        try {
            check_from_did_balance = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
            ]
                .find({
                    selector: {
                        "id": check_coupon[0]._data.content.token_id + "_" + check_coupon[0]._data.content.did_owner
                    }
                }).exec();
            check_from_did_balance = check_from_did_balance[0]._data.balance
        } catch (error) {
            return({
                "status": "error",
                "error": `could_not_check_token_balance_for_the_token`,
                "error_description": check_from_did_balance,
                "token_id_error": check_coupon[0]._data.content.token_id + "_" + check_coupon[0]._data.content.did_owner
            })
        }
        if (check_from_did_balance == 0) {
            return({
                "status": "error",
                "error": `This coupon used to be valid but is no longer`,
                "description": check_from_did_balance[0]._data.content.balance,
                data: check_from_did_balance
            })
        }
        try {
            get_token_state = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            ]
                .find({
                    selector: {
                        "id": check_coupon[0]._data.content.token_id
                    }
                }).exec();
        } catch (error) {
            return({
                "status": "error",
                "error": `Could not fetch token_state`,
                "error_description": error
            })
        }
        // Sign transaction using private key
        let token_content_json = null
        try {
            // console.log("req_body_pubkey")
            // console.log(req.body.pubkey)
            let reciever_did = "did:key:" + await bs58.encode(await text_encoder.encode(String(req.body.pubkey)))


            // console.log(reciever_did)

            token_content_json = {
                "function_name": "dd_token",
                "body": {
                    "app_name": "DD_token_RBAC",
                    "version": "0.0.1",
                    "last_transaction_CID": get_token_state[0]._data.content.previous_CID,
                    "token_id": check_coupon[0]._data.content.token_id,
                    "from_did": check_coupon[0]._data.content.did_owner,
                    "to_did": reciever_did,
                    "operation_name": "transfer",
                    "timestamp_ms": Date.now(),
                    "value": 12,
                    "did_nonce": 1,
                    "token_nonce": 2,
                    "memo": "",
                    "operation_data" : {}
                }
            }
            // console.log("token_content_json")
            // console.log(token_content_json)
            // console.log(check_private_key[0]._data.content.raw_private_key)
            // console.log(check_private_key[0]._data.content.raw_private_key.slice(4))
            let { type, data } = nip19.decode(check_private_key[0]._data.content.raw_private_key)
            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify(token_content_json),
            }, data)
            // console.log(signedEvent)
            // console.log(signedEvent)
        } catch (error) {
            return ({
                "status": "error",
                "error_description": `could_not_sign_transaction_for_some_reason`,
                "error": error
            })
        }


        let dd_token_result = null;
        try {
            dd_token_result = await dd_token_logic(
                MyDDSchema,
                ddroot,
                {
                    body: {
                        pubkey: check_private_key[0]._data.content.raw_public_key
                    }
                },
                token_content_json
            )
            return ({
                "status": "success",
                "success": `Token transfer should be sucessful, check your balance`
            })
        } catch (error) {
            return ({
                "status": "error",
                "error_description": `Could not send token redeeming coupon`,
                "dd_token_result": dd_token_result,
                error: error
            })
        }


    } catch (error) {
        return ({
            "status": "error",
            "error_description": `claim_coupon resulted in error`,
            "error": error
        })
    }
}