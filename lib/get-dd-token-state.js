export async function get_dd_token_state(MyDDSchema, ddroot, req, nostr_content_json) {
    if (nostr_content_json == undefined ) {
        nostr_content_json = {body : {}}
    }
    if (nostr_content_json.body == undefined){
        nostr_content_json = {body : {}}
    }

    let check_token_state = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
    ]
        .find({
            selector : {
                "id" : nostr_content_json.body.token_id
            }
        }).exec();
    if (check_token_state.length == 0) {
        return ({
            "status": "error",
            "error": `No Tokens have been created on this server`
        })
    }
    else {
        return(check_token_state)
    }
}