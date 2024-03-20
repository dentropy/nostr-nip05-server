import express from 'express';

import DDSchema from './dd-schema/index.js'

import bs58 from 'bs58'
import { decode } from "nostr-tools/nip19"


import { encode } from '@ipld/dag-json'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { code } from 'multiformats/codecs/json'

// Configure Express
var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json())

let MyDDSchema = {}
let ddroot = {}
const text_encoder = new TextEncoder()
async function setup(){
    // Check if admin key is loaded from dotenv
    console.log(Deno.env)
    if(!Deno.env.has("NOSTR_ROOT_PUBLIC_KEY")){
        throw new Error('You need to set NOSTR_ROOT_PUBLIC_KEY environment variable or use .env file');
    }
    MyDDSchema = await DDSchema()

    // Load ddroot to lookip app schema/tables/indexes
    ddroot = await MyDDSchema.rxdb.ddroot.find({
        selector: {
            id : {
                $eq: "root"
            }
        }
    }).exec();


    console.log(ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"])

    let decoded_npub = decode(Deno.env.get("NOSTR_ROOT_PUBLIC_KEY"))
    console.log("decoded_npub")
    console.log(decoded_npub)
    let nostr_base58 = await bs58.encode( await text_encoder.encode(decoded_npub.data))
    console.log(nostr_base58)



    const multicodec_nostr_key = CID.create(1, 0xe7, await sha256.digest(encode(decoded_npub)))
    console.log("multicodec_nostr_key")
    console.log(multicodec_nostr_key)

    console.log("\n\n")
    console.log("HELLOW WORLD")
    // console.log(ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"])
    console.log(MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]])
    console.log(Object.keys(MyDDSchema.rxdb.collections))
    let check_RBAC = await MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]].find({
        selector: {
            content : {
                did: {
                    $eq: "did:key:" + nostr_base58
                }
            }
        }
    }).exec();
    if(check_RBAC.length == 0){
        let tmp_content = {
            user_did : "did:key:" + String(nostr_base58),
            user_multicodec : String(multicodec_nostr_key),
            role : "root"
        }
        let CID_code =  await String(CID.create(1, code, await sha256.digest(encode( tmp_content ))))
        let tmp_ID = `${multicodec_nostr_key}-root`
        await  MyDDSchema.rxdb[ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd-rbac.user_to_role"]].insert(
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
}
await setup()

app.get('/', (req, res) => {
    res.send("Hello, World! This is a GET request. <a href='/.well-known/nostr.json'>Well Known</a>");
});


app.get('/.well-known/nostr.json', async (req, res) => {
    res.send({
        "key" : "value"
    })
    return true
});


app.post("/napi", async function (req, res) {
    console.log("req.body for /napi")
    console.log(req.body)
    res.send({
        "key" : "value"
    })
    return true
})


var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("\n\nExample app listening at http://%s:%s", host, port)
})