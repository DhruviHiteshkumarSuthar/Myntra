const express = require('express');
const bodyParser = require('body-parser');


const app = express();
const PORT = 8000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});