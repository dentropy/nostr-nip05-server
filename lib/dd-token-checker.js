

import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'



export async function validate_dd_token_transaction(
    MyDDSchema,
    ddroot,
    current_transaction
) {
    // Get token_state
    let token_state = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
    ]
        .find({
            selector: {
                id: current_transaction.token_id
            }
        }).exec();
    if (token_state.length == 0) {
        return {
            status: "error",
            error: "Can't find token"
        }
    }
    console.log("token_state_me")
    console.log(token_state[0]._data)
    // Get last transaction


    console.log("current_transaction_id")
    console.log(current_transaction.token_id + "_" + String(token_state[0]._data.content.token_transaction_count - 1))


    let last_transaction = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_transactions"]
    ]
        .find({
            selector: {
                id: current_transaction.token_id + "_" + String(token_state[0]._data.content.token_transaction_count - 1)
            }
        }).exec();
    if (last_transaction.length == 0) {
        return {
            status: "error",
            error: "Can't find last transaction"
        }
    }
    // Get current balance
    let current_balance = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
    ]
        .find({
            selector: {
                id: current_transaction.token_id + "_" + current_transaction.from_did
            }
        }).exec();
    if (current_balance.length == 0) {
        return {
            status: "error",
            error: "Can't find user balance"
        }
    }
    // Get current token_CID
    // let transaction_CID = String(CID.create(1, code, await sha256.digest(encode(current_transaction))))
    // Check Timestamp
    if (last_transaction[0]._data.timestamp_ms > current_transaction.timestamp_ms) {
        return {
            status: "error",
            error: "Invalid timestamp_ms",
            data : last_transaction[0]._data,
            last_timestamp : last_transaction[0]._data.timestamp_ms,
            your_timestamp : current_transaction.timestamp_ms
        }
    }
    // Check did_nonce
    if(current_balance[0]._data.content.nonce + 1 != current_transaction.did_nonce ){
        return {
            status: "error",
            error: "Invalid did_nonce",
            current_did_nonce : current_balance[0]._data.content.nonce,
            did_nonce_submitted : current_transaction.did_nonce
        }
    }
    // Check token_nonce
    if(token_state[0]._data.content.token_transaction_count != current_transaction.token_nonce ){
        return {
            status: "error",
            error: "Invalid_token_nonce",
            current_token_nonce : token_state[0]._data.content.token_transaction_count,
            token_nonce : current_transaction.token_nonce
        }
    }
    // Check memo length
    if(current_transaction.memo.length > 1024 ){
        return {
            status: "error",
            error: "Memo length is too long, should be 1024"
        }
    }
    // previous block CID
    console.log("token_state[0]._data.content.previous_CID")
    console.log(token_state[0]._data.content.previous_CID)
    console.log(token_state[0]._data.content)
    if (token_state[0]._data.content.previous_CID != current_transaction.last_transaction_CID) {
        return {
            status: "error",
            error: "Invalid last_transaction_CID",
            your_data : current_transaction,
            last_transaction_data : token_state[0]._data.content
        }
    }
    return {
        status: "success",
        token_state: token_state,
        last_transaction: last_transaction,
        current_balance : current_balance
    }
}
