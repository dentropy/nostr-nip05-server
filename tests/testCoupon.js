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

    const mnemonic = "curve foster stay broccoli equal icon bamboo champion casino impact will damp"
    let mnemonic_validation = validateWords(mnemonic)
    let secret_key = privateKeyFromSeedWords(mnemonic, "", 0)
    let public_key = getPublicKey(secret_key)
    let npub = nip19.npubEncode(public_key)

    let secret_key2 = privateKeyFromSeedWords(mnemonic, "", 1)
    let public_key2 = getPublicKey(secret_key2)
    let npub2 = nip19.npubEncode(public_key2)
    const text_encoder = new TextEncoder()

    let mint_transaction = null;
    let mint_transaction_CID = null;

    describe('Create a Coupon', async function () {
        // Test if private key is in database

        // We need to mint the private key in the database some tokens

        // We need to create the coupon

        // We need to redeem the coupon

        // We need to check the balance of the coupon
        describe('Literally create the coupon', async function () {
            it('upsert_data example', async function () {
                let signedEvent = finalizeEvent({
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ['DD']
                    ],
                    content:
                        JSON.stringify({
                            "function_name": "upsert_data",
                            "body": {
                                "query_name": "nostr-nip05-server.coupon-to-dd20.coupon_codes",
                                "query_data": {
                                    "id": "testcoupon",
                                    "coupon_description": "Claim a *@ddaemon.org Internet Identifier",
                                    "did_owner": public_key2,
                                    "uses_left": 10
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
                let signedEvent = finalizeEvent({
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ['DD']
                    ],
                    content:
                        JSON.stringify({
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
                    
                    
                    console.log(JSON.stringify(fetch_response, null, 2))
                    
                    
                    assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
                } catch (error) {
                    assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
                }
                assert.equal([1, 2, 3].indexOf(4), -1);
            });
        })
    })
})