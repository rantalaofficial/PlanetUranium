var express = require('express');
var socket = require('socket.io');
var mysql = require('mysql');
var crypto = require('crypto');

//APP SETUP
var serverPort = 8080;
var app = express();
var server = app.listen(serverPort, function() {
	console.log("Server started on port: " + serverPort)
});
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.static('public'));
var io = socket(server);

//MYSQL DATABASE
var DBconnection = mysql.createConnection({
    host: "localhost",
    user: "user",
    password: "hFxKMZZF5yir5FpI",
    database: "planeturanium"
  });
DBconnection.connect(function(err) {
if (err) throw err;
    console.log("Connected to DB");
});

//NETWORKING
var updateRate = 30;
var packetTimer = setInterval(sendPacket, 1000 / updateRate);

var usernames = {};
var playersX = {};
var playersY = {};
var mapWidth = 100;
var mapHeight = 100;
var map = [];
for(var i = 0; i <= mapWidth; i++) {
    map[i] = [];
}
for(var y = 0; y < mapHeight; y++) {
    for(var x = 0; x < mapWidth; x++) {
        map[x][y] = 0;
    }
}

io.on('connection', function(socket) {
    console.log('Socket connected', socket.id);

    socket.on('disconnect', function() {
        console.log('Socket disconnected', socket.id);
    });

    socket.on('LOGIN', function(data) {
        var username = data.username;
        var passwordHash = hash256(data.password);

        if(!username || !passwordHash) {
            return;
        }
        DBconnection.query("SELECT password FROM planeturanium.users WHERE username = '" + username + "';" , function(err, result) {
            if(result[0] && passwordHash === result[0].password) {
                usernames[socket.id] = username;
                playersX[socket.id] = 0;
                playersY[socket.id] = 0;
                socket.emit('LOGGED', socket.id);
            } else {
                socket.emit('LOGINFAILED', 'Wrong username or password.')
            }
        });
    });

    socket.on('REGISTER', function(data) {
        var username = data.username;
        var passwordHash = hash256(data.password);

        if(!onlyLetters(username) || username.length < 6 || username.length > 20 ) {
            socket.emit('REGISTERFAILED', 'Username can only contain letters and numbers and it must be between 6 and 20 characters long.')
            return;
        }
        DBconnection.query("INSERT INTO planeturanium.users (`username`, `password`) VALUES ('" + data.username + "', '" + passwordHash + "');", function(err, result) {
            if(err) {
                socket.emit('REGISTERFAILED', 'That username is already in use.')
            } else {
                socket.emit('REGISTERED', '');
                console.log('REGISTERED', data.username);
            }
        });
    });

    socket.on('PLAYERPACKET', function(data) {
        if(Math.abs(data.moveX) <= 1 && Math.abs(data.moveY) <= 1) {
            var possibleMoveX = playersX[socket.id] + data.moveX;
            var possibleMoveY = playersY[socket.id] + data.moveY;
            if(insideMap(possibleMoveX, possibleMoveY)) {
                playersX[socket.id] = possibleMoveX;
                playersY[socket.id] = possibleMoveY;

                //REMOVES ANY SOLID BLOCKS FROM PLAYERS LOCATION
                map[playersX[socket.id]][playersY[socket.id]] = 0;
            }
        } 

        if(data.tileX !== null && data.tileY !== null && insideMap(data.tileX, data.tileY)) {
            map[data.tileX][data.tileY] = 1;
        }
    });

});

function insideMap(x, y) {
    if(x >= 0 && x <= mapWidth && y >= 0 && y <= mapHeight) {
        return true;
    } else {
        return false;
    }
}

function sendPacket() {
    io.sockets.emit('SERVERPACKET', {
        map: map,
        usernames: usernames,
        playersX: playersX,
        playersY: playersY
    });
}

//HASH
function hash256(text) {
    if(text) {
        var sha256 = crypto.createHash('sha256');
        return sha256.update(text).digest('hex');
    }
}

function onlyLetters(text) {
    if(text) {
        return text.match("^[A-z0-9]+$");
    }
}

