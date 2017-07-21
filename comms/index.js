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

module.exports.apiai = function(req, res, data) {
	var app = new ApiAiApp({request: req, response: res});
	var hasScreen =
    app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);

  // Status of the system
  function overallStatus(app) {
  	request('https://usfbullrunner.com/Stop/95548/Arrivals?customerID=3', (error, res1, body) => {

  		bodyJSON = JSON.parse(body);

  		if (!error && res1.statusCode == 200) {
  			if(bodyJSON.length === 0) {
  				app.tell(app.buildRichResponse()
  					.addSimpleResponse('There are not currently any buses running. Please check the USF Bull Runner hours of operation.')
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
  						plural.lttr + ' ' + activeRoutes.toSpokenList() + ' ' + plural.word + ' active.');

  				if(hasScreen) {
  					response.addSimpleResponse('Check out this link for a live map:')
  						.addBasicCard(app.buildBasicCard('USF Bull Runner - Live Map')
	  						.addButton('View Map', 'http://www.usfbullrunner.com')
	  					);
  				}

  				app.tell(response);
  			}
  		} else {
  			app.tell('Sorry, there was an error retrieving information from the Bull Runner.');
  		}
		});
  }

  // Status of a route
  function routeStatus(app) {
  	var routeName = app.getArgument('route');

  	var routeID = data.routes.find(route => route.Name = routeName).ID;

  	request('https://usfbullrunner.com/Route/' + routeID + '/Vehicles', (error, res1, body) => {

  		activeBuses = JSON.parse(body);

			if (!error && res1.statusCode == 200) {
				if(activeBuses.length === 0) {
					app.tell(app.buildRichResponse()
  					.addSimpleResponse('There are not currently any buses on that route. Try checking the USF Bull Runner hours of operation.')
  					.addBasicCard(app.buildBasicCard('USF Bull Runner - Hours of Operation')
  						.addButton('View Hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx')
  					)
  				);

				} else {
					var plural = (activeBuses.length == 1) ? {lttr: '', word: 'is'} : {lttr: 'es', word: 'are'};

					// There {are} currently {3} bus{es} on that route.
					var strings = [
						'<speak>There ' + plural.word + ' currently <say-as interpret-as="cardinal">' +
						activeBuses.length + '</say-as> bus' + plural.lttr + ' on that route.'
					];
					activeBuses.forEach((bus, index) => {
						var string = "";

					});

					var response = app.buildRichResponse()
						// There {are} currently {3} bus{es} on that route.
  					.addSimpleResponse('There ' + plural.word + ' currently ' + activeBuses.length + ' bus' + plural.lttr + ' on that route.');
  				
  				app.tell(response);
				}

  		} else {
  			app.tell('Sorry, there was an error retrieving information from the Bull Runner.');
  		}
		});
  }

  // Get permission to access user location to find closest stop
  // Output context possibly includes route
  function closestStopPermission(app) {
  	app.askForPermission('To find stops near your location', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
  }

  // Get closest stop
  // Follows permission requesting intent
  // Input context request_permission from permission request may include route if user explicitly defined it
  // Input context selected_route may occur if user explicitly asked about a route recently
  // Input context selected_stop is disregarded because we want the closest one (but it is set by this)
  // TODO: Fix contexts in API.AI
  function closestStop(app) {
  	// Has to exist:
  	var permissionContext = app.getContext('request_permission');

  	// Only exists if a route has been asked about recently, otherwise null:
  	var routeContext = app.getContext('selected_route');

  	// Only continue if permissions were granted and we could get a location
		if (app.getDeviceLocation()) {
		  var deviceCoordinates = app.getDeviceLocation().coordinates;

		  var routeGiven = null;
		  // Give the permissionContext priority because it has to be more recent and more explicit
		  if(permissionContext.parameters.route) {
		  	routeGiven = data.routes.find(route => route.Letter == permissionContext.parameters.route);
		  	// Set the route context for the future
		  	app.setContext('selected_route', 3, routeGiven);
		  } else if(routeContext) {
		  	routeGiven = routeContext;
		  }

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
		  	.addSuggestions(['Next buses', 'Connected routes', 'Navigate']);

		  if(routeGiven) {
		  	// The closest stop on {Route A} is Stop {222}, {Communication Sciences}.
		  	response.addSimpleResponse('The closest stop on ' + routeGiven.Name + ' is Stop ' + closest.Number + ', ' + closest.Name + '.');
		  } else {
		  	// The closest stop to your location is Stop {222}, {Communication Sciences}.
		  	response.addSimpleResponse('The closest stop to your location is Stop ' + closest.Number + ', ' + closest.Name + '.');
		  }

		  app.ask(response);

		} else {
			app.ask('Sorry, I couldn\'t get your location, so I couldn\'t find the closest bus stop. Please try again.');
		}
  }

  // Next bus(es) at a stop
  // TODO add selected_stop context for followups
  // TODO: Add a way to request data for all routes in API.AI
  // TODO: Add link to hours when no buses servicing
  function nextBus(app) {
  	var routeContext = app.getContext('selected_route');
  	var stopContext = app.getContext('selected_stop');

  	var stop = null;
  	// If there's no stop context, then an explicit stop argument is required so stop should never be null
  	if(app.getArgument('stop')) {
  		stop = data.stops.find(stop => stop.Name == app.getArgument('stop'));
  		app.setContext('selected_stop', 3, stop);
  	} else if(stopContext) {
  		stop = stopContext;
  	}

  	var routeGiven = null;
  	// If a route context exists, use it if no route is explictly provided
  	// If a route is explicitly provided, use it and set the context
  	if(app.getArgument('route')) {
	  	routeGiven = data.routes.find(route => route.Letter == app.getArgument('route'));
	  	app.setContext('selected_route', 3, routeGiven);
	  } else if(routeContext) {
	  	routeGiven = routeContext;
	  }

  	if(stop) {
  		request('https://usfbullrunner.com/Stop/' + stop.ID + '/Arrivals?customerID=3', 
			(error, res1, body) => {

				bodyJSON = JSON.parse(body);

				if (!error && res1.statusCode == 200) {
					if (bodyJSON.length === 0 || true) {
						let response = app.buildRichResponse()
							.addSimpleResponse('There aren\'t any buses servicing Stop ' + stop.Name + ' (Stop ' + stop.Number + ') right now. Please ensure that that route is currently operating.')
							.addSuggestions('Are the buses running?')
							.addSuggestionLink('Bull Runner Hours', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx');
						app.ask(response);

					} else if(bodyJSON.length === 1 || routeGiven) {	
						// Use the first (only) route if no route given, otherwise use the given route:
						var index = (routeGiven) ? bodyJSON.findIndex(route => route.RouteID == routeGiven.ID) : 0;

						var seconds = bodyJSON[index].Arrivals[0].SecondsToArrival;
						var minutes = Math.floor(seconds / 60);
						var plural = (minutes == 1) ? '' : 's'; // If multiple minutes, use plural units

						var routeName = data.routes.find(route => route.ID == bodyJSON[index].RouteID).Name;

						if(!routeGiven) {
							app.tell('The next bus will arrive on ' + routeName + ' in ' + minutes + ' minute' + plural + '.');
						} else {
							if(routeName == routeGiven.Name) {
								app.tell('The next bus will arrive in ' + minutes + ' minute' + plural + '.');
							} else {
								app.tell('It looks like this stop isn\'t currently being serviced by that route.');
							}
						}

					} else {
						var strings = ['There are ' + bodyJSON.length + ' routes serving this stop right now.'];

						// For each route, find the time and add it to the strings
						bodyJSON.forEach(stopRoute => {
							var seconds = stopRoute.Arrivals[0].SecondsToArrival;
							var minutes = Math.floor(seconds / 60);
							var plural = (minutes == 1) ? '' : 's'; // If multiple minutes, use plural units

							var routeName = data.routes.find(route => route.ID == stopRoute.RouteID).Name;

							strings.push('On ' + routeName + ', the next bus will arrive in ' + minutes + ' minute' + plural + '.');
						});

						// Add a transition phrase to the last string
						strings[strings.length - 1] = strings[strings.length - 1].replace(/^\S+/g, 'Finally, on');

						app.tell(strings.join(' '));
					}

				} else {
					app.tell('Sorry, there was an error retrieving information from the Bull Runner. Please try again later.');
				}
			});

  	} else {
  		let response = app.buildRichResponse()
  			.addSimpleResponse('Sorry, I couldn\'t find the stop you requested. It may help to refer to the stop by its number instead of its name.')
  			.addSuggestions('What is the closest stop?');
  		app.ask(response);
  	}
  }

  function stopInfo(app) {
  	var context = app.getContext('selected_stop');
  }

  var actionMap = new Map();
  actionMap.set('give_time', nextBus);
  actionMap.set('overall_status', overallStatus);
  actionMap.set('closest_stop_permission', closestStopPermission);
  actionMap.set('closest_stop', closestStop);
  actionMap.set('stop_info', stopInfo);

	app.handleRequest(actionMap);
};