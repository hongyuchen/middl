// app/routes.js

var Message = require('../app/models/message');
var User = require('../app/models/user');
var crypto = require('crypto');

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

