const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = 3000

app.use(cors())
app.use(express.json())


const uri = "mongodb+srv://export-import-user:z7tQ9PInInM4eeML@sohansdb.zvnqwhl.mongodb.net/?appName=SohansDB";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db('export-import-hub')
    const productsCollection = db.collection('products')

    app.get('/products', async (req,res) => {
      const result = await productsCollection.find().toArray()
      res.send(result)
    })

    app.get('/latest-products', async (req, res) => {
      const cursor = productsCollection.find().sort({created_at: -1}).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/productDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await productsCollection.findOne(query);
      res.send(result);
    }) 

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
