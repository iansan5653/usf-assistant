// jshint esversion:6

var request = require('request');

module.exports.update = {};

module.exports.update.routes = function(cachedData, key) {
	// TODO: Combine entity updating into a single function

	// Clear current newEntries
	request( {
			url: 'https://api.api.ai/v1/entities/route',
			headers: {
				'authorization': 'Bearer ' + key
			}
		}, (error0, response0, body0) => {
			if (!error0 && response0.statusCode == 200) {

				bodyJSON = JSON.parse(body0);
				entryNames = [];
				bodyJSON.entries.forEach(entry => entryNames.push(entry.value));

				var entryNamesString = '["' + entryNames.join('","') + '"]';
				console.log(entryNamesString);

				request(
					{
						method: 'DELETE',
						url: 'https://api.api.ai/v1/entities/route/entries',
						headers: {
							'authorization': 'Bearer ' + key
						},
						body: entryNamesString
					}, 
					(error1, response1, body1) => {
						if (!error1 && response1.statusCode == 200) {
							console.log("Deleted entries succesfully.");

							var newEntries = [];
							var routes = cachedData.routes;

							routes.forEach(route => {
								var synonyms = [];
								var routeNameValid = route.Name.replace(/\(|\)|\[|\]/g, '');
								// Remove parentheses 
								// (brackets are not supported in the entity synonym entries)
								synonyms.pushIfNew(routeNameValid);
								// Remove surrounding whitespace
								synonyms.pushIfNew(routeNameValid.trim());
								// Remove '/'
								synonyms.pushIfNew(routeNameValid.replace(/\//g, '').trim());
								// Replace any '-' with ' '
								synonyms.pushIfNew(routeNameValid.replace(/-/g, ' ').trim());
								// Replace any '&' with 'and'
								synonyms.pushIfNew(routeNameValid.replace(/&/g, 'and').trim());
								// Remove any acronyms (ALL CAPS)
								synonyms.pushIfNew(routeNameValid.replace(/\b[A-Z]{3,}\b/, '').trim());
								// Remove any parenthetical phrases
								synonyms.pushIfNew(route.Name.replace(/ *\([^)]*\) */g, "").trim());

								var routeEntry = {
									'value': route.Name,
									'synonyms': synonyms
								};
								newEntries.push(routeEntry);
							});
							console.log(JSON.stringify(newEntries));
							
							request(
								{
									method: 'POST',
									url: 'https://api.api.ai/v1/entities/route/entries',
									headers: {
										'authorization': 'Bearer ' + key
									},
									body: JSON.stringify(newEntries)
								},
								(error2, response2, body2) => {
									if (!error2 && response2.statusCode == 200) {
										console.log('Added succesfully.');
									} else {
										console.log("There was an error adding entities: " + response2.statusCode);
									}
								}
							);
						} else {
							console.log("There was an error deleting entities: " + response1.statusCode);
						}
					}
				);
			} else {
				console.log("There was an error retrieving entities: " + response0.statusCode);
			}
		}
	);
};

module.exports.update.stops = function(cachedData, key) {
		// Clear current new_entries
		request( {
				url: 'https://api.api.ai/v1/entities/stop',
				headers: {
					'authorization': 'Bearer ' + key
				}
			}, (error0, response0, body0) => {
				if (!error0 && response0.statusCode == 200) {

					bodyJSON = JSON.parse(body0);
					entryNames = [];
					bodyJSON.entries.forEach(entry => entryNames.push(entry.value));

					var entryNamesString = '["' + entryNames.join('","') + '"]';
					console.log(entryNamesString);
					
					request(
						{
							method: 'DELETE',
							url: 'https://api.api.ai/v1/entities/stop/entries',
							headers: {
								'authorization': 'Bearer ' + key
							},
							body: entryNamesString
						}, 
						(error1, response1, body1) => {
							if (!error1 && response1.statusCode == 200) {
								console.log("Deleted succesfully.");

								var newEntries = [];
								var stops = cachedData.stops;

								stops.forEach(stop => {
									var synonyms = [];
									var stopNameValid = stop.Name.replace(/\(|\)|\[|\]/g, '');
									// Remove parentheses 
									// (brackets are not supported in the entity synonym entries)
									synonyms.pushIfNew(stopNameValid);
									// Remove surrounding whitespace
									synonyms.pushIfNew(stopNameValid.trim());
									// Remove '/'
									synonyms.pushIfNew(stopNameValid.replace(/\//g, '').trim());
									// Replace any '-' with ' '
									synonyms.pushIfNew(stopNameValid.replace(/-/g, ' ').trim());
									// Replace any '&' with 'and'
									synonyms.pushIfNew(stopNameValid.replace(/&/g, 'and').trim());
									// Remove any acronyms (ALL CAPS)
									synonyms.pushIfNew(stopNameValid.replace(/\b[A-Z]{3,}\b\b/, '').trim());
									// Remove any parenthetical phrases
									synonyms.pushIfNew(stop.Name.replace(/ *\([^)]*\) */g, "").trim());
									// Allow reference by stop number
									synonyms.pushIfNew("Stop " + stop.Number);

									var stopEntry = {
										'value': stop.Name,
										'synonyms': synonyms
									};
									newEntries.push(stopEntry);
								});
								console.log(JSON.stringify(newEntries));
								
								request(
									{
										method: 'POST',
										url: 'https://api.api.ai/v1/entities/stop/entries',
										headers: {
											'authorization': 'Bearer ' + key
										},
										body: JSON.stringify(newEntries)
									},
									(error2, response2, body2) => {
										if (!error2 && response2.statusCode == 200) {
											console.log('Added succesfully.');
										} else {
											console.log("There was an error adding entities: " + response2.statusCode);
										}
									}
								);

							} else {
								console.log("There was an error deleting entities: " + response1.statusCode);
							}
						}
					);

				} else {
					console.log("There was an error retrieving entities: " + response0.statusCode);
				}
			}
		);
};