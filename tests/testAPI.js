import assert from "assert"
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSeedWords, validateWords, privateKeyFromSeedWords } from 'nostr-tools/nip06'
import * as nip19 from 'nostr-tools/nip19'

describe('Array', async function () {

  const mnemonic = "curve foster stay broccoli equal icon bamboo champion casino impact will damp"
  let mnemonic_validation = validateWords(mnemonic)
  let secret_key = privateKeyFromSeedWords(mnemonic, "", 0)
  let public_key = getPublicKey(secret_key)
  let npub = nip19.npubEncode(public_key)

  let secret_key2 = privateKeyFromSeedWords(mnemonic, "", 1)
  let public_key2 = getPublicKey(secret_key2)
  let npub2 = nip19.npubEncode(public_key2)

  describe('Test API', async function () {
    it('upsert_data example', async function () {
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
            "function_name": "upsert_data",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.nip05.internet_identifiers",
              "query_data": {
                "id": "test@example.com",
                "user_name": "test",
                "public_key": public_key2,
                "domain_name": "example.com",
                "relay_list": ["ws://ddaemon.org"]
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(fetch_response)
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('find_query example', async function () {
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
            "function_name": "find_query",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.nip05.internet_identifiers",
              "query_data": {
                "selector": {
                  "id": "test@example.com"
                }
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        
        
        // console.log(JSON.stringify(fetch_response, null, 2))
        
        
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('upsert_data domain-name-metadata example.com', async function () {

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
            "function_name": "upsert_data",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.domain-name-metadata.domain_name_kv",
              "query_data": {
                "id": "example.com-generate_nostr_dot_json",
                "domain_name": "example.com",
                "key": "generate_nostr_dot_json",
                "value": "true"
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(fetch_response)
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });



    it('find_query domain-name-metadata example.com', async function () {

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
            "function_name": "find_query",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.domain-name-metadata.domain_name_kv",
              "query_data": {
                "selector": {
                  "id": "nostr-nip05-server.domain-name-metadata.domain_name_kv"
                }
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log("HELLO fetch_response")
        // console.log(JSON.stringify(fetch_response, null, 2))
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('function_name generate_nostr_dot_json', async function () {

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
            "function_name": "generate_nostr_dot_json",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "domain_name": "example.com"
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(fetch_response)
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });



    it('find_query nostr-nip05-server.domain-name-metadata.domain_name_k example.com', async function () {

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
            "function_name": "find_query",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.domain-name-metadata.domain_name_kv",
              "query_data": {
                "selector": {
                  "content.domain_name": "example.com"
                }
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log("fetch nostr-nip05-server.domain-name-metadata.domain_name_kv")
        // console.log(JSON.stringify(fetch_response, null, 2))
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });



    it('find_query raw_nostr_dot_json', async function () {

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
            "function_name": "find_query",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.nip05.raw_nostr_dot_json",
              "query_data": {
                "selector": {
                  "id": "example.com"
                }
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(JSON.stringify(fetch_response, null, 2))
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('Resolve /.well-known/nostr.json', async function () {

      let app_config = await fetch("http://localhost:8081/apps")
      app_config = await app_config.json()


      let fetch_response = await fetch("http://localhost:8081/.well-known/nostr.json")
      fetch_response = await fetch_response.json()
      // console.log(JSON.stringify(fetch_response, null, 2))
      assert.equal(Object.keys(fetch_response).includes("names"), true, `key names missing from nostr.json`)
      assert.equal(Object.keys(fetch_response.names).length >= 1, true, `no names in nostr.json`)
      assert.equal(Object.keys(fetch_response).includes("relays"), true, `key relays missing from nostr.json`)
      assert.equal(Object.keys(fetch_response.relays).length >= 1, true, `no relays in nostr.json`)
    });


    it('upsert_nip05 as nip05 owner NOT ROOT', async function () {

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
            "function_name": "upsert_nip05",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "internet_identifier": "test@example.com",
              "public_key": public_key2,
              "relay_list": ["ws://ddaemon.org", "wss://nostr.net"]
            }
          }),
      }, secret_key2)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(fetch_response)
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('find_query check nip05 actually updated', async function () {

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
            "function_name": "find_query",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "nostr-nip05-server.nip05.internet_identifiers",
              "query_data": {
                "selector": {
                  "id": "test@example.com"
                }
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(JSON.stringify(fetch_response, null, 2))
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('Set default domain_name', async function () {
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
            "function_name": "upsert_data",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "default_well_known_domain_name",
              "query_data": {
                "id": "default",
                "domain_name" : "example.com"
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        // console.log(fetch_response)
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });


    it('Find default domain name', async function () {
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
            "function_name": "find_query",
            "app_name": app_config.app_name,
            "app_key": app_config.app_key,
            "body": {
              "query_name": "default_well_known_domain_name",
              "query_data": {
                "selector": {
                  "id": "default"
                }
              }
            }
          }),
      }, secret_key)
      assert.equal(await verifyEvent(signedEvent), true, "verify Nostr event failed")
      try {
        let fetch_response = await fetch("http://localhost:8081/napi", {
          "method": "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(signedEvent)
        })
        fetch_response = await fetch_response.json()
        
        
        console.log(JSON.stringify(fetch_response, null, 2))
        
        
        assert.equal(Object.keys(fetch_response).includes("success"), true, `/napi request turned back with error\n${JSON.stringify(fetch_response)}`)
      } catch (error) {
        assert.equal(true, false, `fetch failed, you need to be running the server to run these tests\n${error}`)
      }
      assert.equal([1, 2, 3].indexOf(4), -1);
    });
    // #TODO Test not root
    // #TODO Finish the upsert when there is something already in the database
    // #TODO Test invalid nostr JSON

  });
});