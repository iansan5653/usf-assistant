// grab the packages we need
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

// routes will go here

// POST http://localhost:8080/api/users
// parameters sent with 
app.post('/', function(req, res) {
    var message_sent = req.body.result.resolvedQuery;

    console.log(message_sent);

    response = {
			"speech": "Barack Hussein Obama II is the 44th and current President of the United States.",
			"displayText": "Barack Hussein Obama II is the 44th and current President of the United States, and the first African American to hold the office. Born in Honolulu, Hawaii, Obama is a graduate of Columbia University   and Harvard Law School, where ",
			"data": {},
			"contextOut": [],
			"source": "DuckDuckGo"
		}

    res.json(response);
});

// start the server
app.listen(port, (err) => {  
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log('Server started! At http://localhost:' + port);
})
