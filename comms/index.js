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
  					.addSimpleResponse('There aren\'t any active routes right now.' +
  						'Please check the USF Bull Runner hours of operation, and remember that the hours change seasonally.')
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

  				//The Bull Runner is currently operating. Route{s} {A, B, and C} {are} active.
  				var response = app.buildRichResponse()
  					.addSimpleResponse('The Bull Runner is currently operating. Route' + 
  						plural.lttr + ' ' + activeRoutes.toSpokenList() + ' ' + plural.word + ' active.')
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
  		.addSimpleResponse('Because the Bull Runner\'s hours change seasonally, I can\'t provide them. ' +
  			'However, the current hours are available on the USF transportation website. ' +
  			'Also, I can tell you which routes are currently operating - just ask!')
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
	  					.addSimpleResponse('There aren\'t any buses on ' + route.Name + ' right now. Try checking the USF Bull Runner hours of operation.')
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
  	// Has to exist:
  	var permissionContext = app.getContext('request_permission');

  	// Only exists if a route has been asked about recently, otherwise null:
  	var routeContext = app.getContext('selected_route');

  	// Only exists if the user explicitly asked about all routes
  	var allRoutes = app.getArgument('all_routes');

  	// Only continue if permissions were granted and we could get a location
		if (app.getDeviceLocation()) {
		  var deviceCoordinates = app.getDeviceLocation().coordinates;

		  var routeGiven = null;
		  // Give the argument priority because it has to be more recent and more explicit
		  if(!allRoutes) {
			  if(permissionContext.parameters.route) {
			  	routeGiven = data.routes.find(route => route.Letter == permissionContext.parameters.route);
			  	// Set the route context for the future
			  } else if(routeContext) {
			  	routeGiven = routeContext.parameters;
			  }
			}
		  app.setContext('selected_route', 3, routeGiven);

		  var closest = data.stops[0];
		  closest.Distance = getDistance(data.stops[0], deviceCoordinates);

		  data.stops.forEach(stop => {
		  	// If a route is specified, we want to avoid that math for stops on other routes
		  	if(routeGiven) {
		  		if(stop.Routes.includes(routeGiven.ID)) {
		  			let distance = getDistance(stop, deviceCoordinates);
		  			if(distance < closest.Distance) {
		  				closest = stop;
		  				closest.Distance = distance;
		  			}
		  		}
		  	// If not, we have to do the calcs for every stop
		  	} else {
	  			let distance = getDistance(stop, deviceCoordinates);
	  			if(distance < closest.Distance) {
	  				closest = stop;
	  				closest.Distance = distance;
	  			}
		  	}
		  });

		  // Set the stop context for followup questions
		  app.setContext('selected_stop', 3, closest);

		  var response = app.buildRichResponse()
		  	.addSuggestions('When is the next bus?')
		  	.addSuggestionLink('nagivation', getNavURL(closest));

		  if(routeGiven) {
		  	// The closest stop on {Route A} is Stop {222}, {Communication Sciences}.
		  	response.addSimpleResponse('The closest stop on ' + routeGiven.Name + ' is Stop ' + closest.Number + ', ' + closest.Name + '.')
		  		.addSuggestions('Include other routes');
		  } else {
		  	// The closest stop to your location is Stop {222}, {Communication Sciences}, on {Route A}.
		  	response.addSimpleResponse('OK, the closest stop to your location is Stop ' + closest.Number + ', ' + closest.Name + ', on ' + routeGiven.Name + '.');
		  }

		  app.ask(response);

		} else {
			app.ask('Sorry, I couldn\'t get your location, so I couldn\'t find the closest bus stop. Please try again, or ask about something else.');
		}
  }

  // Next bus(es) at a stop
  // Input context how_all simply indicates that this function was called within the last minute and the user is asking about all routes
  // Input context selected_route indicated information will only be provided about a previously discussed route
  // Input context selected_stop waives the requirement for a stop parameter and uses a previously discussed stop
  function nextBus(app) {
  	var routeContext = app.getContext('selected_route');
  	var routeArg = app.getArgument('route');
  	var stopContext = app.getContext('selected_stop');
  	console.log(stopContext);
  	var stopArg = app.getArgument('stop');

  	// If we provide one route's info and the user explicitly wants them all, give it to them as a followup
  	var showAll = app.getArgument('show_all');

  	var stop = null;
  	// If there's no stop context, then an explicit stop argument is required so stop should never be null
  	if(stopArg) {
  		stop = data.stops.find(stop => stop.Name == stopArg);
  		app.setContext('selected_stop', 3, stop);
  	} else if(stopContext) {
  		stop = stopContext.parameters;
  	}

  	var routeGiven = null;
  	// If a route context exists, use it if no route is explictly provided
  	// If a route is explicitly provided, use it and set the context
  	if(routeArg) {
	  	routeGiven = data.routes.find(route => route.Letter == routeArg);
	  	app.setContext('selected_route', 3, routeGiven);
	  } else if(routeContext) {
	  	routeGiven = routeContext.parameters;
	  }

  	if(stop) {
  		request('https://usfbullrunner.com/Stop/' + stop.ID + '/Arrivals?customerID=3', 
			(error, res1, body) => {

				bodyJSON = JSON.parse(body);

				if (!error && res1.statusCode == 200) {
					if (bodyJSON.length === 0) {
						let response = app.buildRichResponse()
							.addSimpleResponse('There aren\'t any buses servicing ' + stop.Name + ' (Stop ' + stop.Number + ') right now. Please ensure that that route is currently operating.')
							.addSuggestions(['Are the buses running?'])
							.addSuggestionLink('Bull Runner hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx');
						app.ask(response);

					} else if(bodyJSON.length === 1 || (routeArg) || (routeContext && !showAll)) {	
						// If only one route is servicing the stop, or if there is a route given, or if there is a route context and NOT a show all context

						// Use the first (only) route if no route given, otherwise use the given route:
						var index = (routeGiven) ? bodyJSON.findIndex(route => route.RouteID == routeGiven.ID) : 0;

						var seconds = bodyJSON[index].Arrivals[0].SecondsToArrival;
						var minutes = Math.floor(seconds / 60);
						
						// Sometimes, if a bus is already there the minutes will be 0 or negative. In that case we use the next bus if there is one.
						if (minutes < 1 && bodyJSON[index].Arrivals.length > 1) {
							seconds = bodyJSON[index].Arrivals[1].SecondsToArrival;
							minutes = Math.floor(seconds / 60);
						} else if (minutes < 0) {
							// Even if there are no other buses on the route, it never makes since to say a bus will arrive in -N minutes
							minutes = 0;
						}

						var plural = (minutes == 1) ? '' : 's'; // If multiple minutes, use plural units

						var routeName = data.routes.find(route => route.ID == bodyJSON[index].RouteID).Name;

						let response = app.buildRichResponse();

						if(!routeGiven) {
							// THe next bus will arrive on {Route A} in {10} minute{s}.
							response.addSimpleResponse('The next bus will arrive on ' + routeName + ' in ' + minutes + ' minute' + plural + '.')
								.addSuggestionLink('navigation', getNavURL(stop))
								.addSuggestions(['Status of this route']);
						} else {
							if(routeName == routeGiven.Name) {
								// The next bus on {Route A} will arrive at {Communication Sciences} ({Stop 222}) in {10} minute{s}.
								response.addSimpleResponse('The next bus on ' + routeName + ' will arrive at ' + stop.Name + ' (Stop ' + stop.Number + ') in ' + minutes + ' minute' + plural + '.')
									.addSuggestionLink('navigation', getNavURL(stop))
									.addSuggestions(['What about other routes?', 'Status of this route']);
							} else {
								// {Route A} isn't currently servicing {Communication Sciences} ({Stop 222}). Please ensure that that route connects with this stop and that both are currently operating.
								response.addSimpleResponse(routeName + ' isn\'t currently servicing' + stop.Name + ' (Stop ' + stop.Number + '). Please ensure that that route connects with this stop and that both are currently operating.')
									.addSuggestions(['What about other routes?', 'Are the buses running?', 'Status of this route'])
									.addSuggestionLink('Bull Runner hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx');									
							}
						}

						app.ask(response);

					} else {
						var strings = ['There are ' + bodyJSON.length + ' routes serving this stop right now.'];

						// For each route, find the time and add it to the strings
						bodyJSON.forEach(stopRoute => {
							var seconds = stopRoute.Arrivals[0].SecondsToArrival;
							var minutes = Math.floor(seconds / 60);

							// Sometimes, if a bus is already there the minutes will be 0 or negative. In that case we use the next bus if there is one.
							if(minutes < 1 && stopRoute.Arrivals.length > 1) {
								seconds = stopRoute.Arrivals[1].SecondsToArrival;
								minutes = Math.floor(seconds / 60);
							}

							var plural = (minutes == 1) ? '' : 's'; // If multiple minutes, use plural units

							var routeName = data.routes.find(route => route.ID == stopRoute.RouteID).Name;

							strings.push('On ' + routeName + ', the next bus will arrive in ' + minutes + ' minute' + plural + '.');
						});

						// Add a transition phrase to the last string if it's a longer list
						if(strings.length > 2) {
							strings[strings.length - 1] = strings[strings.length - 1].replace(/^\S+/g, 'Finally, on');
						}

						let response = app.buildRichResponse()
							.addSimpleResponse(strings.join(' '))
							.addSuggestionLink('navigation', getNavURL(stop));

						app.ask(response);
					}

				} else {
					app.tell('Sorry, there was an error retrieving information from the Bull Runner. Please try again later.');
				}
			});

  	} else {
  		let response = app.buildRichResponse()
  			.addSimpleResponse('I can\'t tell which stop you would like information about. It may help to refer to the stop by its number rather than its name.')
  			.addSuggestions(['What is the closest stop?', 'Are any buses running?', 'Stop ' + data.stops.random().Number]);
  		app.ask(response);
  	}
  }

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