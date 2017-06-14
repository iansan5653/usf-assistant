var express = require('express');
var request = require('request');
var fs = require('file-system');

var app = express();
var port = process.env.PORT || 8080;

var cache = require('./cache/index');
var apiai = require('./apiai/index');

Array.prototype.pushIfNew = function(item) {
	duplicateIndex = this.findIndex(function(element) {
		return item == element;
	});
	if(duplicateIndex == -1) {
		this.push(item);
	}
};

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

app.post('/', function(req, res) {
	var messageSent = req.body.result.resolvedQuery;
	var stopName = req.body.result.parameters.stop;

	var stops = require('./cached_data/stops/stops.json');
	var stopID = stops.find(function(stop) {
		return stop.Name == stopName;
	}).ID;

	if(stopID !== undefined) {
		request('https://usfbullrunner.com/Stop/' + stopID + '/Arrivals?customerID=3', 
			function (error, response, body) {

			bodyJSON = JSON.parse(body);
			if (!error && response.statusCode == 200) {
				if (bodyJSON.length !== 0) {

					response = {
						"speech": "The next bus will arrive #soon.",
						"displayText": "The next bus will arrive #soon.",
						"data": {},
						"contextOut": [],
						"source": "USF Bull Runner"
					};
					res.json(response);

				} else {

					response = {
						"speech": "It looks like there aren't any buses on that route right now.",
						"displayText": "There aren't any buses on that route right now.",
						"data": {},
						"contextOut": [],
						"source": "USF Bull Runner"
					};
					res.json(response);
				}
			} else {

				response = {
					"speech": "There was an error retrieving information.",
					"displayText": "There was an error retrieving information.",
					"data": {},
					"contextOut": [],
					"source": "USF Bull Runner"
				};
				res.json(response);
			}
		});
	} else {
		response = {
			"speech": "Sorry, I couldn't find that stop.",
			"displayText": "I couldn't find that stop.",
			"data": {},
			"contextOut": [],
			"source": "USF Bull Runner"
		};
		res.json(response);
	}
});

app.get('/update-entity', function(req, res) {
	var updateType = req.query.type;

	if(updateType == 'routes') {
		apiai.update.routes(cache.data, req.query.key);
		res.end('File probably updated.'); //TODO

	} else if(updateType == 'stops') {
		apiai.update.stops(cache.data, req.query.key);
		res.end('File probably updated.'); //TODO
	}
});

app.get('/update-cache', function(req, res) {
	var updateType = req.query.type;

	if(updateType == 'routes') {
		cache.update.routes();
		res.end('File probably updated.'); //TODO
	} else if(updateType == 'stops') {
		cache.update.stops();
		res.end('File probably updated.'); //TODO
	}
});

// start the server
app.listen(port, function(err) {	
	if (err) {
		return console.log('something bad happened', err);
	}

	console.log('Server started! At http://localhost:' + port);
});
