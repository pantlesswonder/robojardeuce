//CONFIGURATION:
var cookie = '';

//grab the important libraries that we'll need
var http = require('http'),
    io = require('socket.io-client'),
	repl = require('repl'),
	r = null;

//Override the built in http class to always send our cookie, regardless of
//where we'll be sending to. Sure, this violates spec, but in my defense we
//didn't really have a better alternative.
http.OutgoingMessage.prototype.__renderHeaders = http.OutgoingMessage.prototype._renderHeaders;
http.OutgoingMessage.prototype._renderHeaders = function() {
	if (this._header) {
		throw new Error('Can\'t render headers after they are sent to the client.');
	}

	this.setHeader('Cookie', cookie);
	
	return this.__renderHeaders();
}

function postHelper(host, path, json, callback) {
	var post_options = {
		host: host,
		port: '80',
		path: path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': json.length,
			'Cookie': cookie
		}};

	// Set up the request
	var post_req = http.request(post_options, function(res) {
		res.setEncoding('utf8');
		var chunks = [];
		res.on('data', function (chunk) {
			chunks.push(chunk);
		});

		res.on('end', function(){
			callback ? callback(chunks.join('')) : null;
		});
	});

  // post the data
  post_req.write(json);
  post_req.end();
}
  
//web socket event handlers
var handlers = {
	'chat': function(data){
		if (!r || !r.context.mute)
		{
			console.log('<' + data.from + '> ' + data.message);
		}
	},
	'userLeave': function(data){
		console.log(data.username + ' left.');
	},
	'userJoin': function(data){
		console.log(data.user.username + ' joined.');
	},
	'ping': function(data){
		console.log('Responding to ping!');
		postHelper('www.plug.dj', '/gateway/channel.pong', '{"service":"channel.pong","body":[]}', function(data){
			console.log('pong response: ', data);
		});
	},
	'voteUpdate': function(){}
};

//connect and listen for the various important events
var sock = io.connect('s.plug.dj:843');
sock.on('connecting', function (transport_type) {
	console.log('connecting via ' + transport_type);
});
sock.on('connect', function(realsocket){
	sock.emit('join', 'coding-soundtrack');
	sock.emit('set language', 'en');
	console.log('Connected!!!');
	
	postHelper('www.plug.dj', '/gateway/room.join', '{"service":"room.join","body":["coding-soundtrack"]}', function(data){
		console.log('room-join got: ' + data.length + 'b back');
	});
	
	r = repl.start("node> ");
	r.context.socket = sock;
	r.context.handlers = handlers;
	r.context.mute = false;
});
sock.on('connect_failed', function () {
	console.log('connect failed ...');
});
sock.on('error', function (e) {
	console.log('socket error...');
	console.error(e ? e : 'A unknown error occurred');
});
sock.on('disconnect', function () {
	console.log('DISCONNECTED');
});
sock.on('message', function (msg) {
	for (var i=0; i<msg.messages.length; i++)
	{
		//the msg has our room name in it, maybe we should
		//filter out ones that aren't for our room?
		
		//go through all of the messages in this broadcast
		//and send them to the handlers or log that we don't
		//support that particular event
		var event = msg.messages[i];
		if (handlers[event.type])
		{
			handlers[event.type](event.data);
		}
		else
		{
			console.log('Unsupported event: ' + event.type, event.data);
		}
	}
});