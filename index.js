// grab the packages we need
var express = require('express');
var request = require('request');
var fs = require('file-system');

var app = express();
var port = process.env.PORT || 8080;


Array.prototype.pushIfNew = function(item) {
	duplicate_index = this.findIndex(function(element) {
		return item == element;
	});
	if(duplicate_index == -1) {
		this.push(item);
	};
};

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

app.post('/', function(req, res) {
  var message_sent = req.body.result.resolvedQuery;
  var stop_name = req.body.result.parameters.stop;

  var stops = require('./cached_data/stops/stops.json');
  var stop_id = stops.find(function(stop) {
	  return stop.Name = stop_name;
	}).ID;

  if(stop_id != undefined) {
		request('https://usfbullrunner.com/Stop/' + stop_id + '/Arrivals?customerID=3', function (error, response, body) {
			body_json = JSON.parse(body);
		  if (!error && response.statusCode == 200) {
		  	if (body_json.length != 0) {

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

					body_json = JSON.parse(body0);
					entry_names = [];
					body_json.entries.forEach(function(entry) {
						entry_names.push(entry.value);
					});

					var entry_names_string = '["' + entry_names.join('","') + '"]';
					console.log(entry_names_string);
					res.end();

					request(
						{
							method: 'DELETE',
					  	url: 'https://api.api.ai/v1/entities/stop/entries',
						  headers: {
						    'authorization': 'Bearer ' + key
						  },
						  body: entry_names_string
						}, 
						function (error1, response1, body1) {
							if (!error1 && response1.statusCode == 200) {
								console.log("Deleted succesfully.");

								var new_entries = []
								var stops = require('./cached_data/stops/stops.json');

								stops.forEach(function(stop) {
									var synonyms = [];
									var stop_name_valid = stop.Name.replace(/\(|\)|\[|\]/g, '');
									// Remove parentheses (brackets are not supported in the entity synonym entries)
									synonyms.pushIfNew(stop_name_valid);
									// Remove surrounding whitespace
									synonyms.pushIfNew(stop_name_valid.trim());
									// Remove '/'
									synonyms.pushIfNew(stop_name_valid.replace(/\//g, '').trim());
									// Replace any '-' with ' '
									synonyms.pushIfNew(stop_name_valid.replace(/-/g, ' ').trim());
									// Replace any '&' with 'and'
									synonyms.pushIfNew(stop_name_valid.replace(/&/g, 'and').trim());
									// Remove any acronyms (ALL CAPS)
									synonyms.pushIfNew(stop_name_valid.replace(/\b[A-Z]{3,}\b\b/, '').trim());
									// Remove any parenthetical phrases
									synonyms.pushIfNew(stop.Name.replace(/ *\([^)]*\) */g, "").trim());
									// Allow reference by stop number
									synonyms.pushIfNew("Stop " + stop.Number);

									var stop_entry = {
										'value': stop.Name,
										'synonyms': synonyms
									};
									new_entries.push(stop_entry);
								});
								console.log(JSON.stringify(new_entries));
								
								request(
									{
										method: 'POST',
										url: 'https://api.api.ai/v1/entities/stop/entries',
										headers: {
									    'authorization': 'Bearer ' + key
									  },
										body: JSON.stringify(new_entries)
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

		// Clear current new_entries
		request( {
		  	url: 'https://api.api.ai/v1/entities/route',
			  headers: {
			    'authorization': 'Bearer ' + key
			  }
			}, function (error0, response0, body0) {
				if (!error0 && response0.statusCode == 200) {

					body_json = JSON.parse(body0);
					entry_names = [];
					body_json.entries.forEach(function(entry) {
						entry_names.push(entry.value);
					});

					var entry_names_string = '["' + entry_names.join('","') + '"]';
					console.log(entry_names_string);
					res.end();

					request(
						{
							method: 'DELETE',
					  	url: 'https://api.api.ai/v1/entities/route/entries',
						  headers: {
						    'authorization': 'Bearer ' + key
						  },
						  body: entry_names_string
						}, 
						function (error1, response1, body1) {
							if (!error1 && response1.statusCode == 200) {
								console.log("Deleted entries succesfully.");

								var new_entries = []
								var routes = require('./cached_data/routes.json');

								routes.forEach(function(route) {
									var synonyms = [];
									var route_name_valid = route.Name.replace(/\(|\)|\[|\]/g, '');
									// Remove parentheses (brackets are not supported in the entity synonym entries)
									synonyms.pushIfNew(route_name_valid);
									// Remove surrounding whitespace
									synonyms.pushIfNew(route_name_valid.trim());
									// Remove '/'
									synonyms.pushIfNew(route_name_valid.replace(/\//g, '').trim());
									// Replace any '-' with ' '
									synonyms.pushIfNew(route_name_valid.replace(/-/g, ' ').trim());
									// Replace any '&' with 'and'
									synonyms.pushIfNew(route_name_valid.replace(/&/g, 'and').trim());
									// Remove any acronyms (ALL CAPS)
									synonyms.pushIfNew(route_name_valid.replace(/\b[A-Z]{3,}\b/, '').trim());
									// Remove any parenthetical phrases
									synonyms.pushIfNew(route.Name.replace(/ *\([^)]*\) */g, "").trim());

									var route_entry = {
										'value': route.Name,
										'synonyms': synonyms
									};
									new_entries.push(route_entry);
								});
								console.log(JSON.stringify(new_entries));
								
								request(
									{
										method: 'POST',
										url: 'https://api.api.ai/v1/entities/route/entries',
										headers: {
									    'authorization': 'Bearer ' + key
									  },
										body: JSON.stringify(new_entries)
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
	var stops_raw = [];
	var routes = require('./cached_data/routes.json');

	function getRouteFile(num = 0) {
		if(num < routes.length) {
			request('https://usfbullrunner.com/Route/' + routes[num].ID + '/Direction/0/Stops', function (error, response, body) {
				// TODO add error handling
				var route_object = {
					'ID': routes[num].ID,
					'Data': JSON.parse(body)
				}
				stops_raw.push(route_object);
				console.log(num);
				num++;
				getRouteFile(num); // note: recursive
			});
		} else {
			var stops_new = [];
			stops_raw.forEach(function(stops) {
				stops.Data.forEach(function(stop) {
			  	var stop_duplicate_index = stops_new.findIndex(function(stop_duplicate) {
			  		// If the stop has multiple routes, it will appear multiple times
					  return stop.ID == stop_duplicate.ID;
					});

					if(stop_duplicate_index == -1) {
				  	var stop_object = {
				  		'Name': stop.Name,
				  		'ID': stop.ID,
				  		'Number': stop.RtpiNumber,
			  			'Latitude': stop.Latitude,
			  			'Longitude': stop.Longitude,
			  			'Routes': [stops.ID]
			  		}
			  		stops_new.push(stop_object);
			  	} else {
						stops_new[stop_duplicate_index].Routes.push(stops.ID);
			  	}
			  });
			});
			fs.writeFile('./cached_data/stops/stops.json', JSON.stringify(stops_new, null, 2), function (err) {
			  if (err) return console.log('File update failed:' + err);
			});
			console.log('File updated.')
			res.end('File updated.');
		}
	}
	getRouteFile();
});

app.get('/update-routes', function(req, res) {
	var routes_new = [];
  request('https://usfbullrunner.com/Region/0/Routes', function(error, response, body) {
  	//TODO add error handling
  	body_json = JSON.parse(body);

  	body_json.forEach(function(route) {
  		var route_object = {
				'ID': route.ID,
				'Name': route.Name,
				'SortName': route.DisplayName,
				'Letter': route.ShortName
			};
  		routes_new.push(route_object);
  	});
  	fs.writeFile('./cached_data/routes.json', JSON.stringify(routes_new, null, 2), function (err) {
		  if (err) return console.log('File update failed: ' + err);
		});
		res.end('File updated.');
	});
});

// start the server
app.listen(port, (err) => {  
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log('Server started! At http://localhost:' + port);
})
