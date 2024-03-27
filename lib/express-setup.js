import DDSchema from '../dd-schema/index.js'
import { dd_upsert } from '../dd-schema/index.js'

import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'

import bs58 from 'bs58'
import { generateSecretKey, verifyEvent, getPublicKey } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import { decode } from "nostr-tools/nip19"

export async function express_setup() {
    const text_encoder = new TextEncoder()
    // Check if admin key is loaded from dotenv
    console.log("Deno.env")
    console.log(Deno.env)
    console.log(Deno.env.get("NOSTR_ROOT_PUBLIC_KEY"))
    if (!Deno.env.has("NOSTR_ROOT_PUBLIC_KEY")) {
        throw new Error('You need to set NOSTR_ROOT_PUBLIC_KEY environment variable or use .env file');
    }
    let MyDDSchema = await DDSchema()

    // Load ddroot to lookip app schema/tables/indexes
    let ddroot = await MyDDSchema.rxdb.ddroot.find({
        selector: {
            id: {
                $eq: "root"
            }
        }
    }).exec();


    // console.log(ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"])

    let decoded_npub = decode(Deno.env.get("NOSTR_ROOT_PUBLIC_KEY"))
    let nostr_base58 = await bs58.encode(await text_encoder.encode(decoded_npub.data))
    let nostr_did = "did:key:" + nostr_base58



    const multicodec_nostr_key = CID.create(1, 0xe7, await sha256.digest(encode(decoded_npub)))

    // console.log("decoded_npub")
    // console.log(decoded_npub)
    // console.log(nostr_base58)
    // console.log("multicodec_nostr_key")
    // console.log(multicodec_nostr_key)
    // console.log(ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"])
    // console.log(MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]])
    // console.log(Object.keys(MyDDSchema.rxdb.collections))
    let check_RBAC = await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]].find({
        selector: {
            content: {
                did: {
                    $eq: nostr_did
                }
            }
        }
    }).exec();
    if (check_RBAC.length == 0) {
        let tmp_content = {
            user_did: "did:key:" + String(nostr_base58),
            user_multicodec: String(multicodec_nostr_key),
            role: "root"
        }
        let CID_code = await String(CID.create(1, code, await sha256.digest(encode(tmp_content))))
        let tmp_ID = `${multicodec_nostr_key}-root`
        await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]].insert(
            {
                id: tmp_ID,
                CID: CID_code,
                previousCID: "bafkreieghxguqf42lefdhwc2otdmbn5snq23skwewpjlrwl4mbgw6x7wey",
                content: tmp_content
            }
        )
    }


    // console.log("MY SCHEMA")
    // console.log(MyDDSchema)
    // console.log(Object.keys(MyDDSchema))

    let secret_key = generateSecretKey()
    let public_key = getPublicKey(secret_key)
    let npub = nip19.npubEncode(public_key)
    let private_nostr_did = "did:key:" + await bs58.encode(await text_encoder.encode(String(public_key)))
    // Find if data already in database
    let query_check = dd_upsert(
        MyDDSchema,
        ddroot,
        "nostr-nip05-server.dd-private-key-infastructure.private_keys",
        {
            id: private_nostr_did,
            key_type: "secp256k1",
            did: private_nostr_did,
            multicodec: "TODO",
            key_fingerprint: "",
            raw_public_key: public_key,
            raw_private_key: nip19.nsecEncode(secret_key)
        }
    )

    return({
        MyDDSchema : MyDDSchema,
        ddroot : ddroot,
        admin_did : nostr_did,
        private_nostr_did : private_nostr_did
    })

}