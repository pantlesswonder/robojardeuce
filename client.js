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

function postHelper(host, path, json, callback) {
	var jsonStr = JSON.stringify(json);
	
	var post_options = {
		host: host,
		port: '80',
		path: path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': jsonStr.length,
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
  post_req.write(jsonStr);
  post_req.end();
}
	
//load up all of our (isolated) handlers
var handlers = [];
handlers.push(new (require('./main.js').MainHandler)());
handlers.push(new (require('./chat.js').ChatHandler)(postHelper));

var state = {};

state.client = SockJS.create('http://sjs.plug.dj:443/plug');
state.client.send = function(data){
	state.client.write(JSON.stringify(data));
};

state.client.on('connection', function () {
	console.log('socket connected');
	state.client.send({
		type: 'rpc', id: 1,
		name: 'room.join', args: [room]});
});

state.client.on('data', function (msg) { 
	var mo = JSON.parse(msg);
	if (mo.messages && mo.messages.length)
	{
		for (var i=0; i<mo.messages.length; i++)
		{
			var msg = mo.messages[i];
			var result = false;
			
			for (var j=0; j<handlers.length; j++)
			{
				if (handlers[j].handleMessage)
				{
					try
					{
						result = handlers[j].handleMessage(state, msg.type, msg.data) || result;
					}
					catch (E)
					{
						console.log("ERROR: " + E);
					}
				}
			}
			
			//if NOBODY handled the event, then log it
			if (!result)
			{
				console.log('WARNING: Unknown message', msg.type, msg.data);
			}
		}
	}
	else if ('rpc' === mo.type)
	{
		var result = false;
		for (var i=0; i<handlers.length; i++)
		{
			if (handlers[i].handleRpc)
			{
				try
				{
					result = handlers[i].handleRpc(state, mo) || result;
				}
				catch (E)
				{
					console.log("ERROR: " + E);
				}
			}
		}
		
		//if nobody handled the RPC, then log it
		if (!result)
		{
			console.log('WARNING: Ignoring RPC response (id: ' + mo.id + ')');
		}
	}
	else
	{
		console.log(mo);
	}
});

state.client.on('error', function(e){
	console.log('error');
	console.log(e);
});

r = repl.start("node> ");
r.context.client = state.client;
r.context.handlers = handlers;
r.context.state = state;