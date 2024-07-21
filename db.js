
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://test:test@cluster0.qwn59no.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

var database = "";

async function run() {
  try {
    await client.connect();

    await client.db("TPGlobal").command({ ping: 1 });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    return client;
  } finally {
    await client.close();
  }
}


module.exports = {run, database}
