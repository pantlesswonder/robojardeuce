(function(parent){
	var TIMEZONE_OFFSET = -5,
		CHAT_MIN_DELAY = 3*1000;
	
	var smiffJSON = require('./smiff.json');
	var catsJSON = require('./cats.json');
	var ermgerdify = require('./erm.js').ermgerd;
	var chats = [],
		chatInterval = null;
	
	var messages = {
		about: 'https://github.com/pantlesswonder/robojardeuce',
		bitch: 'Not a lot of things are against the rules, but bitching about the music is. Stop being a bitch.',
		rules: 'No song limits, no queues, no auto-dj. Pure FFA. DJ\'s over 10 minutes idle (measured by chat) face the [boot]. See /music for music suggestions, though there are no defined or enforced rules on music. More: http://goo.gl/b7UGO',
		afk  : 'If you\'re AFK at the end of your song for longer than 30 minutes you get warning 1. One minute later you get warning 2, another minute last warning, 30 seconds [boot].',
		nsfw : 'Please give people who are listening at work fair warning about NSFW videos.  It\'s common courtesy for people who don\'t code from home or at an awesome startup like LocalSense!',
		pjs  : 'Time for bed already?',
		bjs  : 'Sorry bjs are not yet supported, and even if they were would you really want an internet bj?',
		afpdj: 'AFPDJ is just as bad as AFK. DJ\'s must pay attention to chat, if you cannot do that then don\'t DJ during prime time. The purpose of these rules is so that active users who can pay attention to chat at their employer\'s expense can sit up on the decks.',
		
	};
	
	function ChatHandler(postHelper)
	{
		this.postHelper = postHelper;
	}
	
	ChatHandler.prototype.handleMessage = function(state, type, data)
	{
		switch (type)
		{
			case 'chat':
				var cmd = data.message;
				var tokens = cmd.substr(1, cmd.length).split(" ");
				var now = new Date();
				
				if (messages[tokens[0]])
				{
					chat(state, messages[tokens[0]]);
					return true;
				}
				
				switch(tokens[0])
				{
					case 'djs': idleDjs(state); break;
					case 'count': count(state); break;
					case 'music': musicTip(state); break;
					case 'awesome': this.awesome(state); break;
					case 'lame': this.lame(state); break;
					case 'roll': roll(state, 1, 100); break;
					case 'smiffacts':
					case 'smiffax':
					case 'smifffax':
					case 'smifffacts':
						smiff(state, smiffJSON);
						break;
					case 'catfacts':
					case 'catfax':
						smiff(state, catsJSON);
						break;
					case 'erm':
						ermegerd(state, cmd.substr(4));
						break;
					
					default: return false;
				}
				
				return true;
				
			default:
				return false;
		}
		
		return true;
	}

	function idleDjs(state)
	{
		var djs = state.data.room.djs,
			now = (new Date()).getTime(),
			idle = 5*60*1000,
			sb = [];
				
		for (var i=0; i<djs.length; i++)
		{
			var u = findUserById(state, djs[i].id);
			if (u && u.lastTalk < now - idle)
			{
				sb.push('@'+u.username+' ' + formatTime(now-u.lastTalk));
			}
		}
		
		var message = sb.join(', ').trim();
		if (message.length === 0)
		{
			message = 'Nobody is idle!';
		}
		
		chat(state, message);
	}

	function formatTime(ms)
	{
		//minutes:seconds if we meet minimum idle standard, otherwise nothing
		var seconds = Math.floor(ms/1000);
			m = Math.floor(seconds / 60),
			s = Math.floor(seconds % 60);
		
		return m + ':' + (s < 10 ? '0' : '') + s;
	}
	
	function chat(state, msg)
	{
		chats.push(msg);
		
		function realChat()
		{
			var toSend = chats.pop();
			if (!toSend)
			{
				clearInterval(chatInterval);
				chatInterval = null;
			}
			else
			{
				state.client.send({'type': 'chat', 'msg': toSend});
			}
		}
		
		if (null == chatInterval)
		{
			chatInterval = setInterval(realChat, CHAT_MIN_DELAY);
			realChat();
		}
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
	
	function count(state)
	{
		chat(state, "There are " + state.data.room.users.length + " users.");
	}
	
	function musicTip(state)
	{
		var time = new Date().getUTCHours() + TIMEZONE_OFFSET;
                
		if ( 0 <= time && time < 5) {
		  chat(state, "Evening! Keep the tempo up, it's the only thing keeping the all nighters going.");
		} else if ( 5 <= time && time < 12 ) {
		  chat(state, "AM! Chill tracks with good beats, most programmers are slow to wake so don't hit them with hard hitting tunes. Wubs are widely discouraged this early.");
		} else if (12 <= time && time < 17 ){
		  chat(state, 'Afternoon! Fresh tracks for fresh people.');
		} else {
		  chat(state, "Evening! Most people are out of work so things are a lot more fluid and much less harsh. Seats are easy to get, spin a few if you want but don't hog the decks!");
		}
	}
	
	ChatHandler.prototype.awesome = function(state)
	{
		this.postHelper('plug.dj', '/_/gateway/room.cast', {
			"service":"room.cast",
			"body":[true, state.data.room.historyID, true]}, function(){
				chat(state, 'okay done');
			});
	}
	
	ChatHandler.prototype.lame = function(state)
	{
		this.postHelper('plug.dj', '/_/gateway/room.cast', {
			"service":"room.cast",
			"body":[false, state.data.room.historyID, true]}, function(){
				chat(state, 'aww ok');
			});
	}
	
	function roll(state, min, max)
	{
		min = parseInt(min);
		max = parseInt(max);
		var result = Math.round(Math.random()*(max-min))+min;
		chat(state, 'Rolled '+min+' to '+max+' and got: '+result);
	}
	
	function smiff(state, data)
	{
		if (data && data.facts && data.facts.length)
		{
			var len = data.facts.length;
			var pick = Math.floor(Math.random()*len);
			var str = data.facts[pick];
			
			var l = str.length, chunk = 250;
			for (var i=0; i<l; i+=chunk)
			{
				chat(state, str.slice(i, i+chunk));
			}
		}
	}
	
	function ermegerd(state, text)
	{
		chat(state, ermgerdify(text));
	}
	
	module.exports = {'ChatHandler': ChatHandler};
})(this);