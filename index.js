const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port=process.env.PORT || 5000;
const app=express()


//meddle ware
app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l7piq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        console.log("data base connected")
        const serviceCollection = client.db('doctors_protal').collection('services');
        const bookingCollection = client.db('doctors_protal').collection('booking');

        app.get('/service',async(req,res)=>{
            const quary={}
            const cursor=serviceCollection.find(quary)
            const services=await cursor.toArray();
            res.send(services)
        })

        // add booking
        app.post('/booking',async(req,res)=>{
          const booking=req.body
          const quary={treatment:booking.treatment,date:booking.date,patient:booking.patient
          }
          const exists=await bookingCollection.findOne(quary)
          if(exists){
            return res.send({success:false,booking:exists})
          }
          const result=await bookingCollection.insertOne(booking);
          return res.send({success:true,result})
        })
    }
    finally{

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})