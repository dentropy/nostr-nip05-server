export async function query_dd_token_balances(MyDDSchema, ddroot, req, nostr_content_json) {

    if (nostr_content_json == undefined ) {
        nostr_content_json = {body : {}}
    }
    if (nostr_content_json.body == undefined){
        nostr_content_json = {body : {}}
    }

    console.log("nostr_content_json.body BALANCES")
    console.log(nostr_content_json.body)
    console.log("\n\n")

    
    let check_token_state = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
    ]
        // .find(nostr_content_json.body.query_data).exec();
        .find(nostr_content_json.body).exec();
        // .find().exec();
    if (check_token_state.length == 0) {
        return ({
            "status": "error",
            "error": `Could not find any token balances`
        })
    }
    else {
        return(check_token_state)
    }
}