import assert from "assert"
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSeedWords, validateWords, privateKeyFromSeedWords } from 'nostr-tools/nip06'
import * as nip19 from 'nostr-tools/nip19'
import bs58 from 'bs58'

import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'


describe('Array', async function () {

    const text_encoder = new TextEncoder()
    const mnemonic = "curve foster stay broccoli equal icon bamboo champion casino impact will damp"
    let mnemonic_validation = validateWords(mnemonic)
    let secret_key = privateKeyFromSeedWords(mnemonic, "", 0)
    let public_key = getPublicKey(secret_key)
    let npub = nip19.npubEncode(public_key)
    let nostr_did = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key)))
    let secret_key2 = privateKeyFromSeedWords(mnemonic, "", 1)
    let public_key2 = getPublicKey(secret_key2)
    let npub2 = nip19.npubEncode(public_key2)
    let nostr_did2 = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key2)))

    let hot_did = null;
    let hot_did_raw_public_key = null;
    let fetched_token_CID = null;
    let hot_did_nsec = null;
    let did_owner = null;
    let mint_transaction = null;
    let mint_transaction_CID = null;


    let previousCID = null
    let token_data = {
        "app_name": "DD_token_RBAC",
        "version": "0.0.1",
        "token_id": "bafkreiam2kiyfc35ygkzdipsx4hqg63ffklcl6lvutlzmpjcfmz5zl32yi",
        "from_did": nostr_did,
        "to_did": nostr_did,
        "operation_name": "deploy",
        "timestamp_ms": Date.now(),
        "value": 1024,
        "did_nonce": 0,
        "token_nonce": 0,
        "memo": "",
        "operation_data": {
            "token_name": "$TOKEN_NAME",
            "token_ticker": "$TOKEN_TICKER",
            "max_supply": 1024 * 1024 * 1024 * 1024,
            "limit_per_mint": 1024 * 1024,
            "decimals": 8,
            "inital_token_admins": [
                nostr_did
            ]
        }
    }
    let token_id = String(CID.create(1, code, await sha256.digest(encode(token_data))))
    console.log("token_id")
    console.log(token_id)

    describe("Setup metadata", async function () {
        it('upsert_data domain-name-metadata ddaemon.org', async function () {

            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()


            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "function_name": "upsert_data",
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "body": {
                            "query_name": "nostr-nip05-server.domain-name-metadata.domain_name_kv",
                            "query_data": {
                                "id": "ddaemon.org.com-generate_nostr_dot_json",
                                "domain_name": "ddaemon.org",
                                "key": "generate_nostr_dot_json",
                                "value": "true"
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()
                // console.log(fetch_response)
                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });

    })
    describe('deploy token and mint for hot wallet', async function () {
        it('Literally deploy the token', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "dd_token",
                        "body": token_data
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log(fetch_response)
                // console.log(JSON.stringify(JSON.parse(fetch_response.json_schema, null, 2)))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });




        it('find_query get hot_did', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd-private-key-infastructure.private_keys",
                            "query_data": {
                                "selector": {}
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("hot_did")
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                hot_did = fetch_response.data[0].id
                hot_did_raw_public_key = fetch_response.data[0].content.raw_public_key
                hot_did_nsec = fetch_response.data[0].content.raw_private_key
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });


        it('Literally mint the token', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            // console.log("fetched_token_CID")
            // console.log(fetched_token_CID)
            did_owner = "did:key:" + await bs58.encode(await text_encoder.encode(String(hot_did_raw_public_key)))
            mint_transaction_CID = String(CID.create(1, code, await sha256.digest(encode(mint_transaction))))
            mint_transaction = {
                "app_name": "DD_token_RBAC",
                "version": "0.0.1",
                "token_id": token_id,
                "from_did": nostr_did,
                "to_did": hot_did,
                "operation_name": "mint",
                "timestamp_ms": Date.now(),
                "value": 420,
                "did_nonce": 1,
                "token_nonce": 1,
                "memo": "",
                "last_transaction_CID": token_id, // Only the first transaction can actualy do this
                "operation_data": {}
            }
            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "dd_token",
                        "body": mint_transaction
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log(fetch_response)


                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });

        it('find_query transaction 0 nostr-nip05-server.dd20.token_transactions', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_transactions",
                            "query_data": {
                                "selector": {
                                    "id": token_id + "_0"
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });


        it('find_query transaction 1 nostr-nip05-server.dd20.token_transactions', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_transactions",
                            "query_data": {
                                "selector": {
                                    "id": token_id + "_1"
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });

        it('find_query nostr-nip05-server.dd20.token_balances', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_balances",
                            "query_data": {
                                "selector": {
                                    "id": token_id + "_" + hot_did
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });


    })

    describe('Literally create the coupon', async function () {
        it('upsert_data coupon into the database', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "upsert_data",
                        "body": {
                            "query_name": "nostr-nip05-server.coupon-to-dd20.coupon_codes",
                            "query_data": {
                                "id": "testcoupon",
                                "coupon_description": "Claim a *@ddaemon.org Internet Identifier",
                                "did_owner": did_owner,
                                "token_id": token_id
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()
                // console.log(fetch_response)
                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });
        it('find_query coupon=testcoupon', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.coupon-to-dd20.coupon_codes",
                            "query_data": {
                                "selector": {
                                    "id": "testcoupon"
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()


                // console.log(JSON.stringify(fetch_response, null, 2))


                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });
    })


    describe('Now CLAIM the coupon', async function () {
        it('claim coupon=test_coupon, should produce an error', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "claim_coupon",
                        "body": {
                            "coupon_code": "test_coupon"
                        }
                    }),
            }, secret_key2)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()


                // console.log(JSON.stringify(fetch_response, null, 2))


                assert.equal(Object.keys(fetch_response).includes("error"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
        })


        it('claim coupon=testcoupon', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "claim_coupon",
                        "body": {
                            "coupon_code": "testcoupon"
                        }
                    }),
            }, secret_key2)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()


                // console.log(JSON.stringify(fetch_response, null, 2))


                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
        })

        it('find_query nostr-nip05-server.dd20.token_balances', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_balances",
                            "query_data": {
                                "selector": {
                                    "id": token_id + "_" + nostr_did2
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });
    })

    describe('Claim internet identifier', async function () {


        it('find_query nostr-nip05-server.dd20.token_state', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_state",
                            "query_data": {
                                "selector": {
                                    "id": token_id
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()
                //   console.log("nostr-nip05-server.dd20.token_state")
                //   console.log(fetch_response)
                //   console.log(JSON.stringify(fetch_response, null, 2))

                previousCID = fetch_response.data[0].content.previous_CID

                assert.equal(fetch_response.data[0].content.previous_CID != undefined, true)
                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });



        it('Transfer token to server owner with memo', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            console.log(previousCID)
            assert.equal(previousCID != undefined, true, "Failed to fetch previousCID")
            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "dd_token",
                        "body": {
                            "app_name": "DD_token_RBAC",
                            "version": "0.0.1",
                            "last_transaction_CID": previousCID,
                            "token_id": token_id,
                            "from_did": nostr_did2,
                            "to_did": app_config.admin_did,
                            "operation_name": "transfer",
                            "timestamp_ms": Date.now(),
                            "value": 1,
                            "did_nonce": 1,
                            "token_nonce": 2,
                            "memo": JSON.stringify({ internet_identifier: "testthetoken@ddaemon.org" }),
                            "operation_data": {}
                        }

                    }),
            }, secret_key2)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("TRANSFER_TOKEN_WITH_NIP05_INTERNET_IDENTIFIER")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response))


                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
        })

        it('find_query nostr-nip05-server.dd20.token_balances', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_balances",
                            "query_data": {
                                "selector": {
                                    "id": token_id + "_" + nostr_did2
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });

        it('find_query transaction 1 nostr-nip05-server.dd20.token_transactions', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()

            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "find_query",
                        "body": {
                            "query_name": "nostr-nip05-server.dd20.token_transactions",
                            "query_data": {
                                "selector": {
                                    "id": token_id + "_2"
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(fetch_response.data[0].CID != 0, true)
                previousCID = fetch_response.data[0].id // #TODO fetch_response.data[0].CID
                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });


        it('Convert coupon to Internet Identifier', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()


            console.log("previousCID_internet_identifier")
            console.log(previousCID)
            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "function_name": "claim_internet_identifier",
                        "body": {
                            "transaction_CID": previousCID
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()

                // console.log("nostr-nip05-server.dd20.token_state")
                // console.log(fetch_response)
                // console.log(JSON.stringify(fetch_response, null, 2))

                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                // assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });


        it('find_query example', async function () {
            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()
            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "function_name": "find_query",
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "body": {
                            "query_name": "nostr-nip05-server.nip05.internet_identifiers",
                            "query_data": {
                                "selector": {
                                    "id": "testthetoken@ddaemon.org"
                                }
                            }
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()


                // console.log(JSON.stringify(fetch_response, null, 2))


                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });


        it('Resolve /dd/ddaemon.org/.well-known/nostr.json for error we need to build nostr.json', async function () {
            let fetch_response = await fetch("http://localhost:8081/dd/ddaemon.org/.well-known/nostr.json")
            fetch_response = await fetch_response.json()

            // console.log(fetch_response)

            assert.equal(Object.keys(fetch_response).includes("names"), true, `key names missing from nostr.json`)
            assert.equal(Object.keys(fetch_response.names).length >= 1, true, `no names in nostr.json`)
            assert.equal(Object.keys(fetch_response.names).includes("testthetoken"), true, `username testthetoken did not take`)
            assert.equal(Object.keys(fetch_response).includes("relays"), true, `key relays missing from nostr.json`)
            assert.equal(Object.keys(fetch_response.relays).length >= 1, true, `no relays in nostr.json`)
        })

        it('function_name generate_nostr_dot_json', async function () {

            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()


            let signedEvent = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['DD']
                ],
                content:
                    JSON.stringify({
                        "function_name": "generate_nostr_dot_json",
                        "app_name": app_config.app_name,
                        "app_key": app_config.app_key,
                        "body": {
                            "domain_name": "ddaemon.org"
                        }
                    }),
            }, secret_key)
            assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
            try {
                let fetch_response = await fetch("http://localhost:8081/napi", {
                    "method": "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(signedEvent)
                })
                fetch_response = await fetch_response.json()
                // console.log(fetch_response)
                assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
            } catch (error) {
                assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
            }
            assert.equal([1, 2, 3].indexOf(4), -1);
        });

        it('Resolve /.well-known/nostr.json checking for', async function () {

            let app_config = await fetch("http://localhost:8081/apps")
            app_config = await app_config.json()


            let fetch_response = await fetch("http://localhost:8081/dd/ddaemon.org/.well-known/nostr.json")
            fetch_response = await fetch_response.json()

            // console.log(fetch_response)

            assert.equal(Object.keys(fetch_response).includes("names"), true, `key names missing from nostr.json`)
            assert.equal(Object.keys(fetch_response.names).length >= 1, true, `no names in nostr.json`)
            assert.equal(Object.keys(fetch_response.names).includes("testthetoken"), true, `username testthetoken did not take`)
            assert.equal(Object.keys(fetch_response).includes("relays"), true, `key relays missing from nostr.json`)
            assert.equal(Object.keys(fetch_response.relays).length >= 1, true, `no relays in nostr.json`)
        })


    })
})
