var request = require('request');
var fs = require('file-system');

module.exports.routes = function() {
	console.log('wtf');
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
		fs.writeFile('./cache/routes.json',
		JSON.stringify(routesNew, null, 2), function (err) {
			if (err) return console.log('File update failed: ' + err);
		});
	});
};

module.exports.stops = function() {
	var stopsRaw = [];
	var routes = require('./routes.json');

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
				// Recursive callback:
				getRouteFile(num);
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
			fs.writeFile('./cache/stops.json', 
			JSON.stringify(stopsNew, null, 2), function (err) {
				if (err) return console.log('File update failed:' + err);
			});
			console.log('File updated.')
		}
	}
	getRouteFile();
};