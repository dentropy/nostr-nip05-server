import { dd_upsert } from "../dd-schema/index.js";
import { generate_nostr_dot_json } from './generate-nostr-dot-json.js';
import bs58 from 'bs58'
import * as hex from "https://deno.land/std@0.220.1/encoding/hex.ts";
import { decodeBase58 } from "https://deno.land/std@0.220.1/encoding/base58.ts";

export async function claim_internet_identifier(MyDDSchema, ddroot, req, nostr_content_json) {
    // Check nostr_content_json.body has transacton_CID in it
    if (!Object.keys(nostr_content_json.body).includes("transaction_CID")) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "Missing key transaction_CID in nostr_content_json"
        })
    }
    if (Object.keys(nostr_content_json.body).length != 1) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "Too many keys in nostr_content_json"
        })
    }
    // Get transaction_CID
    let get_transaction_CID = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_transactions"]
    ]
        .find({
            selector: {
                id: nostr_content_json.body.transaction_CID
            }
        }).exec()
    if (get_transaction_CID.length == 0) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "Can't find transaction_CID, please check block explorer API"
        })
    }
    // Parse memo JSON
    let memo_json = null;
    try {
        memo_json = JSON.parse(get_transaction_CID[0]._data.memo)
    } catch (error) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "Unable to parse transaction_CID memo"
        })
    }
    // Check for internet_identifier key in JSON
    if (!Object.keys(memo_json).includes("internet_identifier")) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "Missing key internet_identifier in memo_json"
        })
    }
    if (Object.keys(memo_json).length != 1) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "Too many keys in memo_json"
        })
    }
    if (memo_json.internet_identifier.split('@').length != 2) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": `${memo_json.internet_identifier} is not a valid internet identifier with an @`
        })
    }
    // Check if internet_identifier is already claimed
    let get_internet_identifer = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.internet_identifiers"]
    ]
        .find({
            selector: {
                id: memo_json.internet_identifier
            }
        }).exec()
    console.log(Object.keys(get_internet_identifer))
    if (get_internet_identifer.length != 0) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": "That_internet_identifier_already_exists"
        })
    }
    // Check if token can claim internet identifier
    // #TODO Maybe remove the first check_token_internet_identifier later
    let check_token_internet_identifier = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.nip05.internet_identifiers"]
    ]
        .find({
            selector: {
                "content.token_id": get_transaction_CID[0]._data.token_id,
                "content.dns_name": memo_json.internet_identifier.split('@')[1]
            }
        }).exec()
    if (check_token_internet_identifier.length != 0) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": `That token is not compatible with that internet identifier=${memo_json.internet_identifier.split('@')[1]}`
        })
    }
    check_token_internet_identifier = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.domain-name-metadata.domain_name_kv"]
    ]
        .find({
            selector: {
                "content.domain_name": memo_json.internet_identifier.split('@')[1],
                "content.key": get_transaction_CID[0]._data.token_id
            }
        }).exec()
    if (check_token_internet_identifier.length == 0) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": `That token you submitted is not compatible with that domain name please check internet_identifier_token_checker for what domain names you can use`
        })
    }
    if(check_token_internet_identifier[0]._data.content.value != "valid"){
        return ({
            "status": "error",
            "error": ``,
            "error_description": `That token is not compatible with that internet identifier anymore`
        })
    }
    // Update internet_identifier list
    let parse_from_did = get_transaction_CID[0]._data.from_did
    parse_from_did = parse_from_did.split(":")[parse_from_did.split(":").length - 1]
    parse_from_did = decodeBase58(parse_from_did)
    parse_from_did = hex.encodeHex(parse_from_did)
    let query_check = await dd_upsert(
        MyDDSchema,
        ddroot,
        "nostr-nip05-server.nip05.internet_identifiers",
        {
            id: memo_json.internet_identifier,
            public_key: parse_from_did,
            user_name: memo_json.internet_identifier.split('@')[0],
            domain_name: memo_json.internet_identifier.split('@')[1],
            relay_list: ["wss://relay.damus.io/"]
        }
    )
    let nostr_dot_json_body = {
        body: {
            domain_name: memo_json.internet_identifier.split('@')[1],
        }
    }
    // TODO check error for nostr_dot_json_body
    let req_data = { body: { ppubkey: query_check.query_check.content.public_key } }
    return (
        await generate_nostr_dot_json(MyDDSchema, ddroot, req_data, nostr_dot_json_body)
    )
}