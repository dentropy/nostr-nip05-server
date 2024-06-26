import { validate_dd_token_transaction } from "./dd-token-checker.js"
import { dd_upsert } from '../dd-schema/index.js'
import bs58 from 'bs58'
import { decode } from "nostr-tools/nip19"


import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'

import { generateSecretKey, verifyEvent } from 'nostr-tools'
import Ajv from 'ajv'

export async function dd_token_logic(MyDDSchema, ddroot, req, nostr_content_json) {
    const text_encoder = new TextEncoder()
    let nostr_base58 = null;
    let nostr_did = null;
    let raw_token_validation = null;
    try {
        nostr_base58 = await bs58.encode(await text_encoder.encode(req.body.pubkey))
        nostr_did = "did:key:" + nostr_base58
        raw_token_validation = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Generated schema for Root",
            "type": "object",
            "properties": {
                "app_name": {
                    "type": "string"
                },
                "version": {
                    "type": "string"
                },
                "token_id": {
                    "type": "string"
                },
                "from_did": {
                    "type": "string"
                },
                "to_did": {
                    "type": "string"
                },
                "opteraion_name": {
                    "type": "string"
                },
                "timestamp_ms": {
                    "type": "number"
                },
                "value": {
                    "type": "number"
                },
                "did_nonce": {
                    "type": "number"
                },
                "token_nonce": {
                    "type": "number"
                },
                "memo": {
                    "type": "string"
                },
                "operation_data": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            "required": [
                "app_name",
                "version",
                "token_id",
                "from_did",
                "to_did",
                "operation_name",
                "timestamp_ms",
                "value",
                "did_nonce",
                "token_nonce",
                "memo",
                "operation_data"
            ]
        }
        var ajv = new Ajv()
        var usert_data_json_schema = ajv.compile(raw_token_validation)
        if (!usert_data_json_schema(nostr_content_json.body)) {
            return ({
                "status": "error",
                "error": `function upsert_data body must be validated against the following JSON_Schema\n${JSON.stringify(raw_token_validation, null, 2)}`,
                "json_schema": JSON.stringify(raw_token_validation, null, 2)
            })
        }
    } catch (error) {
        return ({
            "status": "error",
            "error": `Inital token logic error`
        })
    }
    // Check the token operations
    try {
        if (nostr_content_json.body.operation_name == "deploy") {
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
                return ({
                    "status": "error",
                    "error": `Failed role validation, only root can deploy tokens`
                })
            }
            let deploy_json_schema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": "Generated schema for Root",
                "type": "object",
                "properties": {
                    "token_name": {
                        "type": "string"
                    },
                    "token_ticker": {
                        "type": "string"
                    },
                    "max_supply": {
                        "type": "number"
                    },
                    "limit_per_mint": {
                        "type": "number"
                    },
                    "decimals": {
                        "type": "number"
                    },
                    "inital_token_admins": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": [
                    "token_name",
                    "token_ticker",
                    "max_supply",
                    "limit_per_mint",
                    "decimals",
                    "inital_token_admins"
                ]
            }
            var ajv = new Ajv()
            var dd_json_name_schema_validator = ajv.compile(deploy_json_schema)
            if (!dd_json_name_schema_validator(nostr_content_json.body.operation_data)) {
                return ({
                    "status": "error",
                    "error": `stringified JSON in content of event does not follow this JSON schema \n\n${JSON.stringify(deploy_json_schema, null, 2)}`
                    , "json_schema": JSON.stringify(deploy_json_schema, null, 2)
                })
            }
            // Calcualte token_id
            let token_id = null;
            try {
                token_id = String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `Failed to generate token_id`,
                    "description": error
                })
            }
            // Check if token already exists
            let check_token_state = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            ]
                .find({
                    selector: {
                        "id": token_id
                    }
                }).exec();
            if (check_token_state.length != 0) {
                return ({
                    "status": "error",
                    "error": `A token with that ID already exists`
                })
            }
            // Check form_did == nostr_did
            if (nostr_content_json.body.from_did != nostr_did) {
                return ({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did": nostr_content_json.body.from_did
                    }
                })
            }
            // Check did_nonce == 0
            if (nostr_content_json.body.did_nonce != 0) {
                return ({
                    "status": "error",
                    "error": `did_nonce has to equal zero to deploy`
                })
            }
            // Check token_nonce == 0
            if (nostr_content_json.body.token_nonce != 0) {
                return ({
                    "status": "error",
                    "error": `token_nonce has to equal zero to deploy`
                })
            }
            // Check max operation_data.initial_token_admins is 64 or less
            if (nostr_content_json.body.operation_data.inital_token_admins.length >= 64) {
                return ({
                    "status": "error",
                    "error": `Max inital_token_admins is 64`
                })
            }
            // Check operation_data.decimals is 9 or less 
            if (nostr_content_json.body.operation_data.decimals > 9) {
                return ({
                    "status": "error",
                    "error": `Max Deciams is set to 9 until we move to bigint`
                })
            }
            // Verify value is less than operation_data.max_supply
            if (nostr_content_json.body.operation_data.max_supply < nostr_content_json.body.value) {
                return ({
                    "status": "error",
                    "error": `Value can't be higher than max supply`
                })
            }
            // Verify that memo.length is less than 1024 characters 
            if (nostr_content_json.body.memo.length > 1024) {
                return ({
                    "status": "error",
                    "error": `Memo has max length of 1024 characters`
                })
            }
            // Update token_state
            try {
                let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
                let tmp_token_state = {
                    "id": token_id,
                    "max_supply": nostr_content_json.body.operation_data.max_supply,
                    "current_supply": nostr_content_json.body.value,
                    "admin_dids": nostr_content_json.body.operation_data.inital_token_admins,
                    "token_transaction_count": 1,
                    "last_transaction_timestamp_ms": nostr_content_json.body.timestamp_ms,
                    previous_CID: CID_code
                }
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_state",
                    tmp_token_state
                )


                // console.log("query_check_token_state")
                // console.log(tmp_token_state)
                // console.log(Object.keys(query_check))
                // console.log(query_check)
                // let validation_query = await MyDDSchema
                //     .rxdb[ddroot[0]
                //         ._data
                //         .content
                //         .app_ipns_lookup["nostr-nip05-server.dd20.token_state"]]
                //     .find({
                //         selector: {
                //             "content.id" : token_id
                //         }
                //     }).exec();
                // console.log(Object.keys(validation_query))


            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_state" failed`
                })
            }
            // Update token_transactions
            try {
                let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
                let raw_transaction = JSON.stringify(nostr_content_json.body)
                nostr_content_json.body.id = token_id + "_0"
                nostr_content_json.body.CID = CID_code
                nostr_content_json.body.raw_transaction = raw_transaction
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    nostr_content_json.body
                )

                // console.log("query_check_token_transactions")
                // console.log(Object.keys(query_check))
                // let validation_query = await MyDDSchema
                //     .rxdb[ddroot[0]
                //         ._data
                //         .content
                //         .app_ipns_lookup["nostr-nip05-server.dd20.token_transactions"]]
                //     .find({
                //         selector: {
                //             "id" : token_id + "_0"
                //         }
                //     }).exec();
                // console.log(Object.keys(validation_query))
                // console.log("done_query_check_token_transactions")


            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_transactions" failed`
                })
            }
            // Update balance
            try {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: token_id + "_" + nostr_did,
                        token_id: token_id,
                        did: nostr_did,
                        nonce: 0,
                        balance: nostr_content_json.body.value

                    }
                )
                return ({
                    "status": "success",
                    "success": `token ${token_id} created`
                })
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_balances`
                })
            }
        }


        if (nostr_content_json.body.from_did != nostr_did) {
            return ({
                "status": "error",
                "error": `from_did has to be generated from nostr key`,
                "data": {
                    "nostr_did": nostr_did,
                    "from_did_": nostr_content_json.body.from_did
                }
            })
        }
        let check_token_data = await validate_dd_token_transaction(
            MyDDSchema,
            ddroot,
            nostr_content_json.body
        )
        if (check_token_data.status != "success") {
            // TODO that is not a good enough check
            return (check_token_data)
        }


        if (nostr_content_json.body.operation_name == "mint") {

            // validate_dd_token_transaction does this now
            // let check_token_state = await MyDDSchema.rxdb[
            //     ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            // ]
            //     .find({
            //         selector: {
            //             "id": nostr_content_json.body.token_id
            //         }
            //     }).exec();
            // if (check_token_state.length == 0) {
            //     return({
            //         "status": "error",
            //         "error": `That token does not exist`
            //     })
            //     return false
            // }
            // Validate operation_data
            // if (!Object.keys(nostr_content_json.body.operation_data).includes("to_did")) {
            //     return({
            //         "status": "error",
            //         "error": `to_did key is not in operation_data`
            //     })
            //     return false
            // }
            // if (Object.keys(nostr_content_json.body.operation_data).length != 1) {
            //     return({
            //         "status": "error",
            //         "error": `invalid number of keys, should only be 1 and it should be to_did`
            //     })
            //     return false
            // }


            // Verify nostr_did in did_admins
            if (!check_token_data.token_state[0]._data.content.admin_dids.includes(nostr_did)) {
                return ({
                    "status": "error",
                    "error": `nostr_did submitted is not in token_admin list`
                })
            }
            // Verify amount to be minted will not go over max_supply
            if (check_token_data.token_state[0]._data.max_supply < check_token_data.token_state[0]._data.content.current_supply + nostr_content_json.body.value) {
                return ({
                    "status": "error",
                    "error": `Minting that many tokens will be more than max supply`,
                    "data": {
                        max_supply: check_token_data.token_state[0]._data.content.max_supply,
                        current_supply: check_token_data.token_state[0]._data.content.current_supply
                    }
                })
            }
            // Get to_did balance
            let check_token_balance = 0;
            try {
                check_token_balance = await MyDDSchema.rxdb[
                    ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
                ]
                    .find({
                        selector: {
                            "id": nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did
                        }
                    }).exec();
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `Can't check token balance`,
                    "error_description": error
                })
            }
            // Upsert token_transactions
            nostr_content_json.body.id = nostr_content_json.body.token_id + "_" + nostr_content_json.body.token_nonce
            try {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    nostr_content_json.body
                )
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_transactions" failed`
                })
            }
            // Upsert token_state
            try {
                let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
                let tmp_token_state = JSON.parse(JSON.stringify(check_token_data.token_state[0]._data.content))
                tmp_token_state.current_supply += nostr_content_json.body.value
                tmp_token_state.token_transaction_count += 1
                tmp_token_state["previous_CID"] = CID_code
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_state",
                    tmp_token_state
                )
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_state" failed`,
                    "error_description": error
                })
            }

            // Upsert token_balances
            let token_balance_id = nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did
            if (check_token_balance.length == 0) {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: token_balance_id,
                        token_id: nostr_content_json.body.token_id,
                        did: nostr_content_json.body.to_did,
                        nonce: 0,
                        balance: nostr_content_json.body.value

                    }
                )
                return ({
                    "status": "success",
                    "success": `${nostr_content_json.body.to_did} balance set to ${nostr_content_json.body.value}`
                })
            }
            else {
                let new_balance = check_token_balance[0]._data.balance + nostr_content_json.body.value
                // Check did_nonce
                if (check_token_balance[0]._data.content.did_nonce + 1 != nostr_content_json.body.did_nonce) {
                    return ({
                        "status": "error",
                        "error": `did nonce did not match, it is currently ${check_token_balance[0]._data.content.did_nonce}`
                    })
                }
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: token_balance_id,
                        token_id: nostr_content_json.body.token_id,
                        did: nostr_did,
                        nonce: 0,
                        balance: new_balance

                    }
                )
                return ({
                    "status": "success",
                    "error": `${nostr_did} balance set to ${new_balance}`
                })
            }
        }
        if (nostr_content_json.body.operation_name == "transfer") {
            // Check if token exists
            // let check_token_state = await MyDDSchema.rxdb[
            //     ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
            // ]
            //     .find({
            //         selector: {
            //             "id": nostr_content_json.body.token_id
            //         }
            //     }).exec();
            // if (check_token_state.length == 0) {
            //     return({
            //         "status": "error",
            //         "error": `That token does not exist`
            //     })
            //     return false
            // }
            // Validate operation_data
            // if (!Object.keys(nostr_content_json.body.operation_data).includes("to_did")) {
            //     return({
            //         "status": "error",
            //         "error": `to_did key is not in operation_data`
            //     })
            //     return false
            // }
            // if (Object.keys(nostr_content_json.body.operation_data).length != 1) {
            //     return({
            //         "status": "error",
            //         "error": `invalid number of keys, should only be 1 and it should be to_did`
            //     })
            //     return false
            // }
            // check from_did
            if (nostr_content_json.body.from_did != nostr_did) {
                return ({
                    "status": "error",
                    "error": `from_did has to be generated from nostr key`,
                    "data": {
                        "nostr_did": nostr_did,
                        "from_did_": nostr_content_json.body.from_did
                    }
                })
            }
            // Get balance from_did
            let check_from_did_balance = 0;
            try {
                check_from_did_balance = await MyDDSchema.rxdb[
                    ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
                ]
                    .find({
                        selector: {
                            "id": nostr_content_json.body.token_id + "_" + nostr_content_json.body.from_did
                        }
                    }).exec();
                if(check_from_did_balance.length == 0){
                    return ({
                        "status": "error",
                        "error": `from_did balance is zero`
                    })
                }
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `Can't check token balance`,
                    "error_description": error
                })
            }
            // Verify nonce from_did
            // #TODO this was not done right
            if (check_from_did_balance[0]._data.content.balance < nostr_content_json.body.value) {
                return ({
                    "status": "error",
                    "error": `from_did doesn't have enought balance current balance is ${check_from_did_balance[0]._data.content.balance}`
                })
            }
            // Verify from_did has enough balance
            if (check_from_did_balance.length == 0) {
                return ({
                    "status": "error",
                    "error": `from_did doesn't have a balance of that token`
                })
            }
            if (check_from_did_balance[0]._data.content.balance < nostr_content_json.body.value) {
                return ({
                    "status": "error",
                    "error": `from_did doesn't have enought balance current balance is ${check_from_did_balance[0]._data.content.balance}`
                })
            }

            // Upsert to_did balance
            let to_did_balance = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
            ]
                .find({
                    selector: {
                        "id": nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did
                    }
                }).exec();
            if (to_did_balance.length == 0) {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did,
                        token_id: nostr_content_json.body.token_id,
                        did: nostr_content_json.body.to_did,
                        nonce: 0,
                        balance: nostr_content_json.body.value
                    }
                )
            } else {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    {
                        id: nostr_content_json.body.token_id + "_" + nostr_content_json.body.to_did,
                        token_id: nostr_content_json.body.token_id,
                        did: nostr_content_json.body.to_did,
                        nonce: to_did_balance[0]._data.content.nonce,
                        balance: to_did_balance[0]._data.content.value + nostr_content_json.body.value
                    }
                )
            }
            // Update from_did balance
            let check_mah_query = null
            try {
                let query_data = {
                    id: nostr_content_json.body.token_id + "_" + nostr_content_json.body.from_did,
                    token_id: nostr_content_json.body.token_id,
                    did: nostr_content_json.body.from_did,
                    nonce: check_token_data.current_balance[0]._data.content.nonce + 1,
                    balance: check_token_data.current_balance[0]._data.content.balance - nostr_content_json.body.value
                }
                console.log(query_data)
                console.log(check_token_data.current_balance[0]._data.content.balance)
                check_mah_query = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_balances",
                    query_data
                )
                console.log("from_did_dd_upsert")
                console.log(check_mah_query)
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `from_did upsert failed`,
                    data: error,
                    check_mah_query: check_mah_query
                })
            }
            // Upsert token_state
            let CID_code = await String(CID.create(1, code, await sha256.digest(encode(nostr_content_json.body))))
            check_mah_query = null
            try {
                let tmp_token_state = JSON.parse(JSON.stringify(check_token_data.token_state[0].content))
                tmp_token_state.previous_CID = CID_code
                tmp_token_state.token_transaction_count = nostr_content_json.body.token_nonce
                tmp_token_state.last_transaction_timestamp_ms = nostr_content_json.body.timestamp_ms
                // console.log("tmp_token_state_transfer")
                // console.log(nostr_content_json.body.token_nonce)
                // console.log(tmp_token_state)
                check_mah_query = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_state",
                    tmp_token_state
                )
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert for transfer "nostr-nip05-server.dd20.token_state" failed`,
                    data: error,
                    check_mah_query: check_mah_query
                })
            }
            // upsert transaction
            try {
                // Update token_transactions
                let raw_transaction = JSON.stringify(nostr_content_json.body)
                let contextualized_transaction = JSON.parse(JSON.stringify(nostr_content_json.body))
                contextualized_transaction.id = nostr_content_json.body.token_id + "_" + String(nostr_content_json.body.token_nonce)
                contextualized_transaction.CID = CID_code
                contextualized_transaction.raw_transaction = raw_transaction


                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    contextualized_transaction
                )
            } catch (error) {
                return ({
                    "status": "error",
                    "error_description": `upsert "nostr-nip05-server.dd20.token_transactions" failed`,
                    error: error

                })
            }
            return ({
                "status": "success",
                "success": `transfer should be complete`
            })
        }
        if (nostr_content_json.body.operation_name == "rekey") {
            // Check admin
            if (!check_token_data.token_state[0]._data.content.admin_dids.includes(nostr_did)) {
                return ({
                    "status": "error",
                    "error": `nostr_did submitted is not in token_admin list`
                })
            }
            // Value must be zero
            if (nostr_content_json.body.value == 0) {
                return ({
                    "status": "error",
                    "error": `Minting that many tokens will be more than max supply`,
                    "data": {
                        max_supply: check_token_data.token_state[0]._data.content.max_supply,
                        current_supply: check_token_data.token_state[0]._data.content.current_supply
                    }
                })
            }
            // Upsert admin in token_state.admin_dids
            let token_state = JSON.parse(JSON.stringify(check_token_data.token_state[0]._data.content))
            if (!token_state.admin_dids.includes(nostr_did)) {
                try {
                    token_state[token_state.admin_dids.indexOf(nostr_content_json.body.from_did)] = nostr_content_json.body.to_did;
                    let query_check = await dd_upsert(
                        MyDDSchema,
                        ddroot,
                        "nostr-nip05-server.dd20.token_state",
                        tmp_token_state
                    )
                } catch (error) {
                    return ({
                        "status": "error",
                        "error": `token_state could not be updated`
                    })
                }
            }
            // Upsert token_transactions
            nostr_content_json.body.id = nostr_content_json.body.token_id + "_" + nostr_content_json.body.token_nonce
            try {
                let query_check = await dd_upsert(
                    MyDDSchema,
                    ddroot,
                    "nostr-nip05-server.dd20.token_transactions",
                    nostr_content_json.body
                )
            } catch (error) {
                return ({
                    "status": "error",
                    "error": `upsert "nostr-nip05-server.dd20.token_transactions" failed`
                })
            }
            return ({
                "status": "success",
                "error": `rekey should have been sucessful`
            })
        }
        if (nostr_content_json.body.operation_name == "burn") {
            return ({
                "status": "error",
                "error": `burn is not yet implimented`
            })
        }
    } catch (error) {
        return ({
            "status": "error",
            "error" : error,
            "error_description": `Could not perform token logic`
        })
    }

    return ({
        "status": "error",
        "error": `token_operation you submitted does not exist`
    })
}