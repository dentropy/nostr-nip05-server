export async function check_coupon(MyDDSchema, ddroot, req, nostr_content_json){
    try {
        try {
            console.log("nostr_content_json")
            console.log("THE")
            console.log(nostr_content_json)
            let check_coupon = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.coupon-to-dd20.coupon_codes"]
            ]
                .find({
                    selector: {
                        "id": nostr_content_json.body.coupon_code
                    }
                }).exec();
            if (check_coupon.length == 0) {
                return({
                    "status": "error",
                    "error": `coupon_code_does_not_exist`
                })
                return true
            }
            else {
                return({
                    "status": "success",
                    "success": `coupon_code_exists`
                })
            }
        } catch (error) {
            return({
                error : "GOT_THE_ERROR_HERE"
            })
            
        }
        let get_private_key = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.coupon-to-dd20.coupon_codes"]
        ]
            .find({
                selector: {
                    id: check_coupon[0]._data.content.did_owner
                }
            })
        if (check_coupon.length == 0) {
            return({
                "status": "error",
                "error": `privet_key_required_for_coupon_not_on_server`
            })
            return true
        }
        // Check token balance
        let check_from_did_balance = 0;
        try {
            check_from_did_balance = await MyDDSchema.rxdb[
                ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.dd20.token_balances"]
            ]
                .find({
                    selector: {
                        "id": check_coupon[0]._data.content.token_id + "_" + check_coupon[0]._data.content.did_owner
                    }
                }).exec();
            check_from_did_balance = check_from_did_balance[0]._data.balance
        } catch (error) {
            return({
                "status": "error",
                "error": `Can't check token balance for the token that the coupon redeems`,
                "error_description": error
            })
            return false
        }
        if(check_from_did_balance == 0){
            return({
                "status": "error",
                "error": `This coupon used to be valid but is no longer`,
                "description": check_from_did_balance[0]._data.content.balance
            })
        }
        return({
            "status": "success",
            "success": `This coupon is valid`,
            "description": check_from_did_balance[0]._data.content.balance
        })
        return true
    } catch (error) {
        return({
            "status": "error",
            "error": `error_checking_coupon`,
            "error_description" : error
        })
        return true
    }
}