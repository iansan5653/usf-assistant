// jshint esversion:6

var request = require('request');
var fs = require('file-system');

var routes = require('./routes.json');
var stops = require('./stops.json');

module.exports.update = {};
module.exports.data = {
	'routes': routes,
	'stops': stops
};

module.exports.update.routes = function() {
	var routesNew = [];
	request('https://usfbullrunner.com/Region/0/Routes', 
	(error, response, body) => {
		//TODO add error handling
		bodyJSON = JSON.parse(body);

		bodyJSON.forEach(route => {
			var routeObject = {
				'ID': route.ID,
				'Name': route.Name,
				'SortName': route.DisplayName,
				'Letter': route.ShortName
			};
			routesNew.push(routeObject);
		});
		fs.writeFile('./cache/routes.json',
		JSON.stringify(routesNew, null, 2), err => {
			if (err) return console.log('File update failed: ' + err);
		});
		routes = module.exports.data.routes = routesNew;
	});
};

module.exports.update.stops = function() {
	var stopsRaw = [];

	function getRouteFile(num = 0) {
		if(num < routes.length) {
			request('https://usfbullrunner.com/Route/' + routes[num].ID + '/Direction/0/Stops',
			(error, response, body) => {
				// TODO add error handling
				var routeObject = {
					'ID': routes[num].ID,
					'Data': JSON.parse(body)
				};
				stopsRaw.push(routeObject);
				console.log(num);
				num++;
				// Recursive callback:
				getRouteFile(num);
			});
		} else {
			var stopsNew = [];
			stopsRaw.forEach(stops => {
				stops.Data.forEach(stop => {
					var stopDuplicateIndex = stopsNew.findIndex(stopDuplicate => stop.ID == stopDuplicate.ID);

					if(stopDuplicateIndex == -1) {
						var stopObject = {
							'Name': stop.Name,
							'ID': stop.ID,
							'Number': stop.RtpiNumber,
							'Latitude': stop.Latitude,
							'Longitude': stop.Longitude,
							'Routes': [stops.ID]
						};
						stopsNew.push(stopObject);
					} else {
						stopsNew[stopDuplicateIndex].Routes.push(stops.ID);
					}
				});
			});
			fs.writeFile('./cache/stops.json', 
			JSON.stringify(stopsNew, null, 2), err => {
				if (err) return console.log('File update failed:' + err);
			});
			stops = module.exports.data.routes = stopsNew;
		}
	}
	getRouteFile();
};