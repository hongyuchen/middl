
var mongoose = require('mongoose')

var messageSchema = mongoose.Schema({
	ucid: String,
	messages: [
		{author: String, timestamp: String, message: String}
	]
});

module.exports = mongoose.model('Message', messageSchema);
