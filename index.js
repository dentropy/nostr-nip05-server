import express from 'express';
import DDSchema from './dd-schema/index.js'


// Configure Express
var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json())

let MyDDSchema = {}
async function setup(){
    MyDDSchema = await DDSchema()
    console.log("MY SCHEMA")
    console.log(MyDDSchema)
    console.log(Object.keys(MyDDSchema))
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