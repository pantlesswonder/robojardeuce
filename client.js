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

function findUserById(id)
{
	var users = state.data.room.users;
	for (var i=0; i<users.length; i++)
	{
		if (users[i].id === id)
		{
			return users[i];
		}
	}
}

function respondChat(data)
{
	if ('/djs' === data.message)
	{
		idleDjs();
	}
}

function logSongScore()
{
	var room = state.data.room,
		users = room.users,
		votes = room.votes,
		curates = room.curates,
		media = room.media;
		up = [],
		down = [],
		heart = [];
	
	for (var id in votes)
	{
		if (1 === votes[id])
		{
			up.push(findUserById(id).username);
		}
		else if (-1 === votes[id])
		{
			down.push(findUserById(id).username);
		}
	}
	
	for (id in curates)
	{
		heart.push(findUserById(id).username);
	}
	
	up.sort();
	down.sort();
	heart.sort();
	
	console.log(media.author + ' - ' + media.title + ' got:' +
		(up.length ? ('\n  ' + up.length + ' up: ' + up.join(', ')) : '') +
		(down.length ? ('\n  ' + down.length + ' down: ' + down.join(', ')) : '') +
		(heart.length ? ('\n  ' + heart.length + ' adds: ' + heart.join(', ')) : ''));
}

function idleDjs()
{
	var djs = state.data.room.djs,
		now = (new Date()).getTime(),
		idle = 5*60*1000,
		sb = [];
			
	for (var i=0; i<djs.length; i++)
	{
		var u = findUserById(djs[i].id);
		if (u.lastTalk < now - idle)
		{
			sb.push('@'+u.username+' ' + formatTime(now-u.lastTalk));
		}
	}
	
	var message = sb.join(', ').trim();
	if (message.length === 0)
	{
		message = 'Nobody is idle!';
	}
	
	client.send({type: 'chat', msg: message});
}

function formatTime(ms)
{
	//minutes:seconds if we meet minimum idle standard, otherwise nothing
	var seconds = Math.floor(ms/1000);
		m = Math.floor(seconds / 60),
		s = Math.floor(seconds % 60);
	
	return m + ':' + (s < 10 ? '0' : '') + s;
}

//web socket event handlers
var handlers = {
	chat: function(data)
	{
		switch (data.type)
		{
			case 'message':
				//show the message
				console.log('(' + data.chatID + ') <' + data.from + '> ' + decodeHtml(data.message));
				//update the last talk time
				findUserById(data.fromID).lastTalk = (new Date()).getTime();
				//respond if warranted
				respondChat(data);
				break;
			case 'emote':
				console.log('(' + data.chatID + ') <' + data.from + '> /me' + decodeHtml(data.message));
				findUserById(data.fromID).lastTalk = (new Date()).getTime();
				break;
			default:
				handlers.unknown(data);
		}
	},
	'ping': function(data)
	{
		console.log('Responding to ping!');
		client.send({
			type: 'rpc', id: 2,
			name: 'user.pong', args: []});
	},
	'djUpdate': function(data)
	{
		state.data.room.djs = data;
	},
	'userUpdate': function(data)
	{
		//find the user that we're looking for and
		//update all of their stuff
		var user = findUserById(data.id);
		for (var p in data)
		{
			if (data.hasOwnProperty(p))
			{
				user[p] = data[p];
			}
		}
	},
	'userJoin': function(data)
	{
		console.log(data.username + ' joined.');
		data.lastTalk = (new Date()).getTime();
		state.data.room.users.push(data);
	},
	'djAdvance': function(data)
	{
		//print the final score of the last song
		logSongScore();
		
		state.data.room.currentDJ = data.currentDJ;
		state.data.room.djs = data.djs;
		state.data.room.mediaStartTime = data.mediaStartTime;
		state.data.room.media = data.media;
		state.historyID = data.historyID;

		//don't know what to do about these
		//data.playlistID: '50af0b8096fba5689a6424fd'
		//data.earn: true
		
		//reset the curates and the votes
		state.data.room.curates = {};
		state.data.room.votes = {};
		
		//log who played what
		console.log(findUserById(data.currentDJ).username + ' started playing ' +
			data.media.title + ' by ' + data.media.author);
	},
	'voteUpdate': function(data)
	{
		state.data.room.votes[data.id] = data.vote;
	},
	'curateUpdate': function(data)
	{
		state.data.room.curates[data.id] = true;
	},
	'userLeave': function(data)
	{
		var room = state.data.room,
			users = room.users;
			
		for (var i=0; i<users.length; i++)
		{
			if (users[i].id === data.id)
			{
				console.log(users[i].username + ' left');
				users.splice(data.id, 1);
			}
		}
		
		//clear their votes and curates
		if (room.votes[data.id])
		{
			delete room.votes[data.id];
		}
		
		if (room.curates[data.id])
		{
			delete room.curates[data.id];
		}
		
	},
	'unknown': function(type, data)
	{
		console.log('Unknown message: ', type, data);
	}	
};

var state = {};

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
		switch (mo.id)
		{
			//room init state
			case 1:
				state.data = mo.result;
				
				//mark all of the users as having just talked
				var users = state.data.room.users,
					now = (new Date()).getTime();
				for (var i=0; i<users.length; i++)
				{
					users[i].lastTalk = now;
				}
				
				break;
			
			//pong ack from server
			case 2:
				break;
				
			default:
				console.log('WARNING: Ignoring RPC response (id: ' + mo.id + ')');
				break;
		}
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
r.context.state = state;
r.context.findUserById = findUserById;