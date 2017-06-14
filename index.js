// jshint esversion:6

var express = require('express');
var request = require('request');
var fs = require('file-system');

var app = express();
var port = process.env.PORT || 8080;

var cache = require('./cache/index');
var apiai = require('./apiai/index');
var comms = require('./comms/index');

Array.prototype.pushIfNew = function(item) {
	duplicateIndex = this.findIndex(element => {
		return item == element;
	});
	if(duplicateIndex == -1) {
		this.push(item);
	}
};

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

app.post('/', (req, res) => res.JSON(comms.processRequest(req, cache.data)));

app.get('/update-entity', (req, res) => {
	var updateType = req.query.type,
			key = req.query.key;

	if(updateType == 'routes') {
		apiai.update.routes(cache.data, key);
		res.end('File probably updated.'); //TODO

	} else if(updateType == 'stops') {
		apiai.update.stops(cache.data, key);
		res.end('File probably updated.'); //TODO
	}
});

app.get('/update-cache', (req, res) => {
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
app.listen(port, err => {	
	if (err) {
		return console.log('something bad happened', err);
	}
	console.log('Server started! At http://localhost:' + port);
});
