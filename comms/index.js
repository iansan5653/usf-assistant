// jshint esversion:6
process.env.DEBUG = 'actions-on-google:*';
var request = require('request');
var ApiAiApp = require('actions-on-google').ApiAiApp;

module.exports.apiai = function(req, res, data) {
	var app = new ApiAiApp({request: req, response: res});

  function nextBus(app) {
  	var stop = data.stops.find(stop => stop.Name == app.getArgument('stop'));
  	if(stop !== undefined) {
  		request('https://usfbullrunner.com/Stop/' + stop.ID + '/Arrivals?customerID=3', 
			(error, res1, body) => {
				bodyJSON = JSON.parse(body);
				if (!error && res1.statusCode == 200) {
					if (bodyJSON.length === 0) {
						app.tell('It looks like there aren\'t any buses on that route right now.');

					} else if(bodyJSON.length === 1) {	
						var seconds = bodyJSON[0].Arrivals[0].SecondsToArrival;
						var minutes = Math.floor(seconds / 60);
						var plural = (minutes == 1) ? '' : 's';

						var routeName = data.routes.find(route => route.ID == bodyJSON[0].RouteID).Name;

						app.tell('The next bus will arrive on ' + routeName + ' in ' + minutes + ' minute' + plural + '.');

					} else {
						var strings = ['There are ' + bodyJSON.length + ' routes serving this stop right now.'];
						bodyJSON.forEach(stopRoute => {
							var seconds = stopRoute.Arrivals[0].SecondsToArrival;
							var minutes = Math.floor(seconds / 60);
							var plural = (minutes == 1) ? '' : 's';

							var routeName = data.routes.find(route => route.ID == stopRoute.RouteID).Name;

							strings.push('On ' + routeName + ', the next bus will arrive in ' + minutes + ' minute' + plural + '.');
						});
						strings[strings.length - 1] = strings[strings.length - 1].replace(/^\S+/g, 'Finally, on');
						app.tell(strings.join(' '));
					}
				} else {
					app.tell('There was an error retrieving information.');
				}
			});
  	} else {
  		app.tell('Sorry, I couldn\'t find that stop.');
  	}
  }

  var actionMap = new Map();
  actionMap.set('give_time', nextBus);

	app.handleRequest(actionMap);
};