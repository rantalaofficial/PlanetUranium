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
var tickTimer = setInterval(serverTick, 1000 / updateRate);

//CLASSES
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static add(p1, p2) {
        return new Point(p1.x + p2.x, p1.y + p2.y)
    }
}
class Player {
    constructor(username, location, moveSpeed) {
        this.username = username;
        this.location = location;
        this.moveSpeed = moveSpeed;

        this.beamStart = null;
        this.beamEnd = null;
    }
}
var players = {};
class Map {
    constructor(tileSize, width, height) {
        this.tileSize = tileSize;
        this.width = width;
        this.height = height;
        this.tile = [];
        for(var i = 0; i <= width; i++) {
            this.tile[i] = [];
        }
        for(var y = 0; y < width; y++) {
            for(var x = 0; x < height; x++) {
                this.tile[x][y] = 0;
            }
        }
    }

    addTiles(type, percentageChance) {
        for(var y = 0; y < this.width; y++) {
            for(var x = 0; x < this.height; x++) {
                if(Math.random() * 100 <= percentageChance) {
                    this.tile[x][y] = type;
                }
            }
        }
    }
}
var map = new Map(30, 100, 100);
//ADDS RANDOM TREES
map.addTiles(3, 2);

io.on('connection', function(socket) {
    console.log('Socket connected', socket.id);

    socket.on('disconnect', function() {
        delete players[socket.id];
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
                players[socket.id] = new Player(username, new Point(0, 0), 6, 0, 0);
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
        //CHECKS THAT PLAYER OBJECT EXISTS
        if(players[socket.id] === undefined) {
            return;
        }

        //CHECKS THAT VALUES ARE CORRECT AND IF THEY ARE FOR EXAMPLE SOMEONE IS TRYING TO HACK DROP THE PACKET
        if(Math.abs(data.shoot.x) > 1 && Math.abs(data.shoot.y) > 1 || Math.abs(data.move.x) > 1 && Math.abs(data.move.y) > 1) {
            return;
        }

        if(data.shooting) {
            //RAYCASTS SHOOTING BEAM
            //data.shoot = new Point(data.shoot.x * map.tileSize, data.shoot.y * map.tileSize);
            players[socket.id].beamStart = Point.add(players[socket.id].location, data.shoot);
            players[socket.id].beamEnd = Point.add(players[socket.id].location, data.shoot);
            var shootingDistance = 0;
            while(shootingDistance < 5 && locInsideMap(players[socket.id].beamEnd)) {
                var hitPlayerID = getPlayerIDbyCoordinates(players[socket.id].beamEnd);
                if(hitPlayerID) {
                    players[socket.id].location = new Point(0, 0);
                    break;
                }/* else if(map.tile[players[socket.id].beamEnd.x / map.tileSize][players[socket.id].beamEnd.y / map.tileSize] !== 0) {
                    break;
                }*/
                players[socket.id].beamEnd = Point.add(players[socket.id].beamEnd, new Point(data.shoot.x * shootingDistance * map.tileSize, data.shoot.y * shootingDistance * map.tileSize));
                shootingDistance++;
            }
        } else {
            players[socket.id].beamStart = null;
            players[socket.id].beamEnd = null;
        }
        
        //MOVES PLAYER ACCORDING TO MOVEMENT SPEED
        var possibleMove = new Point(players[socket.id].location.x + data.move.x * players[socket.id].moveSpeed, players[socket.id].location.y + data.move.y * players[socket.id].moveSpeed);
        if(locInsideMap(possibleMove)) { 
            players[socket.id].location = possibleMove;
            //REMOVES ANY SOLID BLOCKS FROM PLAYERS LOCATION
            //map[playersX[socket.id]][playersY[socket.id]] = 0;
        }
    
        //PLACES BLOCKS THAT PLAYER WANTS TO PLACE
        if(data.tile !== null && insideMap(data.tile)) {
            map.tile[data.tile.x][data.tile.y] = 1;
        }
    });

});

function serverTick() {
    io.sockets.emit('SERVERPACKET', {
        map: map,
        players: players
    });
}

function getPlayerIDbyCoordinates(p) {
    for(var id in players) {
        if(players[id].location.x === p.x && players[id].location.y === p.y) {
            return id;
        }
    }
    return false;
}

function insideMap(p) {
    if(p.x >= 0 && p.x <= map.width && p.y >= 0 && p.y <= map.height) {
        return true;
    }
    return false;
}

function locInsideMap(p) {
    if(p.x >= 0 && p.x <= map.width * map.tileSize && p.y >= 0 && p.y <= map.height * map.tileSize) {
        return true;
    }
    return false;
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

