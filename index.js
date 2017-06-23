// jshint esversion:6

var express = require('express');
var request = require('request');
var fs = require('file-system');

var server = express();
var port = process.env.PORT || 8080;

process.env.DEBUG = 'actions-on-google:*';
var ApiAiApp = require('actions-on-google').ApiAiApp;

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

Array.prototype.toSpokenList = function() {
	// Converts an array (['one', 'two', 'three']) to a list ('one, two, and three')
	if(this.length == 1) {
		return this[0];
	} else {
    var last = this.pop();
    return this.join(', ') + ' and ' + last;
  }
};

var bodyParser = require('body-parser');
server.use(bodyParser.json()); // support json encoded bodies

server.post('/', (req, res) => comms.apiai(req, res, cache.data));

server.get('/update-entity', (req, res) => {
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

server.get('/update-cache', (req, res) => {
	var updateType = req.query.type;
	console.log('Test message');

	if(updateType == 'routes') {
		cache.update.routes();
		res.end('File probably updated.'); //TODO
	} else if(updateType == 'stops') {
		cache.update.stops();
		res.end('File probably updated.'); //TODO
	}
});

// start the server
server.listen(port, err => {	
	if (err) {
		return console.log('something bad happened', err);
	}
	console.log('Server started! At http://localhost:' + port);
});
