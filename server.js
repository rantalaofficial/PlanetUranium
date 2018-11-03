let express = require('express');
let socket = require('socket.io');
let mysql = require('mysql');
let crypto = require('crypto');

//APP SETUP
let serverPort = 8080;
let app = express();
let server = app.listen(serverPort, function() {
	console.log("Server started on port: " + serverPort)
});
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.static('public'));
let io = socket(server);

//MYSQL DATABASE
let DBconnection = mysql.createConnection({
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
let updateRate = 30;
let tickTimer = setInterval(serverTick, 1000 / updateRate);

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
let players = {};
class Map {
    constructor(tileSize, width, height) {
        this.tileSize = tileSize;
        this.width = width;
        this.height = height;
        this.tile = [];
        for(let i = 0; i <= width; i++) {
            this.tile[i] = [];
        }
        for(let y = 0; y < width; y++) {
            for(let x = 0; x < height; x++) {
                this.tile[x][y] = 0;
            }
        }
    }

    addTiles(type, percentageChance) {
        for(let y = 0; y < this.width; y++) {
            for(let x = 0; x < this.height; x++) {
                if(Math.random() * 100 <= percentageChance) {
                    this.tile[x][y] = type;
                }
            }
        }
    }
}
let map = new Map(30, 30, 30);
//ADDS RANDOM TREES
map.addTiles(3, 2);

io.on('connection', function(socket) {
    console.log('Socket connected', socket.id);

    socket.on('disconnect', function() {
        delete players[socket.id];
        console.log('Socket disconnected', socket.id);
    });

    socket.on('LOGIN', function(data) {
        let username = data.username;
        let passwordHash = hash256(data.password);

        if(!username || !passwordHash) {
            return;
        }
        DBconnection.query("SELECT password FROM planeturanium.users WHERE username = '" + username + "';" , function(err, result) {
            if(result[0] && passwordHash === result[0].password) {
                players[socket.id] = new Player(username, new Point(0, 0), 6, 0, 0);
                respawnPlayer(socket.id);
                socket.emit('LOGGED', socket.id);
            } else {
                socket.emit('LOGINFAILED', 'Wrong username or password.')
            }
        });
    });

    socket.on('REGISTER', function(data) {
        let username = data.username;
        let passwordHash = hash256(data.password);

        if(!onlyLetters(username) || username.length < 6 || username.length > 20 ) {
            socket.emit('REGISTERFAILED', 'Username can only contain letters and numbers and it must be between 6 and 20 characters long.')
            return;
        }
        DBconnection.query("INSERT INTO planeturanium.users (`username`, `password`) VALUES ('" + data.username + "', '" + passwordHash + "');", function(err, result) {
            if(err) {
                socket.emit('REGISTERFAILED', 'That username is already in use.')
            } else {
                socket.emit('REGISTERED', '');
                console.log('REGISTERED NEW PLAYER', data.username);
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
            let startingPoint = Point.add(players[socket.id].location, new Point(map.tileSize / 2 + map.tileSize * data.shoot.x, map.tileSize / 2 + map.tileSize * data.shoot.y));
            players[socket.id].beamStart = startingPoint
            players[socket.id].beamEnd = startingPoint;
            let shootingDistance = 0;
            while(shootingDistance < map.tileSize * 2 && locInsideMap(players[socket.id].beamEnd)) {
                //TEST IF HIT BLOCK
                let thisTile = getTileCoordinates(players[socket.id].beamEnd);
                if(thisTile) {
                    if(map.tile[thisTile.x][thisTile.y] !== 0) {
                        break;
                    }
                }
                //TEST PLAYER HIT
                let playerHitID = getPlayersInRadius(socket.id , players[socket.id].beamEnd, map.tileSize / 2);
                if(playerHitID) {
                    respawnPlayer(playerHitID);
                    break;
                }
                //RAYCAST
                players[socket.id].beamEnd = Point.add(players[socket.id].beamEnd, new Point(data.shoot.x * 5, data.shoot.y * 5));
                shootingDistance++;
            }
        } else {
            players[socket.id].beamStart = null;
            players[socket.id].beamEnd = null;
        }
        
        //MOVES PLAYER ACCORDING TO MOVEMENT SPEED
        let possibleMove = new Point(players[socket.id].location.x + data.move.x * players[socket.id].moveSpeed, players[socket.id].location.y + data.move.y * players[socket.id].moveSpeed);
        if(locInsideMap(possibleMove)) { 
            players[socket.id].location = possibleMove;
            //REMOVES ANY SOLID BLOCKS FROM PLAYERS LOCATION
            let thisTile = getTileCoordinates(getPlayerCenter(socket.id));
            map.tile[thisTile.x][thisTile.y] = 0;
        }
    
        //PLACES BLOCKS THAT PLAYER WANTS TO PLACE
        if(data.tile !== null && insideMap(data.tile)) {
            map.tile[data.tile.x][data.tile.y] = 1;
        }
    });

});

function serverTick() {
    let date = new Date();
    let timestamp = date.getTime();
    io.sockets.emit('SERVERPACKET', {
        timestamp: timestamp,
        map: map,
        players: players
    });
}

function respawnPlayer(id) {
    players[id].location.x = Math.round(Math.random() * (map.width - 1) * map.tileSize);
    players[id].location.y = Math.round(Math.random() * (map.height - 1) * map.tileSize);
}

function getPlayersInRadius(self ,location, searchRadius) {
    for(id in players) {
        if(id === self) {
            continue;
        }

        //CALCULATES THE PLAYERS CENTER COORDINATES FROM THE TOP LEFT COORDINATES
        let centerLocation = getPlayerCenter(id);

        if(centerLocation.x >= location.x - searchRadius && centerLocation.x <= location.x + searchRadius && 
            centerLocation.y >= location.y - searchRadius && centerLocation.y <= location.y + searchRadius) {
            return id;
        }
    }
}

function getPlayerCenter(id) {
    return new Point(players[id].location.x + map.tileSize / 2, players[id].location.y + map.tileSize / 2);
}

function getTileCoordinates(p) {
    for(let y = 0; y <= map.height; y++) {
        for(let x = 0; x <= map.width; x++) {
            if(p.x >= x * map.tileSize && p.x < x * map.tileSize + map.tileSize && p.y >= y * map.tileSize && p.y < y * map.tileSize + map.tileSize) {
                return new Point(x, y);
            }
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
        let sha256 = crypto.createHash('sha256');
        return sha256.update(text).digest('hex');
    }
}

function onlyLetters(text) {
    if(text) {
        return text.match("^[A-z0-9]+$");
    }
}

