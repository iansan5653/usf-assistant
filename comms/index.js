// jshint esversion:6
process.env.DEBUG = 'actions-on-google:*';
var request = require('request');
var ApiAiApp = require('actions-on-google').ApiAiApp;

function getDistance(cachedStop, currentLoc) {
	var deltaDeg = {
		lat: (cachedStop.Latitude - currentLoc.latitude),
		lon: (cachedStop.Longitude - currentLoc.longitude)
	};
	var delta = {
		lat: deltaDeg.lat.toRad(),
		lon: deltaDeg.lon.toRad()
	};
	var radius = 6371; // km, of Earth

	var a = Math.sin(delta.lat/2) * Math.sin(delta.lat/2) + 
	                Math.cos(cachedStop.Latitude.toRad()) * Math.cos(currentLoc.latitude.toRad()) * 
	                Math.sin(delta.lon/2) * Math.sin(delta.lon/2);  
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	var distance = radius * c; 
	console.log(distance);
	return distance;
}

// Returns a Google Maps url with navigation from current location to coordinates
function getNavURL(targetLoc) {
	var baseURL = 'https://www.google.com/maps/dir/?api=1&',
		lat = encodeURI(targetLoc.Latitude),
		lon = encodeURI(targetLoc.Longitude);
	return baseURL + 'destination=' + lat + ',' + lon;
}

module.exports.apiai = function(req, res, data) {
	var app = new ApiAiApp({request: req, response: res});

  // Status of the system as a whole
  // Takes no inputs, sets no contexts
  function overallStatus(app) {
  	request('https://usfbullrunner.com/Stop/95548/Arrivals?customerID=3', (error, res1, body) => {

  		bodyJSON = JSON.parse(body);

  		if (!error && res1.statusCode == 200) {
  			if(bodyJSON.length === 0) {
  				app.tell(app.buildRichResponse()
  					.addSimpleResponse(['There aren\'t any active routes right now. ' +
  						'Please check the USF Bull Runner hours of operation, and note that the hours change seasonally.',
  						'The Bull Runner is currently not operating. To see when it will reopen, check the Bull Runner hours of operation.',
  						'All of the routes are closed right now. Check the Bull Runner hours of operation to see when they will reopen.'].random())
  					.addBasicCard(app.buildBasicCard('USF Bull Runner - Hours of Operation')
  						.addButton('View Hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx')
  					)
  				);
  			} else {
  				// Construct an array of active route letters
  				activeRoutes = [];
  				bodyJSON.forEach(activeRoute => {
  					var route = data.routes.find(cacheRoute => cacheRoute.ID == activeRoute.RouteID);
  					activeRoutes.push(route.Letter);
  				});
  				activeRoutes.sort();

  				// If multiple active routes, use plural
  				var plural = (activeRoutes.length == 1) ? {lttr: '', word: 'is'} : {lttr: 's', word: 'are'};

  				//The Bull Runner is currently operating on route{s} {A, B, and C}.
  				var response = app.buildRichResponse()
  					.addSimpleResponse('The Bull Runner is currently operating on route' +
  						plural.lttr + ' ' + activeRoutes.toSpokenList() + '.')
  					.addSuggestionLink('live map', 'http://www.usfbullrunner.com')
  					.addSuggestions(['More info about Route ' + activeRoutes[0], 'What is the closest stop?']);

  				app.ask(response);
  			}
  		} else {
  			app.tell('Sorry, there was an error retrieving information from the Bull Runner. Please try again later.');
  		}
		});
  }

  // Hours of Operation
  // This info can't be fetched dynamically so we don't provide it because it would be outdated
  // Takes no inputs, sets no contexts
  function hoursOperation(app) {
  	var response = app.buildRichResponse()
  		.addSimpleResponse({
  			displayText: 'Because the Bull Runner\'s hours change seasonally, I can\'t provide them myself. ' +
  						'However, the current hours are available on the USF transportation website. ' +
  						'Also, I can tell you which routes are currently operating — just ask!',
  			speech: 
  				'<speak>' +
  					'Because the Bull Runner\'s hours change seasonally, I can\'t provide them myself.' +
  					'However, the current hours are available on the <say-as interpret-as="characters">USF</say-as> transportation website.' +
  					'Also, I can tell you which routes are currently operating <break time="0.5s">— just ask!' +
  				'</speak>'
  		})
  		.addBasicCard(
  			app.buildBasicCard('USF Bull Runner - Hours of Operation')
					.addButton('View Hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx')
			)
			.addSuggestions(['What routes are active?', 'Is Route A active?']);

		app.ask(response);
  }

  // Status of a route
  // Input context selected_route will be used if the doesn't explicitly state a route
  // Output context selected_route will be set if the user explicitly states a route
  // Output context selected_route's timer will be reset if already set and user doesn't state a route
  // Output context -followup used for getting the route name if not provided
  function routeStatus(app) {
  	var routeArg = app.getArgument('route');
  	var routeContext = app.getContext('selected_route');

  	var route = null;
  	// If a route context exists, use it if no route is explictly provided
  	// If a route is explicitly provided, use it and set the context
  	if(routeArg) {
	  	route = data.routes.find(routeObject => routeObject.Letter == routeArg);
	  } else if(routeContext) {
	  	route = routeContext.parameters;
	  }

	  // Either set the context or reset timer if already set
	  app.setContext('selected_route', 3, route);

	  if(route) {
	  	request('https://usfbullrunner.com/Route/' + route.ID + '/Vehicles', (error, res1, body) => {

	  		activeBuses = JSON.parse(body);

				if (!error && res1.statusCode == 200) {
					if(activeBuses.length === 0) {
						app.ask(app.buildRichResponse()
	  					.addSimpleResponse(route.Name + ' isn\'t active right now. Try checking the USF Bull Runner hours of operation to see when it will reopen.')
	  					.addSuggestionLink('hours of operation', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx')
	  					.addSuggestions(['Are any buses running?'])
	  				);

					} else {
						var plural = (activeBuses.length == 1) ? '' : 'es';

						var response = app.buildRichResponse()
							// {Route A} is currently active, with {3} bus{es} operating.
	  					.addSimpleResponse(route.Name + ' is currently active, with ' + activeBuses.length + ' bus' + plural + ' operating.')
	  					.addSuggestions(['What is the closest stop?']);
	  				
	  				app.ask(response);
					}

	  		} else {
	  			app.tell('Sorry, there was an error retrieving information from the Bull Runner. Please try again later.');
	  		}
			});

	  } else {
	  	routeLetters = [];
	  	data.routes.forEach(routeObject => routeLetters.push(routeObject.Letter));

	  	var suggestions = ['Overall system status'];
	  	if (routeLetters.length == 8) {
	  		suggestions = routeLetters;
	  	} else if (routeLetters.length <= 7) {
	  		suggestions = routeLetters.concat(['Overall system status']);
	  	}


	  	var response = app.buildRichResponse()
	  		.addSimpleResponse(
	  			'I can\'t tell which route you would like information about. Available options are: ' +
	  			routeLetters.toSpokenList() +
	  			'. Which one would you like to know about?'
	  		)
	  		.addSuggestions(suggestions)
	  		.addSuggestionLink('route map', 'http://www.usfbullrunner.com');

	  	app.ask(response);
	  }
  }

  // Get permission to access user location to find closest stop
  // Output context request_permission possibly includes route parameter
  function closestStopPermission(app) {
  	var routeArg = app.getArgument('route'),
  			routeContext = app.getContext('selected_route');

  	if(routeArg) {
	  	route = data.routes.find(routeObject => routeObject.Letter == routeArg);
	  	console.log(routeArg);
	  	console.log(route);
	  	//It's possible that the route argument doesn't correspond to a route:
	  	if(route) {
	  		// 5 minutes instead of 3 to give extra time to respond to location prompt
	  		app.setContext('selected_route', 5, route);
	  	}
	  	// Set a source so we can use it to make more tailored responses
	  	app.setContext('context_source', 3, {arg: true, context: false});

	  	console.log('Route Argument');

	  } else if(routeContext) {
	  	route = routeContext.parameters;
	  	app.setContext('selected_route', 3, route);
	  	app.setContext('context_source', 3, {arg: false, context: true});

	  	console.log('Route Context');
	  }

  	app.askForPermission('To find stops near your location', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
  }

  // Get closest stop
  // Follows permission requesting intent
  // Input context request_permission from permission request may include route if user explicitly defined it
  // Input context selected_route may occur if user asked about a route recently, but we ignore it unless explicit
  // Output context selected_route will be set if user explicitly states a route
  // Output context selected_route's timer will be reset if already set and user doesn't state a route
  // Output context selected_stop will be set with closest stop
  function closestStop(app) {
  	var routeContext = app.getContext('selected_route'),
  			allRoutes = app.getArgument('all_routes'),
  			loc = app.getDeviceLocation();

  	// Only continue if permissions were granted and we could get a location
		if (loc) {
		  var route = routeContext ? routeContext.parameters : null;
		  console.log(route);
		  app.setContext('selected_route', 3, route);

		  var closest = data.stops[0];
		  closest.Distance = getDistance(data.stops[0], loc.coordinates);

		  if (route) {
		  	// If a route is specified, we want to avoid that math for stops on other routes
		  	data.stops.forEach(stop => {
		  		if(stop.Routes.includes(route.ID)) {
		  			let distance = getDistance(stop, loc.coordinates);
		  			if(distance < closest.Distance) {
		  				closest = stop;
		  				closest.Distance = distance;
		  			}
		  		}
		  	});
		  } else {
		  	// If not, we have to do the calcs for every stop
		  	data.stops.forEach(stop => {
	  			let distance = getDistance(stop, loc.coordinates);
	  			if(distance < closest.Distance) {
	  				closest = stop;
	  				closest.Distance = distance;
	  			}
		  	});
		  };

		  // Set the stop context for followup questions
		  app.setContext('selected_stop', 3, closest);

		  var response = app.buildRichResponse()
		  	.addSuggestions('When is the next bus?')
		  	.addSuggestionLink('nagivation', getNavURL(closest));

		  if(route) {
		  	// The closest stop on {Route A} is {Communication Sciences} (Stop {222}).
		  	response.addSimpleResponse('The closest stop on ' + route.Name + ' is ' + closest.Name + ' (Stop ' + closest.Number + ').')
		  		.addSuggestions('Include other routes');
		  } else {
		  	// The closest stop to your location is {Communication Sciences} (Stop {222})
		  	var stopInfoResponse = 'OK, the closest stop to your location is ' + closest.Name + ' (Stop ' + closest.Number + ')';

		  	var routeLetters = [];
		  	closest.Routes.forEach(routeNumber => {
		  		routeLetter = data.routes.find(routeObject => routeObject.ID == routeNumber).Letter;
		  		routeLetters.push(routeLetter);
		  	});

		  	if (routeLetters.length == 1) {
		  		// <stopInfoResponse>, on Route {A}.
		  		response.addSimpleResponse(stopInfoResponse + ', on Route ' + routeLetters[0] + '.');
		  	} else {
		  		// <stopInfoResponse>, which connects Routes {A, B, and C}.
		  		response.addSimpleResponse(stopInfoResponse + ', which connects Routes ' + routeLetters.toSpokenList() + '.');
		  	}
		  }

		  app.ask(response);

		} else {
			app.ask('Sorry, I couldn\'t get your location, so I couldn\'t find the closest bus stop. Please try again, or ask about something else.');
		}
  }

  // Next bus(es) at a stop
  // Input argument show_all indicates that the user is asking about all routes
  // Input context selected_route indicated information will only be provided about a previously discussed route
  // Input context selected_stop waives the requirement for a stop parameter and uses a previously discussed stop
  function nextBus(app) {
  	var routeContext = app.getContext('selected_route'),
  			routeArg = app.getArgument('route'),
  			stopContext = app.getContext('selected_stop'),
  			stopArg = app.getArgument('stop'),
  			showAll = app.getArgument('show_all');

  	var stop = null;
   	if(stopArg) {
  		stop = data.stops.find(stopObject => stopObject.Name == stopArg);
  	} else if(stopContext) {
  		stop = stopContext.parameters;
  	}

  	var route = null;
  	// If a route context exists, use it if no route is explictly provided
  	// If a route is explicitly provided, use it and set the context
  	if(routeArg) {
	  	route = data.routes.find(routeObject => routeObject.Letter == routeArg);
	  	//It's possible that the route argument doesn't correspond to a route:
	  	if(route) {
	  		app.setContext('selected_route', 3, route);
	  	}
	  } else if(routeContext) {
	  	route = routeContext.parameters;
	  	app.setContext('selected_route', 3, route);
	  }

	  var response = app.buildRichResponse();

	  if(!stop) {
	  	// If a stop isn't specified by context or by argument
	  	console.log(data.stops.random());
  		response
  			.addSimpleResponse('I can\'t tell which stop you would like to know about. It may help to refer to the stop by its number rather than its name.')
  			.addSuggestions(['What is the closest stop?', 'Are any buses running?', 'Stop ' + data.stops.random().Number]);
  		app.ask(response);

	  } else {
	  	app.setContext('selected_stop', 3, stop);
	  	// If a stop is specified, set its context even if the rest of the function doesn't work

	  	// Build an array of routes serving the stop
	  	stop.Routes.letters = [];
	  	stop.Routes.forEach(routeID => stop.Routes.letters.push(data.routes.find(routeObject => routeObject.ID == routeID).Letter));

	  	if(routeArg && !route) {
		  	// A route is not required, but if they do ask for a specific one and it isn't defined that's a problem
		  	response
	  			.addSimpleResponse('I can\'t tell which route you\'re asking about. Please try again or ask about other routes.')
	  			.addSuggestions(['What about other routes?', 'What is the closest stop?', 'What about Route ' + data.routes.random().Letter + '?']);
	  		app.ask(response);

		  } else if(routeArg && !stop.Routes.includes(route.ID)) {
		  	// A route was specifically asked for but that route doesn't serve this stop
		  	response
	  			.addSimpleResponse('The route you asked about doesn\'t connect with this stop. Try asking about other routes or a different stop.')
	  			.addSuggestions(['What about other routes?', 'Closest stop on route']);
	  		app.ask(response);

	  	} else {
		  	// Now we know that a stop is provided and that either a route is provided or not specified
		  	request('https://usfbullrunner.com/Stop/' + stop.ID + '/Arrivals?customerID=3', (error, res, body) => {
					if (error || res.statusCode !== 200) {
						// Request failed
						app.tell('Sorry, there was a problem retrieving information from the Bull Runner server. Please try again later.');
						console.error(error);
						console.info(res);

					} else {

						var routes = null;
						// There's always a chance the response is malformed:
						try {
							routes = JSON.parse(body);
						} catch(err) {
							console.error(err);
						}

						if(!routes) {
							app.tell('Sorry, there was an issue processing information from the Bull Runner server. Please try again later.');

						} else {
							if (route) route.Arrivals = routes.find(routeObject => route.ID == routeObject.RouteID);
							// Will be falsy if the route asked for is not one of the active routes

							// {Marshall Student Center} (Stop {401})
							var stopPhrase = stop.Name + (stopContext ? '' : ' (Stop ' + stop.Number + ')');

							if(routeArg && !route.Arrivals) {
								// A route was specifically asked for, but it isn't running right now
								response
									.addSimpleResponse('That route isn\'t serving ' + stopPhrase + ' right now. Please check the Bull Runner hours of operation.')
									.addSuggestions(['Are the buses running?', 'Status of Route ' + route.Letter])
									.addSuggestionLink('Bull Runner hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx');
							} else if(routes.length === 0) {
								// Stop is inactive
								response
									.addSimpleResponse('There aren\'t any buses serving ' + stopPhrase + ' right now. Please check the Bull Runner hours of operation.')
									.addSuggestions(['Are the buses running?', 'Status of Route ' + stop.Routes.letters.random()])
									.addSuggestionLink('Bull Runner hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx');

							} else if(routes.length == 1 || (!showAll && (routeArg || (routeContext && route.Arrivals)))) {
								// This is a stop on one route, not a connecting stop
								// OR (the user did NOT specify all routes AND (either a route argument
								// OR (a *valid* route context is provided)))

								// This will trigger if there is an invalid route context and only one route, which is fine
								// because contexts can be safely ignored if they are apparently incorrect

								// Overwrite route, since there's only one possible route
								// NOT WORKING (maybe) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
								if(routes.length == 1) route = data.routes.find(routeObject => routes[0].routeID == routeObject.ID);
								app.setContext('selected_route', 3, route);

								// Time until the next bus, in minutes
								var time = Math.floor(routes[0].Arrivals[0].SecondsToArrival / 60);
								// Sometimes, if a bus is already at the stop the minutes will be 0 or negative. In that case we use the next bus if there is one.
								if (time < 1 && routes[0].Arrivals.length > 1) {
									time = Math.floor(routes[0].Arrivals[1].SecondsToArrival / 60);
								}
								if (time < 0) time = 0;

								time.s = (time == 1) ? '' : 's'; // If multiple or 0 minutes, use plural

								response
									.addSuggestions(['Status of this route', 'Closest stop'])
									.addSuggestionLink('nagivation', getNavURL(stop));


								if(showAll) {
									response.addSimpleResponse('The only route servicing this stop right now is ' + route.Name + '. The next bus on this route will arrive in ' + time + ' minute' + time.s + '.');
								} else if(routeArg || (routeContext && route.Arrivals)) {
									response.addSimpleResponse('The next bus on ' + route.Name + ' will arrive in ' + time + ' minute' + time.s + '.');
								} else {
									response.addSimpleResponse('The next bus will arrive on ' + route.Name + ' in ' + time + ' minute' + time.s + '.');
								}

							} else {
								// There are multiple routes going to this stop (it's a connecting stop) and we want to talk about all of them
								var strings = ['There are ' + routes.length + ' routes serving this stop right now.'];

								// For each route, find the time and add it to the strings
								routes.forEach(stopRoute => {
									//TIme until the next bus, in minutes
									var time = Math.floor(stopRoute.Arrivals[0].SecondsToArrival / 60);
									// Sometimes, if a bus is already there the minutes will be 0 or negative. In that case we use the next bus if there is one.
									if(time < 1 && stopRoute.Arrivals.length > 1) {
										time = Math.floor(stopRoute.Arrivals[1].SecondsToArrival / 60);
									}
									if(time < 0) time = 0;

									time.s = (time == 1) ? '' : 's'; // If multiple or 0 minutes, use plural units

									var routeName = data.routes.find(routeObject => routeObject.ID == stopRoute.RouteID).Name;

									strings.push('On ' + routeName + ', the next bus will arrive in ' + minutes + ' minute' + time.s + '.');
								});

								// Add a transition phrase to the last string if it's a longer list
								if(strings.length > 2) {
									strings[strings.length - 1] = strings[strings.length - 1].replace(/^\S+/g, 'Finally, on');
								}

								response.addSimpleResponse(strings.join(' '))
									.addSuggestions(['Overall system status', 'Closest stop'])
									.addSuggestionLink('navigation', getNavURL(stop));

							}

							app.ask(response);
						}
					} 
			  });
			}
		}
  }

  // Fallback for when we just don't get it
  function fallback(app) {
  	var hasScreen = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
  	var simpleResponse = 'Sorry, I don\'t understand. Try asking about the status of the system, a specific stop, or a specific route.';
  	if(hasScreen) {
  		simpleResponse += ' You can also ask for the closest stop to your location.';
  	}

  	var response = app.buildRichResponse()
  		.addSimpleResponse(simpleResponse)
  		.addSuggestions([
  			'Are any buses running?',
  			'Status of Route ' + data.routes.random().Letter,
  			'Next buses at ' + data.stops.random().Name,
  			'What is the closest stop?'
  		]);

  	app.ask(response);
  }

  var actionMap = new Map([
		['next_bus', nextBus],
		['overall_status', overallStatus],
		['route_status', routeStatus],
		['closest_stop_permission', closestStopPermission],
		['closest_stop', closestStop],
		['hours', hoursOperation],
		['fallback', fallback]
  ]);

	app.handleRequest(actionMap);
};