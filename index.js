const express = require('express');
const bodyParser = require('body-parser');
const Cloudant = require('@cloudant/cloudant');

const app = express();
const PORT = process.env.PORT || 8000;
const url = "https://apikey-v2-2e5kdlgplmovp6jb5xfuok6afjra827zegiyhiw2ul1u:d32ec5f34b80eec562777356d8d80d1b@b9884815-a388-4e5e-8d1d-784e73de0044-bluemix.cloudantnosqldb.appdomain.cloud";
const username = "apikey-v2-2e5kdlgplmovp6jb5xfuok6afjra827zegiyhiw2ul1u";
const password = "d32ec5f34b80eec562777356d8d80d1b";

const cloudant = Cloudant({ url: url, username: username, password: password });
const usersDB = cloudant.use('myntra_users');

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.post('/signup', (req, res) => {
  const { name, email, upassword } = req.body;

  usersDB.get(name, (err, body) => {
    if (!err && body) {
      // Name already exists
      console.log('Name already exists:', name);
      res.status(400).send('Name already exists');
    } else if (err && err.statusCode === 404) {
      // Name does not exist, create new user
      const newUser = { _id: name, email: email, upassword: upassword };
      usersDB.insert(newUser, (err, result) => {
        if (err) {
          console.error('Error creating user:', err);
          res.status(500).send('Error creating user');
        } else {
          console.log('User created successfully:', name);
          res.redirect(`/preferences.html?name=${name}`);
        }
      });
    } else {
      console.error('Error getting user:', err);
      res.status(500).send('Error checking existing user');
    }
  });
});

app.post('/signin', (req, res) => {
  const { name, upassword } = req.body;

  usersDB.get(name, (err, body) => {
    if (!err && body) {
      // User found, check password
      if (body.upassword === upassword) {
        console.log('Sign in successful:', name);
        res.redirect(`/home.html?name=${name}`);
      } else {
        console.log('Invalid password:', name);
        res.status(400).send('Invalid name or password');
      }
    } else if (err && err.statusCode === 404) {
      // User not found
      console.error('User not found:', name);
      res.status(400).send('User not found');
    } else {
      console.error('Error getting user:', err);
      res.status(500).send('Error checking user');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});