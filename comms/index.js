// jshint esversion:6
process.env.DEBUG = 'actions-on-google:*';
var request = require('request');
var ApiAiApp = require('actions-on-google').ApiAiApp;

function getDistance(cachedStop, currentLoc) {
	var delta = {
		lat: cachedStop.Latitude - currentLoc.latitude,
		lon: cachedStop.Longitude - currentLoc.longitude
	};
	// Average longitude in radians
	var aveLonRad = ((cachedStop.Longitude + currentLoc.Longitude) / 2) * 180 / Math.PI;
	var distance = Math.sqrt(Math.pow(delta.lat, 2) + Math.pow(Math.cos(aveLonRad), 2) * delta.lon);
}

module.exports.apiai = function(req, res, data) {
	var app = new ApiAiApp({request: req, response: res});
	var hasScreen =
    app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);

  // Next bus(es) at a stop
  function nextBus(app) {
  	var stop = data.stops.find(stop => stop.Name == app.getArgument('stop'));
  	if(app.getArgument('route')) {
	  	var routeGiven = data.routes.find(route => route.Letter == app.getArgument('route'));
	  }

  	if(stop !== undefined) {
  		request('https://usfbullrunner.com/Stop/' + stop.ID + '/Arrivals?customerID=3', 
			(error, res1, body) => {

				bodyJSON = JSON.parse(body);

				if (!error && res1.statusCode == 200) {
					if (bodyJSON.length === 0) {
						app.tell('It looks like there aren\'t any buses servicing that stop right now.');

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
					app.tell('Sorry, there was an error retrieving information from the Bull Runner.');
				}
			});

  	} else {
  		app.tell('Sorry, I couldn\'t find that stop.');
  	}
  }

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
  // Input context possibly includes route
  function closestStop(app) {
  	var context = app.getContext('request_permission');
  	console.log('HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH');
  	// Testing if null includes if the location couldn't be found and permissions were granted
		if (app.getDeviceLocation() !== null) {
		  var deviceCoordinates = app.getDeviceLocation().coordinates;
		  if(context.parameters[route]) {
		  	var routeGiven = data.routes.find(route => route.Name == context.parameters[route]);
		  }

		  var closest = data.stops[0];
		  closest.Distance = getDistance(data.stops[0], deviceCoordinates);

		  data.stops.forEach(stop => {
		  	// If a route is specified, we want to avoid that slow math for stops on other routes
		  	if(context.parameters[route]) {
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

		  app.ask('The closest stop to your current location is Stop ' + closest.Number + ', also known as ' + closest.Name +
		  	'. Would you like more information about this stop?');
		} else {
			app.tell('Sorry, I couldn\'t get your location, so I couldn\'t find the closest bus stop.');
		}
  }

  var actionMap = new Map();
  actionMap.set('give_time', nextBus);
  actionMap.set('overall_status', overallStatus);
  actionMap.set('closest_stop_permission', closestStopPermission);
  actionMap.set('closest_stop', closestStop);

	app.handleRequest(actionMap);
};