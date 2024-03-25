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


const mnemonic = "curve foster stay broccoli equal icon bamboo champion casino impact will damp"
let secret_key = privateKeyFromSeedWords(mnemonic, "", 0)
let public_key = getPublicKey(secret_key)
let npub = nip19.npubEncode(public_key)

let secret_key2 = privateKeyFromSeedWords(mnemonic, "", 1)
let public_key2 = getPublicKey(secret_key2)
let npub2 = nip19.npubEncode(public_key2)
const text_encoder = new TextEncoder()

let token_id = "bagaaieraw4esgqs7yjlckc7ex7e62dbp6rtr5x3jub65rickuuenhposiqsa"

let nostr_did = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key)))
let nostr_did2 = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key2)))

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
                // "query_name": "nostr-nip05-server.dd20.token_balances",
                // "query_data": {
                //     "selector": {
                //         "id": token_id + "_" + nostr_did2
                //     }
                // }

                // "query_name": "nostr-nip05-server.dd20.token_state",
                // "query_data": {
                //   "selector": {
                //     "id": token_id
                //   }
                // }


                "query_name": "nostr-nip05-server.dd20.token_transactions",
                "query_data": {
                  "selector": {
                    "id": token_id + "_1"
                  }
                }
            }
        }),
}, secret_key)



let fetch_response = await fetch("http://localhost:8081/napi", {
    "method": "POST",
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(signedEvent)
})
fetch_response = await fetch_response.json()

console.log(JSON.stringify(fetch_response, null, 2))