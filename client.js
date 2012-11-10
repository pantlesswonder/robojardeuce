//CONFIGURATION:
var cookie = '';

//grab the important libraries that we'll need
var http = require('http'),
    io = require('socket.io-client');

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
  
//web socket event handlers
var handlers = {
	'chat': function(data){
		console.log('<' + data.from + '> ' + data.message);
		
		if ('herp' === data.message)
		{
			sock.emit('chat', 'derp');
		}
	},
	'userLeave': function(data){
		console.log(data.username + ' left.');
	},
	'userJoin': function(data){
		console.log(data.username + ' joined.');
	},
	'ping': function(data){
		//rpcGW.execute('channel.pong', null);
		//I'm pretty sure this is bad if we don't respond here
	}
};

//connect and listen for the various important events
var sock = io.connect('s.plug.dj:843');
sock.on('connecting', function (transport_type) {
	console.log('connecting via ' + transport_type);
});
sock.on('connect', function(){
	this.emit('join', 'coding-soundtrack');
	this.emit('set language', 'en');
	console.log('Connected!!!');
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