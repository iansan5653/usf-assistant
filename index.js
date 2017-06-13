var express = require('express');
var request = require('request');
var fs = require('file-system');

var app = express();
var port = process.env.PORT || 8080;

var cache = require('./cache/index');

Array.prototype.pushIfNew = function(item) {
	duplicateIndex = this.findIndex(function(element) {
		return item == element;
	});
	if(duplicateIndex == -1) {
		this.push(item);
	};
};

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

app.post('/', function(req, res) {
	var messageSent = req.body.result.resolvedQuery;
	var stopName = req.body.result.parameters.stop;

	var stops = require('./cached_data/stops/stops.json');
	var stopID = stops.find(function(stop) {
		return stop.Name = stopName;
	}).ID;

	if(stopID != undefined) {
		request('https://usfbullrunner.com/Stop/' + stopID + '/Arrivals?customerID=3', 
			function (error, response, body) {

			bodyJSON = JSON.parse(body);
			if (!error && response.statusCode == 200) {
				if (bodyJSON.length != 0) {

					response = {
						"speech": "The next bus will arrive #soon.",
						"displayText": "The next bus will arrive #soon.",
						"data": {},
						"contextOut": [],
						"source": "USF Bull Runner"
					}
					res.json(response);

				} else {

					response = {
						"speech": "It looks like there aren't any buses on that route right now.",
						"displayText": "There aren't any buses on that route right now.",
						"data": {},
						"contextOut": [],
						"source": "USF Bull Runner"
					}
					res.json(response);
				}
			} else {

				response = {
					"speech": "There was an error retrieving information.",
					"displayText": "There was an error retrieving information.",
					"data": {},
					"contextOut": [],
					"source": "USF Bull Runner"
				}
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
		}
		res.json(response);
	}
});

app.get('/update-entity-stop', function(req, res) {
		// Developer key
		var key = req.query.key;

		// Clear current new_entries
		request( {
				url: 'https://api.api.ai/v1/entities/stop',
				headers: {
					'authorization': 'Bearer ' + key
				}
			}, function (error0, response0, body0) {
				if (!error0 && response0.statusCode == 200) {

					bodyJSON = JSON.parse(body0);
					entryNames = [];
					bodyJSON.entries.forEach(function(entry) {
						entryNames.push(entry.value);
					});

					var entryNamesString = '["' + entryNames.join('","') + '"]';
					console.log(entryNamesString);
					res.end();

					request(
						{
							method: 'DELETE',
							url: 'https://api.api.ai/v1/entities/stop/entries',
							headers: {
								'authorization': 'Bearer ' + key
							},
							body: entryNamesString
						}, 
						function (error1, response1, body1) {
							if (!error1 && response1.statusCode == 200) {
								console.log("Deleted succesfully.");

								var newEntries = []
								var stops = require('./cached_data/stops/stops.json');

								stops.forEach(function(stop) {
									var synonyms = [];
									var stopNameValid = stop.Name.replace(/\(|\)|\[|\]/g, '');
									// Remove parentheses 
									// (brackets are not supported in the entity synonym entries)
									synonyms.pushIfNew(stopNameValid);
									// Remove surrounding whitespace
									synonyms.pushIfNew(stopNameValid.trim());
									// Remove '/'
									synonyms.pushIfNew(stopNameValid.replace(/\//g, '').trim());
									// Replace any '-' with ' '
									synonyms.pushIfNew(stopNameValid.replace(/-/g, ' ').trim());
									// Replace any '&' with 'and'
									synonyms.pushIfNew(stopNameValid.replace(/&/g, 'and').trim());
									// Remove any acronyms (ALL CAPS)
									synonyms.pushIfNew(stopNameValid.replace(/\b[A-Z]{3,}\b\b/, '').trim());
									// Remove any parenthetical phrases
									synonyms.pushIfNew(stop.Name.replace(/ *\([^)]*\) */g, "").trim());
									// Allow reference by stop number
									synonyms.pushIfNew("Stop " + stop.Number);

									var stopEntry = {
										'value': stop.Name,
										'synonyms': synonyms
									};
									newEntries.push(stopEntry);
								});
								console.log(JSON.stringify(newEntries));
								
								request(
									{
										method: 'POST',
										url: 'https://api.api.ai/v1/entities/stop/entries',
										headers: {
											'authorization': 'Bearer ' + key
										},
										body: JSON.stringify(newEntries)
									},
									function(error2, response2, body2) {
										if (!error2 && response2.statusCode == 200) {
											console.log('Added succesfully.');
											res.end('Added succesfully.');
										} else {
											console.log("There was an error adding entities: " + response2.statusCode);
											res.end("There was an error adding entities: " + response2.statusCode);
										}
									}
								)

							} else {
								console.log("There was an error deleting entities: " + response1.statusCode);
								res.end("There was an error deleting entities: " + response1.statusCode);
							}
						}
					)

				} else {
					console.log("There was an error retrieving entities: " + response0.statusCode)
					res.end("There was an error retrieving entities: " + response0.statusCode);
				}
			}
		)
});

app.get('/update-entity-route', function(req, res) {
		// Developer key
		var key = req.query.key;
		// TODO: Combine entity updating into a single endpoint

		// Clear current newEntries
		request( {
				url: 'https://api.api.ai/v1/entities/route',
				headers: {
					'authorization': 'Bearer ' + key
				}
			}, function (error0, response0, body0) {
				if (!error0 && response0.statusCode == 200) {

					bodyJSON = JSON.parse(body0);
					entryNames = [];
					bodyJSON.entries.forEach(function(entry) {
						entryNames.push(entry.value);
					});

					var entryNamesString = '["' + entryNames.join('","') + '"]';
					console.log(entryNamesString);
					res.end();

					request(
						{
							method: 'DELETE',
							url: 'https://api.api.ai/v1/entities/route/entries',
							headers: {
								'authorization': 'Bearer ' + key
							},
							body: entryNamesString
						}, 
						function (error1, response1, body1) {
							if (!error1 && response1.statusCode == 200) {
								console.log("Deleted entries succesfully.");

								var newEntries = []
								var routes = require('./cached_data/routes.json');

								routes.forEach(function(route) {
									var synonyms = [];
									var routeNameValid = route.Name.replace(/\(|\)|\[|\]/g, '');
									// Remove parentheses 
									// (brackets are not supported in the entity synonym entries)
									synonyms.pushIfNew(routeNameValid);
									// Remove surrounding whitespace
									synonyms.pushIfNew(routeNameValid.trim());
									// Remove '/'
									synonyms.pushIfNew(routeNameValid.replace(/\//g, '').trim());
									// Replace any '-' with ' '
									synonyms.pushIfNew(routeNameValid.replace(/-/g, ' ').trim());
									// Replace any '&' with 'and'
									synonyms.pushIfNew(routeNameValid.replace(/&/g, 'and').trim());
									// Remove any acronyms (ALL CAPS)
									synonyms.pushIfNew(routeNameValid.replace(/\b[A-Z]{3,}\b/, '').trim());
									// Remove any parenthetical phrases
									synonyms.pushIfNew(route.Name.replace(/ *\([^)]*\) */g, "").trim());

									var routeEntry = {
										'value': route.Name,
										'synonyms': synonyms
									};
									newEntries.push(routeEntry);
								});
								console.log(JSON.stringify(newEntries));
								
								request(
									{
										method: 'POST',
										url: 'https://api.api.ai/v1/entities/route/entries',
										headers: {
											'authorization': 'Bearer ' + key
										},
										body: JSON.stringify(newEntries)
									},
									function(error2, response2, body2) {
										if (!error2 && response2.statusCode == 200) {
											console.log('Added succesfully.');
											res.end('Added succesfully.');
										} else {
											console.log("There was an error adding entities: " + response2.statusCode);
											res.end("There was an error adding entities: " + response2.statusCode);
										}
									}
								)

							} else {
								console.log("There was an error deleting entities: " + response1.statusCode);
								res.end("There was an error deleting entities: " + response1.statusCode);
							}
						}
					)

				} else {
					console.log("There was an error retrieving entities: " + response0.statusCode)
					res.end("There was an error retrieving entities: " + response0.statusCode);
				}
			}
		)
});

app.get('/update-stops', function(req, res) {
	var stopsRaw = [];
	var routes = require('./cached_data/routes.json');

	function getRouteFile(num = 0) {
		if(num < routes.length) {
			request('https://usfbullrunner.com/Route/' + routes[num].ID + '/Direction/0/Stops',
			function (error, response, body) {
				// TODO add error handling
				var routeObject = {
					'ID': routes[num].ID,
					'Data': JSON.parse(body)
				}
				stopsRaw.push(routeObject);
				console.log(num);
				num++;
				getRouteFile(num); // note: recursive
			});
		} else {
			var stopsNew = [];
			stopsRaw.forEach(function(stops) {
				stops.Data.forEach(function(stop) {
					var stopDuplicateIndex = stopsNew.findIndex(function(stopDuplicate) {
						// If the stop has multiple routes, it will appear multiple times
						return stop.ID == stopDuplicate.ID;
					});

					if(stopDuplicateIndex == -1) {
						var stopObject = {
							'Name': stop.Name,
							'ID': stop.ID,
							'Number': stop.RtpiNumber,
							'Latitude': stop.Latitude,
							'Longitude': stop.Longitude,
							'Routes': [stops.ID]
						}
						stopsNew.push(stopObject);
					} else {
						stopsNew[stopDuplicateIndex].Routes.push(stops.ID);
					}
				});
			});
			fs.writeFile('./cached_data/stops/stops.json', 
			JSON.stringify(stopsNew, null, 2), function (err) {
				if (err) return console.log('File update failed:' + err);
			});
			console.log('File updated.')
			res.end('File updated.');
		}
	}
	getRouteFile();
});

app.get('/update-routes', function(req, res) {
	var routesNew = [];
	request('https://usfbullrunner.com/Region/0/Routes', 
	function(error, response, body) {
		//TODO add error handling
		bodyJSON = JSON.parse(body);

		bodyJSON.forEach(function(route) {
			var routeObject = {
				'ID': route.ID,
				'Name': route.Name,
				'SortName': route.DisplayName,
				'Letter': route.ShortName
			};
			routesNew.push(routeObject);
		});
		fs.writeFile('./cached_data/routes.json',
		JSON.stringify(routesNew, null, 2), function (err) {
			if (err) return console.log('File update failed: ' + err);
		});
		res.end('File updated.');
	});
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
app.listen(port, (err) => {	
	if (err) {
		return console.log('something bad happened', err)
	}

	console.log('Server started! At http://localhost:' + port);
})
