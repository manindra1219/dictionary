const express = require('express');
const app = express();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const bcrypt = require('bcrypt');

const serviceAccount = require("./key.json");
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.sendFile(__dirname + "/dashboard.html");
});

app.get('/signup', function (req, res) {
    res.sendFile(__dirname + "/signup.html");
});

app.post('/signupsubmit', async function (req, res) {
    const { fullname, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const existingUser = await db.collection("studentsinfo")
            .where("Email", "==", email)
            .get();

        if (!existingUser.empty) {
            return res.send("Email already exists. Please use a different email.");
        }

        await db.collection("studentsinfo").add({
            Fullname: fullname,
            Email: email,
            password: hashedPassword,
        });

        res.redirect("/login");
    } catch (error) {
        console.error(error);
        res.send("An error occurred during sign-up.");
    }
});

app.get('/login', function (req, res) {
    res.sendFile(__dirname + "/login.html");
});

app.post('/loginsubmit', function (req, res) {
    const { email, password } = req.body;
    
    db.collection("studentsinfo")
        .where("Email", "==", email)
        .get()
        .then(async (docs) => {
            if (docs.size > 0) {
                const user = docs.docs[0].data();
                const passwordMatch = await bcrypt.compare(password, user.password);

                if (passwordMatch) {
                    res.redirect("/dictionary");
                } else {
                    res.send("Invalid password");
                }
            } else {
                res.send("Please enter valid credentials");
            }
        });
});

app.get('/dictionary', function (req, res) {
    res.render('indexdictionary', { word: '', phonetics: '', definition: '', example: '', synonyms: [] });
});

app.post('/search', async (req, res) => {
    const searchTerm = req.body.searchTerm;

    try {
        const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${searchTerm}`);
        const wordData = response.data;

        if (Array.isArray(wordData) && wordData.length > 0) {
            const word = wordData[0].word;
            const phonetics = wordData[0].phonetics[0].text;
            const definition = wordData[0].meanings[0].definitions[0].definition;
            const example = wordData[0].meanings[0].definitions[0].example;
            const synonyms = wordData[0].meanings[0].definitions[0].synonyms || [];

            res.render('indexdictionary', { word, phonetics, definition, example, synonyms });
        } else {
            res.render('indexdictionary', { word: 'No word found.', phonetics: '', definition: '', example: '', synonyms: [] });
        }
    } catch (error) {
        res.render('indexdictionary', { word: 'Sorry, an error occurred.', phonetics: '', definition: '', example: '', synonyms: [] });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`App is running on port ${port}`);
});
