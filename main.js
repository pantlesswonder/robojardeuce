(function(parent){
	"use strict";
	
function MainHandler(){}

MainHandler.prototype.handleMessage = function(state, type, data)
{
	switch(type)
	{
		case 'chat':
			switch (data.type)
			{
				case 'message':
					//show the message
					console.log('(' + data.chatID + ') <' + data.from + '> ' + decodeHtml(data.message));
					//update the last talk time
					findUserById(state, data.fromID).lastTalk = (new Date()).getTime();
					break;
				case 'emote':
					console.log('(' + data.chatID + ') <' + data.from + '> /me' + decodeHtml(data.message));
					findUserById(state, data.fromID).lastTalk = (new Date()).getTime();
					break;
				default:
					handlers.unknown(data);
			}
			break;
			
		case 'ping':
			state.client.send({
				type: 'rpc', id: 2,
				name: 'user.pong', args: []});
			break;
			
		case 'djUpdate':
			state.data.room.djs = data;
			break;
		
		case 'userUpdate':
			//find the user that we're looking for and
			//update all of their stuff
			var user = findUserById(state, data.id);
			if (!user)
			{
				break;
			}
			
			for (var p in data)
			{
				if (data.hasOwnProperty(p))
				{
					user[p] = data[p];
				}
			}
			break;
			
		case 'userJoin':
			console.log(data.username + ' joined.');
			data.lastTalk = (new Date()).getTime();
			state.data.room.users.push(data);
			break;
		
		case 'djAdvance':
			//print the final score of the last song
			logSongScore(state);
			
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
			console.log(findUserById(state, data.currentDJ).username + ' started playing ' +
				data.media.title + ' by ' + data.media.author);
			break;
			
		case 'voteUpdate':
			state.data.room.votes[data.id] = data.vote;
			break;
			
		case 'curateUpdate':
			state.data.room.curates[data.id] = true;
			break;
			
		case 'userLeave':
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
			break;
		
		//we didn't handle this event
		default:
			return false;
	}
	
	//we handled this event
	return true;
}

MainHandler.prototype.handleRpc = function(state, message)
{
	switch (message.id)
	{
		//room init state
		case 1:
			state.data = message.result;
		
			//mark all of the users as having just talked
			var users = state.data.room.users,
				now = (new Date()).getTime();
			for (var i=0; i<users.length; i++)
			{
				users[i].lastTalk = now;
			}
			
			return true;
		
		//pong ack from server
		case 2: return true;
			
		default:
			return false;
	}
}

function decodeHtml(str) {
	return str.replace(/&#\d+?;/g, function(m){ var c = parseInt(m.substr(2, m.length-3), 10); return String.fromCharCode(c);});
}

function findUserById(state, id)
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

function logSongScore(state)
{
	var room = state.data.room,
		users = room.users,
		votes = room.votes,
		curates = room.curates,
		media = room.media,
		up = [],
		down = [],
		heart = [];
	
	for (var id in votes)
	{
		var user = findUserById(state, id);
		if (!user)
		{
			continue;
		}

		if (1 === votes[id])
		{
			up.push(user.username);
		}
		else if (-1 === votes[id])
		{
			down.push(user.username);
		}
	}
	
	for (id in curates)
	{
		var user = findUserById(state, id);
		if (user)
		{
			heart.push(user.username);
		}
	}
	
	up.sort();
	down.sort();
	heart.sort();
	
	console.log(media.author + ' - ' + media.title + ' got:' +
		(up.length ? ('\n  ' + up.length + ' up: ' + up.join(', ')) : '') +
		(down.length ? ('\n  ' + down.length + ' down: ' + down.join(', ')) : '') +
		(heart.length ? ('\n  ' + heart.length + ' adds: ' + heart.join(', ')) : ''));
}

module.exports = {'MainHandler': MainHandler};

})(this);