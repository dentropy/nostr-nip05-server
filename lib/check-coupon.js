export async function check_coupon(MyDDSchema, ddroot, req, res, nostr_content_json){
    try {
        let check_coupon = await MyDDSchema.rxdb[
            ddroot[0]._data.content.app_ipns_lookup["nostr-nip05-server.coupon-to-dd20.coupon_codes"]
        ]
            .find({
                selector: {
                    "id": nostr_content_json.body.coupon_code
                }
            }).exec();
        if (check_coupon.length == 0) {
            res.send({
                "status": "error",
                "error": `coupon_code_does_not_exist`
            })
            return true
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
            res.send({
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
        } catch (error) {
            res.send({
                "status": "error",
                "error": `Can't check token balance for the token that the coupon redeems`,
                "error_description": error
            })
            return false
        }
        res.send({
            "status": "success",
            "success": `This coupon is valid`,
            "description": check_from_did_balance[0]._data.content.balance
        })
        return true
    } catch (error) {
        res.send({
            "status": "error",
            "error": `error_checking_coupon`
        })
        return true
    }
}