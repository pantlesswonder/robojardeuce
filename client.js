//CONFIGURATION:
var cookie = '',
    room = 'coding-soundtrack';

//grab the important libraries that we'll need
var http = require('http'),
	SockJS = require('./sockjs-client.js'),
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

function decodeHtml(str) {
	return str.replace(/&#\d+?;/g, function(m){ var c = parseInt(m.substr(2, m.length-3), 10); return String.fromCharCode(c);});
}

//web socket event handlers
var handlers = {
	'chat': function(data){
		if (!r || !r.context.mute)
		{
			console.log('<' + data.from + '> ' + decodeHtml(data.message));
		}
		
		switch (data.message)
		{
			case 'herp':
				client.send({type: 'chat', msg: 'derp'});
				break;
			case '/about':
				client.send({type: 'chat', msg: 'https://github.com/pantlesswonder/robojardeuce'});
				break;
		}
	},
	'userJoin': function(data){
		console.log(data.username + ' joined.');
	},
	'ping': function(data){
		console.log('Responding to ping!');
		client.send({
			type: 'rpc', id: 2,
			name: 'user.pong', args: []});
	},
	'djAdvance': function(data){
		console.log('Song: ' + data.media.title + ' - ' + data.media.author);
	},
	'followjoin': function(){},
	'curateUpdate': function(){},
	'voteUpdate': function(){},
	'userUpdate': function(){},
	'unknown': function(type, data){
		console.log('Unknown message: ', type, data);
	}
};

var client = SockJS.create('http://sjs.plug.dj:443/plug');
client.send = function(data){
	client.write(JSON.stringify(data));
};

client.on('connection', function () {
	console.log('socket connected');
	client.send({
		type: 'rpc', id: 1,
		name: 'room.join', args: [room]});
});

client.on('data', function (msg) { 
	var mo = JSON.parse(msg);
	if (mo.messages && mo.messages.length)
	{
		for (var i=0; i<mo.messages.length; i++)
		{
			var msg = mo.messages[i];
			
			if (handlers[msg.type])
			{
				handlers[msg.type](msg.data);
			}
			else
			{
				handlers['unknown'](msg.type, msg.data);
			}
		}
	}
	else if ('rpc' === mo.type)
	{
		//TODO handle RPC return values
		console.log('WARNING: Ignoring RPC response');
	}
	else
	{
		console.log(mo);
	}
	
});

client.on('error', function(e){
	console.log('error');
	console.log(e);
});

r = repl.start("node> ");
r.context.client = client;
r.context.handlers = handlers;