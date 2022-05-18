const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

//meddle ware
app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l7piq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJwt(req, res, next) {
  const authHader = req.headers.authorization
  if (!authHader) {
    return res.status(401).send({ message: 'Unauthorization' })
  }
  const token = authHader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    console.log("data base connected")
    const serviceCollection = client.db('doctors_protal').collection('services');
    const bookingCollection = client.db('doctors_protal').collection('booking');
    const userCollection = client.db('doctors_protal').collection('user');
    const dectorCollection = client.db('doctors_protal').collection('dector');
    
    // verifyAdmin function
    const verifyAdmin = async(req, res, next)=>{
      const requester = req.decoded.email;
          const requesterAccount = await userCollection.findOne({ email: requester });
          if (requesterAccount.role === 'admin') {
            next()
          }else{
            res.status(403).send({message: 'forbidden'});
          }
    }

    app.get('/service', async (req, res) => {
      const quary = {}
      const cursor = serviceCollection.find(quary).project({name:1})
      const services = await cursor.toArray();
      res.send(services)
    })
    //show all user
    app.get('/user', verifyJwt, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    //check admin
    app.get('/admin/:email', async(req, res) =>{
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin})
    })
    // make admin
    app.put('/user/admin/:email',verifyJwt,verifyAdmin, async (req, res) => {
      const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
    })
    // 
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const filter = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ result, token })
    })
    // query api
    //worning
    //This is not the proper way to query.
    //After learning more about mongodb,use aggregate lookup,pipeline,match,group
    app.get('/available', async (req, res) => {
      const date = req.query.date;

      // step 1:  get all services
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service
      services.forEach(service => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(book => book.treatment === service.name);
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map(book => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(slot => !bookedSlots.includes(slot));
        //step 7: set available to slots to make it easier 
        service.slots = available;
      });


      res.send(services);
    })
    // user wasyes appoiment booking
    app.get('/booking', verifyJwt, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      }
      else {
        return res.status(403).send({ message: 'Forbidden access' })
      }

    })
    //load  single booking by id
    app.get('/booking/:id',verifyJwt, async(req,res)=>{
      const id=req.params.id
      const query={_id:ObjectId(id)}
      const booking=await bookingCollection.findOne(query)
      res.send(booking)
    })

    // add booking
    app.post('/booking', async (req, res) => {
      const booking = req.body
      const quary = {
        treatment: booking.treatment, date: booking.date, patient: booking.patient
      }
      const exists = await bookingCollection.findOne(quary)
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result })
    });

    //add doctor
    app.post('/doctor',verifyJwt,verifyAdmin, async(req,res)=>{
      const doctor=req.body
      const result=await dectorCollection.insertOne(doctor)
      res.send(result)
    });
    //load all Doctor
    app.get('/doctor',verifyJwt,verifyAdmin, async(req,res)=>{
      const doctor= await dectorCollection.find().toArray()
      res.send(doctor)
    })
    //Delete Doctor
    app.delete('/doctor/:email',verifyJwt,verifyAdmin, async(req,res)=>{
      const email=req.params.email
      const filter={email:email}
      const result= await dectorCollection.deleteOne(filter)
      res.send(result)
    })
    // payment method
    app.post('/create-payment-intent', verifyJwt, async(req, res) =>{
      const service = req.body;
      const price = service.price;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });
  }
  finally {

  }
}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})