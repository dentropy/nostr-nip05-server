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

  describe('Deploy a token', async function () {


    let nostr_did = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key)))
    let nostr_did2 = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key2)))
    let token_data = {
      "app_name": "DD_token_RBAC",
      "version": "0.0.1",
      "token_id": "bafkreiam2kiyfc35ygkzdipsx4hqg63ffklcl6lvutlzmpjcfmz5zl32yi",
      "from_did": nostr_did,
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
    it('deploy the token', async function () {
      let signedEvent = finalizeEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['DD']
        ],
        content:
          JSON.stringify({
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


    it('find_query nostr-nip05-server.dd20.token_transactions', async function () {
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


    it('find_query nostr-nip05-server.dd20.token_transactions', async function () {
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


    it('find_query nostr-nip05-server.dd20.token_balances', async function () {
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
              "query_name": "nostr-nip05-server.dd20.token_balances",
              "query_data": {
                "selector": {
                  "id": token_id + "_" + nostr_did
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

    describe('Mint a token', async function () {

      it('Literally mint the token', async function () {
        let signedEvent = finalizeEvent({
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['DD']
          ],
          content:
            JSON.stringify({
              "function_name": "dd_token",
              "body": {
                "app_name": "DD_token_RBAC",
                "version": "0.0.1",
                "token_id": token_id,
                "from_did": nostr_did,
                "operation_name": "mint",
                "timestamp_ms": Date.now(),
                "value": 420,
                "did_nonce": 1,
                "token_nonce": 1,
                "memo": "",
                "operation_data": {
                  "to_did": nostr_did2
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


      it('find_query for mint nostr-nip05-server.dd20.token_state', async function () {
        // const delay = ms => new Promise(res => setTimeout(res, ms));
        // await delay(1000)
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


      it('find_query for mint nostr-nip05-server.dd20.token_transactions', async function () {
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

          // console.log("nostr-nip05-server.dd20.token_transactions")
          // console.log(fetch_response)
          // console.log(JSON.stringify(fetch_response, null, 2))

          assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
          assert.equal(fetch_response.data.length > 0, true, `No actual results returned${JSON.stringify(fetch_response)}`)
        } catch (error) {
          assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
        }
        assert.equal([1, 2, 3].indexOf(4), -1);
      });


      it('find_query for mint nostr-nip05-server.dd20.token_balances', async function () {
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
  });
});