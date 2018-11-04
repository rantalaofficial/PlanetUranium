const express = require('express');
const socket = require('socket.io');
const mysql = require('mysql');
const crypto = require('crypto');
const U = require('./Uranium2DServerEngine');

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
let updateRate = 80;
setInterval(serverTick, 1000 / updateRate);

let players = {};

let map = new U.Map(30, 100, 100);
map.addTiles(3, 2);

let chat = new U.Chat(300);
chat.addMessage("SERVER", "SERVER STARTED :D", "red");


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
                players[socket.id] = new U.Player(username, new U.Point(0, 0), 6, 0, 0);
                respawnPlayer(socket.id);
                socket.emit('LOGGED', {
                    socketID: socket.id,
                    map: map,
                    players: players,
                    chat: chat.messages
                });
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
        //CHECKS THAT PLAYER OBJECT EXISTS AND HAS USERNAME
        if(players[socket.id] === undefined && players[socket.id] === undefined) {
            return;
        }

        //CHECKS THAT VALUES ARE CORRECT AND IF THEY ARE FOR EXAMPLE SOMEONE IS TRYING TO HACK DROP THE PACKET
        if(Math.abs(data.shoot.x) > 1 && Math.abs(data.shoot.y) > 1 || Math.abs(data.move.x) > 1 && Math.abs(data.move.y) > 1) {
            return;
        }

        //CHAT
        if(data.message !== undefined && data.message !== null && data.message.length > 0 && data.message.length < 100) {
            chat.addMessage(players[socket.id].username, data.message, 'green');
        }

        if(data.shooting) {
            //RAYCASTS SHOOTING BEAM
            let startingPoint = U.Point.add(players[socket.id].location, new U.Point(map.tileSize / 2 + map.tileSize * data.shoot.x, map.tileSize / 2 + map.tileSize * data.shoot.y));
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
                players[socket.id].beamEnd = U.Point.add(players[socket.id].beamEnd, new U.Point(data.shoot.x * 5, data.shoot.y * 5));
                shootingDistance++;
            }
        } else {
            players[socket.id].beamStart = null;
            players[socket.id].beamEnd = null;
        }
        
        //MOVES PLAYER ACCORDING TO MOVEMENT SPEED
        let possibleMove = new U.Point(players[socket.id].location.x + data.move.x * players[socket.id].moveSpeed, players[socket.id].location.y + data.move.y * players[socket.id].moveSpeed);
        if(locInsideMap(possibleMove)) { 
            players[socket.id].location = possibleMove;
            //REMOVES ANY SOLID BLOCKS FROM PLAYERS LOCATION
            let thisTile = getTileCoordinates(getPlayerCenter(socket.id));
            map.pushTileUpdate(thisTile, 0);
        }
    
        //PLACES BLOCKS THAT PLAYER WANTS TO PLACE
        if(data.tile !== null && insideMap(data.tile)) {
            map.pushTileUpdate(data.tile, 1);
        }
    });

});

function serverTick() {
    packet = {
        updatedTiles: map.updatedTiles,
        updatedTileTypes: map.updatedTileTypes,
        players: players,
        chat: null
    }
    //IF CHAT HAS NEW MESSAGES ADDS THEM TO PACKET
    if(chat.chatUpdated) {
        packet.chat = chat.messages;
    }

    chat.chatUpdated = false;
    map.clearTileUpdates();

    io.sockets.emit('SERVERPACKET', packet);
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
    return new U.Point(players[id].location.x + map.tileSize / 2, players[id].location.y + map.tileSize / 2);
}

function getTileCoordinates(p) {
    for(let y = 0; y <= map.height; y++) {
        for(let x = 0; x <= map.width; x++) {
            if(p.x >= x * map.tileSize && p.x < x * map.tileSize + map.tileSize && p.y >= y * map.tileSize && p.y < y * map.tileSize + map.tileSize) {
                return new U.Point(x, y);
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

