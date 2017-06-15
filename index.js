// jshint esversion:6

var express = require('express');
var request = require('request');
var fs = require('file-system');

var server = express();
var port = process.env.PORT || 8080;

process.env.DEBUG = 'actions-on-google:*';
var apiaiApp = require('actions-on-google').ApiAiApp;

var cache = require('./cache/index');
var apiai = require('./apiai/index');
//var comms = require('./processing/index');

Array.prototype.pushIfNew = function(item) {
	duplicateIndex = this.findIndex(element => {
		return item == element;
	});
	if(duplicateIndex == -1) {
		this.push(item);
	}
};

var bodyParser = require('body-parser');
server.use(bodyParser.json()); // support json encoded bodies

//server.post('/', (req, res) => res.JSON(comms.processRequest(req, cache.data)));

server.get('/', (req, res) => {
  const app = new apiaiApp({req, res});
  console.log('Request headers: ' + JSON.stringify(req.headers));
	console.log('Request body: ' + JSON.stringify(req.body));
	  // Make a silly name
  function giveStop(app) {
    let stop = app.getArgument('stop');

    app.tell('The stop requested is:' + stop);
  }

  let actionMap = new Map();
  actionMap.set('give_time', giveStop);

	app.handleRequest(actionMap);
});

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
