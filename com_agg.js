const express = require('express');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = 8080;
const path = require('path');

app.use(express.static('public'));
app.use(session({ secret: 'Do this later', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.use(cors());
app.use(bodyParser.json());

const URI = process.env.URI;
const DBName = process.env.DBNAME;
const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
const database = client.db(DBName);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB', error);
    }
}
connectToDatabase();

let usersCollection;

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENTID,
    clientSecret: process.env.CLIENTSECRET,
    callbackURL: 'http://localhost:8080/auth/google/callback'
},
async (accessToken, refreshToken, profile, cb) => {
    try {
        usersCollection = database.collection("Users");
        let user = await usersCollection.findOne({ googleId: profile.id });

        if (!user) {
            const newUser = {
                googleId: profile.id,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                email: profile.emails[0].value
            };

            const result = await usersCollection.insertOne(newUser);
            user = await usersCollection.findOne({ _id: result.insertedId });
        }

        cb(null, user);
    } catch (error) {
        cb(error, null);
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user.googleId);
});

passport.deserializeUser(async (id, cb) => {
    try {
        const user = await usersCollection.findOne({ googleId: id });
        cb(null, user);
    } catch (error) {
        cb(error, null);
    }
});

// Express Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// More routes here ...

// Synchronous Call - Client Side Script
async function synchronousCall() {
    const endpoints = [
        'http://localhost:8080/api/users',
        'http://localhost:8080/api/cart',
        'http://localhost:8080/api/join'
    ];

    for (const endpoint of endpoints) {
        const response = await fetch(endpoint);
        const data = await response.json();
        console.log(`Response from ${endpoint}:`, data);
    }
}

// Asynchronous Call - Client Side Script
async function asynchronousCall() {
    const endpoints = [
        'http://localhost:8080/api/users',
        'http://localhost:8080/api/cart',
        'http://localhost:8080/api/join'
    ];

    const promises = endpoints.map(endpoint => fetch(endpoint).then(response => response.json()));

    const responses = await Promise.all(promises);
    responses.forEach((data, index) => {
        console.log(`Response from ${endpoints[index]}:`, data);
    });
}

// Synchronous Aggregator Endpoint - Server Side
app.get('/api/aggregated/sync', async (req, res) => {
    try {
        const users = await fetch('http://localhost:8080/api/users').then(response => response.json());
        const carts = await fetch('http://localhost:8080/api/cart').then(response => response.json());
        const joinInfo = await fetch('http://localhost:8080/api/join').then(response => response.json());

        const aggregatedData = { users, carts, joinInfo };
        res.json(aggregatedData);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Asynchronous Aggregator Endpoint - Server Side
app.get('/api/aggregated/async', async (req, res) => {
    try {
        const endpoints = [
            fetch('http://localhost:8080/api/users').then(response => response.json()),
            fetch('http://localhost:8080/api/cart').then(response => response.json()),
            fetch('http://localhost:8080/api/join').then(response => response.json())
        ];

        const [users, carts, joinInfo] = await Promise.all(endpoints);
        const aggregatedData = { users, carts, joinInfo };
        res.json(aggregatedData);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

// Client-side function calls (if needed)
// synchronousCall();
// asynchronousCall();
