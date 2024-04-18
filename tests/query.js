import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSeedWords, validateWords, privateKeyFromSeedWords } from 'nostr-tools/nip06'
import * as nip19 from 'nostr-tools/nip19'
import bs58 from 'bs58'


const text_encoder = new TextEncoder()
const mnemonic = "curve foster stay broccoli equal icon bamboo champion casino impact will damp"
let mnemonic_validation = validateWords(mnemonic)
let secret_key = privateKeyFromSeedWords(mnemonic, "", 0)
let public_key = getPublicKey(secret_key)

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
                    selector: {
                        // "CID" : "bagaaiera2r5cblvnbagglwo7vhngv5vo5w6ur5ry4kznbxotmwgy3unnsdyq",
                        // "content.did": "did:key:2wivbaXeF22Xq4bCKiSrj22cechmyZMaTYY1Zc7km6JvScoTsR3hjMHzZdq9kHMc9xBzzXcVdNPGBCfmiu7Fq7pS"
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