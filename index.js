const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = 3000

app.use(cors())
app.use(express.json())

//Firebase
const admin = require("firebase-admin");

const serviceAccount = require("./import-export-hub-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//Dotenv
require('dotenv').config()

//MongoDB
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@sohansdb.zvnqwhl.mongodb.net/?appName=SohansDB`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



const verifyTokenMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "Unauthorized Access, Token not Found."
    })
  }

  const token = authorization.split(' ')[1]
  // console.log(token);

  try {
    const decode = await admin.auth().verifyIdToken(token);
    console.log(decode);
    req.decodedUser = decode;
    next();
  }
  catch (error) {
    res.status(401).send({
      message: "Unauthorized Access."
    })
  }
}


async function run() {
  try {
    await client.connect();

    const db = client.db('export-import-hub')
    const productsCollection = db.collection('products')
    const importsCollection = db.collection('imports')
    const usersCollection = db.collection('users')

    app.get('/products', async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    })

    app.get('/latest-products', async (req, res) => {
      const cursor = productsCollection.find().sort({ created_at: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get(`/productDetails/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    })

    app.get('/search', async (req, res) => {
      const searchedText = req.query.search;
      const result = await productsCollection.find({ productName: { $regex: searchedText, $options: "i" } }).toArray();
      res.send(result);
    })

    app.get(`/product/:id`, async (req, res) => {
      const { id } = req.params;
      const result = await productsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    })

    app.get('/myImports', verifyTokenMiddleware, async (req, res) => {
      const email = req.query.email;
      const result = await importsCollection.find({ imported_by: email }).toArray();
      res.send(result);
    })

    app.get('/myExports', verifyTokenMiddleware, async(req, res) => {
      const email = req.query.email;
      const result = await productsCollection.find({created_by: email}).toArray();
      res.send(result);
    })

    app.post(`/product/import/:id`, async (req, res) => {
      const id = req.params.id;
      const importData = req.body;
      const quantity = Number(importData.quantity);
      const result = await importsCollection.insertOne(importData);

      const filter = { _id: new ObjectId(id) }
      const update = {
        $inc: {
          availableQuantity: - quantity
        }
      }
      const newImpQuantity = await productsCollection.updateOne(filter, update);
      res.send({ result, newImpQuantity });
    })

    app.post('/products', verifyTokenMiddleware, async (req, res) => {
      const body = req.body;

      const createdByEmail = req.decodedUser.email;
      const productToInsert = {...body, created_by: createdByEmail};

      if (
        isNaN(body.availableQuantity) ||
        isNaN(body.price) ||
        isNaN(body.rating)
      ) {
        return res.status(400).send({
          message: "Quantity, price, and rating must be numbers"
        });
      }

      try {
        const result = await productsCollection.insertOne(productToInsert);
        res.send({
          success: true,
          message: "Product added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Database insertion failed:", error);
        res.status(500).send({
          success: false,
          message: "Failed to insert product due to a database error."
        });
      }
    })

    app.delete('/product/:id', verifyTokenMiddleware, async (req, res) => {
      const id = req.params.id;
      const result = await importsCollection.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    app.delete('/exportProduct/:id', verifyTokenMiddleware, async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })


    app.post('/users', async (req, res) => {
      const newUser = req.body;

      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        res.send({ message: 'User Already Exist.' });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    })

    app.put('/exportProduct/:id', verifyTokenMiddleware, async (req, res) => {
      const {id} = req.params
      const data = req.body
      // console.log({id, data});
      const update = {
        $set: data
      }
      const result = await productsCollection.updateOne({_id: new ObjectId(id)}, update)
      res.send({
        success: true,
        result 
      })
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
