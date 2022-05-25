const express = require("express");
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE);

const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

//<===== Verify Auth ====>

function verifyAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).send({ message: "unauthorize" });
  }
  const token = auth.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "details not verified" });
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster1.btxmn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

async function run() {
  try {
    await client.connect();

    const productColection = client.db("products").collection("product");
    const orderColection = client.db("products").collection("checkouts");
    const reviewsColection = client.db("products").collection("reviews");
    const userColection = client.db("products").collection("users");

    //<===== AUTH ====>

    app.post("/login", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send(token);
    });
    // STRIPE

    app.post("/create-payment-intent", verifyAuth, async (req, res) => {
      const pdAmount = req.body;
      const total = pdAmount.total;
      const amount = total * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // <<===all Prodtcs===>

    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productColection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });
    // <<===all user===>
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userColection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // <<===MAKE ADMIN===>

    app.put("/user/admin/:id", verifyAuth, async (req, res) => {
      const id = req.params.id;
      const requester = req.decoded.email;
      const requesterAccount = await userColection.findOne({
        email: requester,
      });
      const role = req.body;
      if (requesterAccount.role === "admin") {
        const filter = { _id: ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            role: role.role,
          },
        };
        const result = await userColection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });
    // <<======isADMIN CHECKER=====>>
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userColection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // <<===all Reviews===>

    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewsColection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    // <<===ALL USER===>

    app.get("/users", verifyAuth, async (req, res) => {
      const query = {};
      const user = await userColection.find(query).toArray();
      res.send(user);
    });
    //<===== MY ORDERS ====>

    app.get("/my-order", verifyAuth, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.query.email;
      if (email == decodedEmail) {
        const query = { email: email };
        const cursor = orderColection.find(query);
        const myItems = await cursor.toArray();
        // console.log(email);
        res.send(myItems);
      } else {
        res
          .status(403)
          .send({ message: "Boo! Your details are fake Login again" });
      }
    });

    app.get("/payment/:id", verifyAuth, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const payment = await orderColection.findOne(query);
      res.send(payment);
    });

    app.post("/add-products", async (req, res) => {
      const myTodo = req.body;
      const result = await productColection.insertOne(myTodo);
      res.send(result);
    });
    app.post("/Checkout", async (req, res) => {
      const Checkoutpd = req.body;
      const result = await orderColection.insertOne(Checkoutpd);
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const reviews = req.body;
      const result = await reviewsColection.insertOne(reviews);
      res.send(result);
    });

    app.delete("/todo/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productColection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

run().catch(console.dir);
