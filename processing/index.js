// jshint esversion:6

module.exports.processRequest = function(req, cachedData) {
	var messageSent = req.body.result.resolvedQuery;
	var stopName = req.body.result.parameters.stop;

	var stops = cachedData.stops;
	var stopID = stops.find(stop => stop.Name == stopName).ID;

	var response = {
		'speech': 'There was an unknown error with your request.',
		'displayText': 'There was an unknown error with your request.',
		"data": {},
		"contextOut": [],
		"source": "USF Bull Runner"
	};

	if(stopID !== undefined) {
		request('https://usfbullrunner.com/Stop/' + stopID + '/Arrivals?customerID=3', 
		(error, response, body) => {
			bodyJSON = JSON.parse(body);
			if (!error && response.statusCode == 200) {
				if (bodyJSON.length !== 0) {
					response.speech = response.displayText = 'The next bus will arrive soon.';
				} else {
					response.speech = response.displayText = 'It looks like there aren\'t any buses on that route right now.';
				}
			} else {
				response.speech = response.displayText = "There was an error retrieving information.";
			}
		});
	} else {
		response.speech = response.displayText = "Sorry, I couldn't find that stop.";
	}

	return response;
};