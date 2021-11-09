const express = require('express')
const { MongoClient } = require('mongodb');
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");
require('dotenv').config();
// const ObjectId=require('mongodb').ObjectId
app.use(cors());
app.use(express.json())
const port = process.env.PORT || 5000
//admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.get('/', (req, res) => {
    res.send('welcome in Doctor Portal Server!!!!')
});
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eoyrd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');


        //get
        app.get('/appointments', verifyToken,  async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString('en-US',{timeZone:'UTC'});
            console.log(date)
            const query = { email: email, date:date }

            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            res.json(result)
        });
        //post user
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });
        //get user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin=true;
            }
        res.json({admin:isAdmin});

        })
        //put
        app.put('/users', async (req, res) => {
            const user = req.body
            const filter={email:user.email}
            const options = { upsert: true }
            const updateDoc={$set:user}
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.json(result)
        })
        //admin put
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })


    }
    finally {
        
    }

}
run().catch(console.dir);








//listen
app.listen(port, () => {
    console.log('Server is running',port)
})