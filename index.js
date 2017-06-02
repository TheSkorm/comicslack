var bot_token = process.env.SLACK_BOT_TOKEN || '';
var slackAPI = require('slackbotapi');
var _ = require("lodash");
var net = require('net');

var irc_client; // <---- srsly?

var server = net.createServer(function(socket) {
    socket.on('data', function(chunk) {
        var data = chunk.toString("ascii").trim();
        console.log(data);
        irc_client = socket;
        var lines = data.split("\r\n");
        for (var id in lines){
            var line = lines[id]
            var command = line.split(" ")[0]
            if (!(command in commands)){
                continue;
            }
            commands[command](line, socket)
        }
    });
});

var commands = {
    "MODE": mode,
    "IRCX": ircx,
    "NICK": nick,
    "USER": user,
    "WHO": who,
    "PROP": prop,
    "PRIVMSG" : privmsg
}

function privmsg(line,socket){
    var channel = line.split(" ")[1]
    var message = line.slice(line.indexOf(":")+1)
    var chanid = slack.getChannel(channel.slice(1)).id
    slack.sendMsg(chanid, message);

}

function who(line, socket){
    var channel = line.split(" ")[1]
    send(socket, ":slack 315 " +socket.nick+" " +channel+ " :End of /WHO list")

}

function prop(line, socket){
    var channel = line.split(" ")[1]
    send(socket, ":slack 819 "+socket.nick+" "+channel+" :End of properties")
}

function send(socket, message){
    if (socket){
        socket.write(message + "\r\n")
        console.log(message)
    }
}

function mode(line, socket){
    if (/MODE ISIRCX/.test(line)){
        send(socket,":slack 800 * 0 0 ANON 512 *");  // No idea what these are
    } else {
        var chan = line.split(" ")[1]
        send(socket,":slack 324 " + socket.nick + " "+chan+" +nt");
    }
}

function user(line, socket){
     send(socket,":slack 001 " + socket.nick + " :Welcome to the Internet Relay Chat Network, " + socket.nick)
     send(socket,":slack 422 " + socket.nick + " :MOTD Not Present")
}
function nick(line, socket){
    socket.nick = line.split(" ")[1] // This seems like a GREAT place to put this....
    joined_channels = _.filter(slack.slackData.channels, ['is_member', true]); // I guestt we just assume if the NICK is okay, then we should join all the channels - just hope the user doesn't do /nick 
    for(var id in joined_channels){
        var channel = joined_channels[id];
        send(socket, ":"+socket.nick+"!~Anonymous@hostname JOIN :#" + channel.name)
        for (var i in channel.members){
            var memberid = channel.members[i];
            var guest = slack.getUser(memberid).name
            send(socket, ":slack 353 " + socket.nick + " = #" + channel.name + " :" + guest)
        }
        send(socket, ":slack 356 " + socket.nick + " #" + channel.name + " :End of /NAMES list")

    }
    console.log()
}


function ircx(line, socket){
    send(socket,":slack 800 * 1 0 ANON 512 *"); // No idea what these are
}

server.listen(6667, '127.0.0.1');

// Starting
var slack = new slackAPI({
    'token': bot_token,
    'logging': true,
    'autoReconnect': true
});

// Slack on EVENT message, send data.
slack.on('message', function (data) {
    // If no text, return.
    if (typeof data.text === 'undefined') return;

    var guest = slack.getUser(data.user).name
    var chan = slack.getChannel(data.channel).name
    send(irc_client, ":" + guest + "!~Anonymous@hostname PRIVMSG #" + chan + " :" + data.text) // irc_client hack is stupid. Should probably solve this a little nicer

});


