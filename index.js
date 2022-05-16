const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express()


//meddle ware
app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l7piq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

 function verifyJwt(req,res,next){
      const authHader=req.headers.authorization
      if(!authHader){
        return res.status(401).send({message:'Unauthorization'})
      }
      const token=authHader.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
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

    app.get('/service', async (req, res) => {
      const quary = {}
      const cursor = serviceCollection.find(quary)
      const services = await cursor.toArray();
      res.send(services)
    })
    //show all user
    app.get('/user', async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
// 
    app.put('/user/:email',async(req,res)=>{
      const email=req.params.email
      const user=req.body
      const filter = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const  token = jwt.sign({ email:email }, process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '1h' });
      res.send({result,token})
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
// user wasyes appoiment 
    app.get('/booking',verifyJwt, async(req, res) =>{
      const patient = req.query.patient;
      const decodedEmail=req.decoded.email
      if(patient === decodedEmail){
        const query = {patient: patient};
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      }
      else{
        return  res.status(403).send({ message: 'Forbidden access' })
      }
      
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
    })
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