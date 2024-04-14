export async function list_dd_tokens(MyDDSchema, ddroot, req, nostr_content_json) {
    // Check if token already exists
    let check_token_state = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_state"]
    ]
        .find({}).exec();
    if (check_token_state.length != 0) {
        return ({
            "status": "error",
            "error": `No Tokens have been created on this server`
        })
    }
    else {
        return(check_token_state)
    }
}