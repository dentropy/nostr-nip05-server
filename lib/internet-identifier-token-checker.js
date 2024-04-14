export async function internet_identifier_token_checker(MyDDSchema, ddroot, req, nostr_content_json) {
    // console.log("ENTERED_internet_identifier_token_checker")
    // console.log("nostr_content_json.body.token_id")
    // console.log(nostr_content_json.body.token_id)
    let check_token_internet_identifier = await MyDDSchema.rxdb[
        ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.domain-name-metadata.domain_name_kv"]
    ]
        .find({
            selector: {
                "content.key": nostr_content_json.body.token_id
            }
        }).exec()
    // console.log("GOT_RESULT")
    // console.log(Object.keys(check_token_internet_identifier))
    if (check_token_internet_identifier.length == 0) {
        return ({
            "status": "error",
            "error": ``,
            "error_description": `No Intenret Identifiers can be redeemed with that Coupon`
        })
    }
    let domain_names = []
    check_token_internet_identifier.forEach(element => {
        domain_names.push(element.content.domain_name)
    });
    return {
        "status" : "success",
        "data" : domain_names,
        "success" : "Yeah"
    }
}