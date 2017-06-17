// jshint esversion:6
process.env.DEBUG = 'actions-on-google:*';
var request = require('request');
var ApiAiApp = require('actions-on-google').ApiAiApp;

module.exports.apiai = function(req, res, data) {
	var app = new ApiAiApp({request: req, response: res});

  function nextBus(app) {
  	var stop = data.stops.find(stop => stop.Name == app.getArgument('stop'));
  	if(app.getArgument('route')) {
	  	var routeGiven = data.routes.find(route => route.Name == app.getArgument('route'));
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
						var index = (routeGiven) ? 0 : bodyJSON.findIndex(route => route.ID == routeGiven.ID);

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

  function overallStatus(app) {
  	request('https://usfbullrunner.com/Region/0/Routes', (error, res1, body) => {

  		bodyJSON = JSON.parse(body);

  		if (!error && res1.statusCode == 200) {
  			var activeRoutes = bodyJSON.filter(route => route.NumberOfVehicles !== 0);
  			if(activeRoutes.length === 0) {
  				app.tell(app.buildRichResponse()
  					.addSimpleResponse('There are not currently any buses running right now. Please check the USF Bull Runner hours of operation.')
  					.addBasicCard(app.buildBasicCard('USF Bull Runner - Hours of Operation')
  						.addButton('More Information', 'http://www.usf.edu/administrative-services/parking/transportation/hours-of-operation.aspx')
  					)
  				);
  			} else {
  				// Construct an array of active route letters
  				activeRoutes.letters = [];
  				activeRoutes.forEach(activeRoute => {
  					var route = data.routes.find(cacheRoute => cacheRoute.ID == activeRoute.ID);
  					activeRoutes.letters.push(route.Letter);
  				});

  				// If multiple active routes, use plural
  				var plural = (activeRoutes.length == 1) ? {lttr: '', word: 'is'} : {lttr: 's', word: 'are'};

  				//The Bull Runner is currently operating. Route{s} {A, B, and C} {are} active.
  				app.tell('The Bull Runner is currently operating. Route' + 
  					plural.lttr + ' ' + activeRoutes.letters.toSpokenList() + ' ' + plural.word + ' active.');
  			}
  		} else {
  			app.tell('Sorry, there was an error retrieving information from the Bull Runner.');
  		}
		});
  }

  var actionMap = new Map();
  actionMap.set('give_time', nextBus);
  actionMap.set('overall_status', overallStatus);

	app.handleRequest(actionMap);
};