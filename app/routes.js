// app/routes.js

var Message = require('../app/models/message');
var User = require('../app/models/user');
var crypto = require('crypto');
var ltx = require('ltx');
var Client = require('../index.js');
var request = require('request');

clientlist = {};

module.exports = function(app, passport) {

	// =====================================
	// ADD NICKNAME REQUEST ================
	// =====================================
	
	app.post('/addnickname', isLoggedIn, function(req, res) {
		console.log("New Nickname Request. Was " + JSON.stringify(req.body));
		var nicknamelist = req.body.nicknames.split(",");
		User.findOne({'facebook.id' : req.body.id}, function(err, doc) {

			if (doc) {
				doc.facebook.nicknames = nicknamelist;
				console.log("BEFORE: " + JSON.stringify(doc.facebook.nicknames));
				doc.save();
				console.log("AFTER: " + JSON.stringify(doc.facebook.nicknames));
				res.send("Successful nickname add.");
			}
			else {
				console.log("User not found.");
				res.send(5, "User not found.");
			}
		});
	});

  // =====================================
	// SEND MESSAGE REQUEST ================
	// =====================================
	
	app.post('/sendmessage', isLoggedIn, function(req, res) {
		console.log("New Send Message Request. Was " + JSON.stringify(req.body));
		if (clientlist[req.body.id]) {
			console.log("Connection found.");

			var chat = new ltx.Element('message', { to: '-' + req.body.recipient + '@chat.facebook.com' })
					.c('body')
					.t(req.body.message);
			clientlist[req.body.id].send(chat);


		  res.send("Success!");


		}
		else {
			console.log("ID not found!");
			res.send(5, "ID not found.");
		}


	});


	// =====================================
	// SERVER SIDE CONNECTION REQUEST ======
	// =====================================
	
	app.post('/addserverconnection', isLoggedIn, function(req, res) {
		console.log("New Server Connection Request. Was " + JSON.stringify(req.body));
		var insertid = req.body.id;
		var longtoken = req.body.token;

		if (! clientlist[insertid] || clientlist[insertid].state !== 5) {
			console.log("Connection not found. Making!");

			//get long-term access token
			
			request({
				uri: "https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=321198970642&client_secret=7f6d582b099dc065d4b7c75c227d5f33&fb_exchange_token=" + req.body.token,
				method: "GET",
				timeout: 10000,
				followRedirect: true,
				maxRedirects: 10
			}, function(error, response, body) {
				console.log(body.substring(body.indexOf("=") + 1, body.indexOf("&")));
				longtoken = body.substring(body.indexOf("=") + 1, body.indexOf("&"));


			var client = new Client({
				jid: '-' + insertid + "@chat.facebook.com",
				api_key: '321198970642',
				secret_key: '7f6d582b099dc065d4b7c75c227d5f33',
				access_token: longtoken
			});

			client.on("error", function() {
				console.log("ERROR");
			});

			client.on('stanza', function(stanza) {
				if (stanza.is('message') &&
					(stanza.attrs.type !== 'error')) {
						// Get id from received message
						var fromID = stanza.attrs.from.substring(1, stanza.attrs.from.indexOf("@"));
						var messageBody = stanza.getChildText('body');

						if (! messageBody) {
							return;
						}

						console.log("MESSAGE RECEIVED FROM ID: " + fromID);

							User.findOne({'facebook.id' : client.jid.user.substring(1)}, function(err, doc) {
								if (doc) {
									var nicknames = doc.facebook.nicknames;
									nicknames.sort(function(a, b) {
										return b.length - a.length;
									});
									for (var i = 0; i < doc.facebook.pairList.length; i++) {
										if (doc.facebook.pairList[i].sender == fromID) {
											//sending message
											stanza.attrs.to = "-" + doc.facebook.pairList[i].receiver + "@chat.facebook.com";
											delete stanza.attrs.from
								      var redacted = messageBody;

											request({
												uri: "https://graph.facebook.com/" + doc.facebook.pairList[i].receiver,
												method: "GET",
												timeout: 10000,
												followRedirect: true,
												maxRedirects: 10
											}, function(error, response, body) {
																			for (var j = 0; j < nicknames.length; j++) {
												redacted = redacted.replace(new RegExp('(\\b' + nicknames[j] + '\\b)', 'gi'), JSON.parse(body)["first_name"]);
																			}
																			var reply = new ltx.Element('message', {
																				to: "-" + doc.facebook.pairList[i].receiver + "@chat.facebook.com",
																				type: 'chat',
																			});
																			console.log("REDACTED: " + redacted);
																			reply.c('body').t(redacted);
																			client.send(reply);
											});

											var pair = doc.facebook.pairList[i].sender + "|" + doc.facebook.pairList[i].receiver + "|" + client.jid.user.substring(1); //combo of people to hash
											var d = new Date();
											var timestamp = "" + d; //timestamp of the message
											var md5sum = crypto.createHash('md5');
											var ucid = md5sum.update(pair).digest('hex');
											
											Message.findOne({'ucid' : ucid}, function(err, msg) {
												if (msg) {
													console.log("Chat record found! ucid=" + ucid);
													console.log("BEFORE: " + JSON.stringify(msg.messages));
													msg.messages.push({author:"SENDER", timestamp:timestamp, message:messageBody});
													console.log("AFTER: " + JSON.stringify(msg.messages));
													msg.save();
												}
												else {
													console.log("Chat record not found. Creating... ucid=" + ucid);
													var newMessage = new Message(
														{
															ucid: ucid,
															messages: [
																{
																	author: "SENDER",
																	timestamp: timestamp,
																	message: message
																}
															]
														});


													newMessage.save(function(err, result) {
														if (err) return console.error(err);
													});
											
												}


											
											});

											break;
										}
										else if (doc.facebook.pairList[i].receiver == fromID) {
											//sending message
											stanza.attrs.to = "-" + doc.facebook.pairList[i].sender + "@chat.facebook.com";
											delete stanza.attrs.from
								      var redacted = messageBody;

											request({
												uri: "https://graph.facebook.com/" + doc.facebook.pairList[i].sender,
												method: "GET",
												timeout: 10000,
												followRedirect: true,
												maxRedirects: 10
											}, function(error, response, body) {
																			for (var j = 0; j < nicknames.length; j++) {
												redacted = redacted.replace(new RegExp('(\\b' + nicknames[j] + '\\b)', 'gi'), JSON.parse(body)["first_name"]);
																			}
																			var reply = new ltx.Element('message', {
																				to: "-" + doc.facebook.pairList[i].sender + "@chat.facebook.com",
																				type: 'chat',
																			});
																			console.log("REDACTED: " + redacted);
																			reply.c('body').t(redacted);
																			client.send(reply);
											});

											var pair = doc.facebook.pairList[i].sender + "|" + doc.facebook.pairList[i].receiver + "|" + client.jid.user.substring(1); //combo of people to hash
											var d = new Date();
											var timestamp = "" + d; //timestamp of the message
											var md5sum = crypto.createHash('md5');
											var ucid = md5sum.update(pair).digest('hex');

											Message.findOne({'ucid' : ucid}, function(err, msg) {
												if (msg) {
													console.log("Chat record found! ucid=" + ucid);
													console.log("BEFORE: " + JSON.stringify(msg.messages));
													msg.messages.push({author:"RECEIVER", timestamp:timestamp, message:messageBody});
													console.log("AFTER: " + JSON.stringify(msg.messages));
													msg.save();
												}
												else {
													console.log("Chat record not found. Creating... ucid=" + ucid);
													var newMessage = new Message(
														{
															ucid: ucid,
															messages: [
																{
																	author: "RECEIVER",
																	timestamp: timestamp,
																	message: message
																}
															]
														});


													newMessage.save(function(err, result) {
														if (err) return console.error(err);
													});
											
												}
											});

											break;
										}
									}
								}
								else {
									console.log("User not found!?!?!?!?");
								}
							});


				}
		});
		

		clientlist[insertid] = client;

		});
		}

		else {

			console.log("Connection is already established.");
			console.log(clientlist[insertid].state);
		}
		

	});

	// =====================================
	// ADD PAIR REQUEST ====================
	// =====================================
	
	app.post('/addpair', isLoggedIn, function(req, res) {
		console.log("New Pair Request. Was " + JSON.stringify(req.body));

		if( !req.body.sender ) {
			res.send(1, "Sender was blank.");
		}
		else if ( !req.body.receiver ) {
			res.send(2, "Receiver was blank.");
		}
	  else if ( req.body.sender == req.body.receiver ) {
			res.send(3, "Sender and receiver are the same.");
		}
	  else {
			User.findOne({'facebook.id' : req.body.id}, function(err, doc) {
				if (doc) {
					if (doc.facebook.pairList.length >= 3) {
						res.send(5, "You can only have three conversations going at the same time");
					}
					else {
						var flag = false;

						for (var i = 0; i < doc.facebook.pairList.length; i++) {
							console.log("WTF IS GOIN WIT: " + req.body.sender + " | " + req.body.receiver + " | " + doc.facebook.pairList[i].sender + " | " + doc.facebook.pairList[i].receiver);
							if (req.body.sender == doc.facebook.pairList[i].sender
								|| req.body.sender == doc.facebook.pairList[i].receiver
								|| req.body.receiver == doc.facebook.pairList[i].sender
								|| req.body.receiver == doc.facebook.pairList[i].receiver
								) {
									flag = true;
									break;
								}
						}

						if (flag) {
							console.log("Here");
							res.send(4, "One of the people are already in Middl conversations.");
						}
						else {
							console.log("User " + req.body.id +  " found! Adding pair...");
							console.log(JSON.stringify(doc));
							console.log("BEFORE: " + JSON.stringify(doc.facebook.pairList));
							doc.facebook.pairList.push(
													{sender : req.body.sender,
													 receiver : req.body.receiver});
							console.log("AFTER: " + JSON.stringify(doc.facebook.pairList));
							doc.save();
							res.send("Successful pair add.");
						}
					}
				}
				else {
					console.log("User not found.");
					res.send(999, "Apparently you cannot be found?");
				}
			});
		}
	});


	// =====================================
	// DELETE PAIR REQUST ==================
	// =====================================
	
	app.post('/delpair', isLoggedIn, function(req, res) {
		console.log("Delete Pair Request. Was " + JSON.stringify(req.body));

		User.findOne({'facebook.id' : req.body.id}, function(err, doc) {
			if (doc) {
				console.log("User " + req.body.id +  " found! Deleting pair...");
				console.log(JSON.stringify(doc));
				console.log("BEFORE: " + JSON.stringify(doc.facebook.pairList));

				var idx = -1;

				for (var i = 0; i < doc.facebook.pairList.length; i++) {
					if (doc.facebook.pairList[i].sender === req.body.sender
						&& doc.facebook.pairList[i].receiver === req.body.receiver) {
							idx = i;
							break;
						}
				}

				if (idx === -1) {
					console.log("Pair not found.");
				}
				else {
					doc.facebook.pairList.splice(idx, 1);
					console.log("Successfully removed index: " + idx);
					doc.facebook.archive.push({sender: req.body.sender, receiver: req.body.receiver, timestamp: req.body.timestamp});
					console.log("Archive now: " + JSON.stringify(doc.facebook.archive));
				}
				doc.save();
				console.log("AFTER: " + JSON.stringify(doc.facebook.pairList));
			} else {
				console.log("User not found.");
			}
		});
		res.send("WHEEEEEE");
	});
	
	// =====================================
	// DELETE ARCHIVE REQUST ==================
	// =====================================
	
	app.post('/delarchive', isLoggedIn, function(req, res) {
		console.log("Delete Archive Request. Was " + JSON.stringify(req.body));

		User.findOne({'facebook.id' : req.body.id}, function(err, doc) {
			if (doc) {
				console.log("User " + req.body.id +  " found! Deleting archive...");
				console.log(JSON.stringify(doc));
				console.log("BEFORE: " + JSON.stringify(doc.facebook.archive));

				var idx = -1;

				for (var i = 0; i < doc.facebook.archive.length; i++) {
					if (doc.facebook.archive[i].sender === req.body.sender
						&& doc.facebook.archive[i].receiver === req.body.receiver) {
							idx = i;
							break;
						}
				}

				if (idx === -1) {
					console.log("Pair not found.");
				}
				else {
					doc.facebook.archive.splice(idx, 1);
					console.log("Successfully removed index: " + idx);
				}
				doc.save();
				console.log("AFTER: " + JSON.stringify(doc.facebook.archive));
			} else {
				console.log("User not found.");
			}
		});
		res.send("WHEEEEEE");
	});

	// =====================================
	// GET CHAT RECORD =====================
	// =====================================
	
	app.post('/fetchrecord', isLoggedIn, function(req, res) {
		console.log('Fetch required received. Was ' + JSON.stringify(req.body));

		var pair = req.body.pair;
		var md5sum = crypto.createHash('md5');
		var ucid = md5sum.update(pair).digest('hex');

		Message.findOne({'ucid' : ucid}, function(err, doc) {
			if (doc) {
				// return messages
				console.log("Record found! Returning " + JSON.stringify(doc.messages));
				res.send(JSON.stringify(doc.messages));
			}
			else {
				console.log("Record not found.");
			}
		});
	});


	// =====================================
	// MESSAGE RECEIVED ====================
	// =====================================
	app.post('/addmessage', isLoggedIn, function(req, res) {
		console.log('Message received. Was ' + JSON.stringify(req.body));
		
		var message = req.body.message;
		var pair = req.body.pair; //combo of people to hash
		var id = req.body.id; //id of the author
		var timestamp = req.body.timestamp; //timestamp of the message
		var md5sum = crypto.createHash('md5');
		var ucid = md5sum.update(pair).digest('hex');

		Message.findOne({'ucid' : ucid}, function(err, doc) {
			if (doc) {
				console.log("Chat record found! ucid=" + ucid);
				console.log("BEFORE: " + JSON.stringify(doc.messages));
				doc.messages.push({author:id, timestamp:timestamp, message:message});
				console.log("AFTER: " + JSON.stringify(doc.messages));
				doc.save();
			}
			else {
				console.log("Chat record not found. Creating... ucid=" + ucid);
				var newMessage = new Message(
					{
						ucid: ucid,
						messages: [
							{
								author: id,
								timestamp: timestamp,
								message: message
							}
						]
					});


				newMessage.save(function(err, result) {
					if (err) return console.error(err);
				});
		
			}
		});

		res.send("WHEEEE");
	});

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		res.render('index.ejs'); // load the index.ejs file
	});



	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('login.ejs', { message: req.flash('loginMessage') }); 
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/login', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));	

	// =====================================
	// PROFILE SECTION =====================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, function(req, res) {
		res.render('profile.ejs', {
			user : req.user // get the user out of session and pass to template
		});
	});
	
	app.get('/howitworks', isLoggedIn, function(req, res) {
		res.render('howitworks.ejs', {
			user : req.user
		});
	});
	
	app.get('/archive', isLoggedIn, function(req, res) {
		res.render('archive.ejs', {
			user : req.user
		});
	});

	app.get('/faq', isLoggedIn, function(req, res) {
		res.render('faq.ejs', {
			user : req.user
		});
	});

	app.get('/namereplace', isLoggedIn, function(req, res) {
		res.render('namereplace.ejs', {
			user : req.user
		});
	});

	app.get('/contact', isLoggedIn, function(req, res) {
		res.render('contact.ejs', {
			user : req.user
		});
	});


  // =====================================
	// FACEBOOK ROUTES =====================
	// =====================================
	// route for facebook authentication and login
	app.get('/auth/facebook', passport.authenticate('facebook', { scope : ['email', 'xmpp_login'] }));

	// handle the callback after facebook has authenticated the user
	app.get('/auth/facebook/callback',
		passport.authenticate('facebook', {
			successRedirect : '/profile',
			failureRedirect : '/'
		}));

	// route for logging out
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});


	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});
};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on 
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
}

