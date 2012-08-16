(function(){
	var baseLatLng = new google.maps.LatLng(39, -94),
			mapOptions = {
				zoom: 4,
				center: baseLatLng,
				mapTypeId: google.maps.MapTypeId.ROADMAP
			};

	var gmap = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);

	var TF = {
		map:								gmap,
		follows:						[],
		markers:						[],
		locations:					[],
		screenName:					'',
		totalCalls:					0,
		callTimeout:				0,
		receivedCalls:			0,
		calledLocations:		0,
		receivedLocations:	0,

		init : function(screenName){
			this.screenName = screenName;
			this.getFriendIds(this.screenName);
		},

		/*
		* Get your followers ids from the twitter API and send them
		* to the twitterFriends.receiveFollowerIds callback
		* depends on having a global instance of TwitterFriends named twitterFriends
		*/
		getFriendIds: function(screenName){
			var url = 'https://api.twitter.com/1/friends/ids.json?' +
								'cursor=-1&screen_name=' + screenName +
								'&callback=TF.receiveFollowerIds';

				$.ajax({
						url:			url,
						dataType: 'jsonp',
						timeout:	3000
				})
				.error(function(jqXHR, textStatus, errorThrown){
						if(textStatus == 'timeout'){
								$('.twitter-alert').show();
						}
				});
			},

			/*
			* Create an array of arrays, each holding 100 ids of followers
			* this breaks up the requests to we don't have one giant request
			* and send the requests to createUserCallString to be assembled
			*/
			receiveFollowerIds: function(data){
					var chunk = [],
							chunks = [],
							ids = data.ids;
							numIds = data.ids.length;

					this.setMessage(numIds);

					for(var i = 0, l = numIds; i < l; i++){
							chunk.push(ids[i]);
							if(chunk.length === 100){
									chunks.push(chunk);
									chunk = [];
							}
					}
					chunks.push(chunk);

					this.buildCallString(chunks);
			},

			/*
			* Set followers message to update the user on approximate time left
			*/
			setMessage: function(followers){
				var num = followers ? followers : this.follows.length;
				$('.followers').show().html('following ' + num + ' people.');
			},

			/*
			* Assemble strings to make AJAX calls against the Twitter API
			* returns Twitter User data to the receiveCallStringResults callback
			*/
			buildCallString: function(users){
					//create an array of strings to make separate calls the the twitter JSON API
					var calls = [],
							url = 'https://api.twitter.com/1/users/lookup.json?user_id=',
							tmp = url;

					for(var i = 0, l = users.length; i < l; i++){

							for(var j = 0, k = users[i].length; j < k; j++){
									tmp += users[i][j] + ',';
							}

							tmp = tmp.substring(0, tmp.length - 1);
							tmp += '&callback=TF.receiveCalls';
							calls.push(tmp);
							tmp = url;
					}
					//save the total number of call we make the the Twitter API for later use
					this.totalCalls = calls.length;
					this.sendCalls(calls);
			},


			/*
			* Make the AJAX calls
			* returns Twitter User data to the receiveCalls callback
			*/
			sendCalls: function(calls){
				for(var i = 0; i < calls.length; i++){
					$.ajax({
						url: calls[i],
						dataType: 'jsonp'
					});
				}
			},

			/*
			* Push all of the User data returned from Twitter into the follows array
			*/
			receiveCalls: function(data){

				//increment for the number of results we have received
				this.receivedCalls++;
				
				//push the user data into the follows array
				for(var i = 0, l = data.length; i < l; i++){
						this.follows.push(data[i]);
				}
				
				//when we know we have all the data get Geo data for each follower
				if(this.receivedCalls == this.totalCalls){
						this.sendGeoCalls();
				}
			},

			/*
			* Utility function for calling the geoCoder and saving the index
			* this should be refactored or renamed at the least
			*/
			sendGeoCalls: function(){
				for(var i = 0, l = this.follows.length; i < l; i++){
					this.callGeoCoder(this.follows[i].location, i);
				}
			},


			/*
			* Create the call AJAX call strings for the Yahoo! Places API
			*/
			callGeoCoder: function(location, index){
				if(location){
					//remove whitespace and replace with plusses
					location = location.replace(/\s/g, '+');
					var url = 'http://where.yahooapis.com/geocode?location=' +
										location + '&flags=J&appid=dj0yJmk9WGUydmhyQ0' +
										'RtekIxJmQ9WVdrOWRVVlpaMmhvTkdjbWNHbzlNVFUyTn' +
										'pNeU5ERTJNZy0tJnM9Y29uc3VtZXJzZWNyZXQmeD01ZA' +
										'--&callback=receiveGeoCall';

					this.callGetJson(url, location, index);
				}
			},

			/*
			* Finally make calls to the Yahoo! Places API
			* callback sends the Latatitude and Longitude to handleLocations
			*/
			callGetJson: function(url, location, index){
				var self = this;

				this.calledLocations++;
				
				$.ajax({
						url: url
				})
				.error(function(jqXHR, textStatus, errorThrown) {
					console.log("error " + textStatus + " errorThrown" + errorThrown);
					console.log("incoming Text " + jqXHR.responseText);
				})
				.success(function(response){
					var result,
							LatLng,
							i = index,
							person = self.follows[i];

					response = (typeof response == 'string') ? JSON.parse(response) : response;

					self.receivedLocations++;

					if(!response.ResultSet){
						response = self.xmlToJson(response);
					}

					if(response.ResultSet.Found >= 1){
						result = response.ResultSet.Results[0];
					} else {
						return;
					}

					LatLng = new google.maps.LatLng(result.latitude, result.longitude);

					//handle the location information for each person
					self.handleMarkerGroups(LatLng, person);
				});
			},


			/*
			* Implemented this xmlToJson function, just copy-pasted
			* from David Walsh's blog, this is used to fix Yahoo! sending
			* XML even when I request JSON
			*/
			xmlToJson: function(xml){
				// Create the return object
				var obj = {};

				if (xml.nodeType == 1) { // element
					// handle attributes
					if (xml.attributes.length > 0) {
					obj["@attributes"] = {};
						for (var j = 0; j < xml.attributes.length; j++) {
							var attribute = xml.attributes.item(j);
							obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
						}
					}
				} else if (xml.nodeType == 3) { // text
					obj = xml.nodeValue;
				}

				// handle children
				if (xml.hasChildNodes()) {
					for(var i = 0; i < xml.childNodes.length; i++) {
						var item = xml.childNodes.item(i);
						var nodeName = item.nodeName;
						if (typeof(obj[nodeName]) == "undefined") {
							obj[nodeName] = this.xmlToJson(item);
						} else {
							if (typeof(obj[nodeName].length) == "undefined") {
								var old = obj[nodeName];
								obj[nodeName] = [];
								obj[nodeName].push(old);
							}
							obj[nodeName].push(this.xmlToJson(item));
						}
					}
				}
				return obj;
			},

			handleMarkerGroups: function(LatLng, person){
				var marker,
						markup,
						location,
						uniqueLocation = true;

				for(var i = 0, l = this.locations.length; i < l; i++){
					//check if the location coming back is equal to any of the locations we have
					if(_.isEqual(LatLng, this.locations[i].latLng)){
						//if the location is equal push the person into the existing object
						this.locations[i].followers.push(person);
						//recalculate necessary markup and refresh the marker
						this.resetMarkupAndRefresh(this.locations[i]);
						return;
					}
				}

				//create single person markup
				markup = '<div class="single-marker">';
				markup += '<div class="img-container"><img title="' +
									person.name + ' : @' + person.screen_name +
									'" src="' + person.profile_image_url +
									'" alt="'+person.screen_name+'" /></div></div>';

				marker = new RichMarker({
					position:	LatLng,
					map:			gmap,
					shadow:		'',
					content:	markup
				});

				this.markers.push(marker);

				location = {
					marker:			marker,
					latLng:			LatLng,
					followers:	[person]
				};

				this.locations.push(location);
			},

			/*
			* Much cleaner way to dynamically add users to the map
			*/
			resetMarkupAndRefresh: function(location){
				var j,
						top,
						left,
						person,
						tier = 15,
						marker = location.marker,
						followers = location.followers.length,
						width = followers.toString().length * 7,
						markup = '<div class="group-marker">' +
											'<div class="group-amount" style="margin-left:-' +
											width + 'px;">' + followers + '</div><div class="group-img-wrap">';

				if(followers < tier){
					points = this.circlePoints(80, followers, 8, 8);
				} else {
					points = this.circlePoints(80, 15, 8, 8);
				}

				for(var i = 0, l = followers; i < l; i++){
					
					if (i >= 15) {
						points = this.circlePoints(125, followers, 8, 8);
					}
					
					person = location.followers[i];

					top = points[i][0];
					
					left = points[i][1];
					
					markup += '<div style="position:absolute;top:' +
										top + 'px;left:' + left + 'px;" class="img-container">' +
										'<img title="' + person.name + ' : @' + person.screen_name +
										'" src="'+person.profile_image_url+'" alt="'+person.screen_name+'" /></div>';
				}

				markup += '</div></div>';

				marker.content = markup;
				
				marker.setMap(gmap);
				
				//pyramid of DOOOOM
				if(this.followsLeft() < 10){
					twttr.anywhere(function (T) {
						T('.img-container').hovercards({
							username: function(node) {
								return node.alt;
							}
						});
					});
				}
			},

			followsLeft: function(){
				var followsLeft = (this.calledLocations - this.receivedLocations);
				return followsLeft;
			},

			/*
			* Utility function for returning circular points about a center
			*/
			circlePoints: function(radius, steps, centerX, centerY){
				var xValues = [], yValues = [], points = [], tmpX, tmpY;

				for (var i = 0; i < steps; i++) {
					xValues[i] = (centerX + radius * Math.cos(2 * Math.PI * i / steps));

					tmpX = Math.floor(xValues[i]);

					yValues[i] = (centerY + radius * Math.sin(2 * Math.PI * i / steps));

					tmpY = Math.floor(yValues[i]);

					points.push([tmpX, tmpY]);
				}
				return points;
			},

			cleanup: function(){
				this.setFollowersMessage();
				this.followsLeft();
			}
	};

	window.TF = TF;
})();