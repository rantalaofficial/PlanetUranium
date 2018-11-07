const express = require('express');
const socket = require('socket.io');
const crypto = require('crypto');
const U = require('./Uranium2DServerEngine');
const mongoose = require('mongoose');

//APP SETUP
let serverPort = 8080;
let app = express();
let server = app.listen(serverPort, function() {
	console.log("Server started on port " + serverPort)
});
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.static('public'));
let io = socket(server);

//DATABASE
mongoose.connect('mongodb://localhost/planeturanium', {useNewUrlParser: true, useCreateIndex: true}, function (err) {
   if (err) throw err;
   console.log('Connected to database');
});
let userDataSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true
    },
    uranium: {
        type: Number,
        required: true
    },
    healthRegen: {
        type: Number,
        required: true
    },
    moveSpeed: {
        type: Number,
        required: true
    }
});
let userData = mongoose.model('userData', userDataSchema);
//RESET DB
//userData.deleteMany({type: String}, function(err) {});
//LOG REGISTERED PLAYERS
userData.find(function(err, users) {
    let usernameList = '';
    for(let i in users) {
        usernameList += users[i].username + ', '
    }
    console.log('Registered users: ' + usernameList);

    //SHOW WHOLE DATABASE
    console.log(users);
});
function savePlayerStats(id, deleteStatsFromMemory) {
    if(players[id] === undefined) {
        return;
    }
    userData.findOne({username: players[id].username}, function(err, user) {
        user.uranium = players[id].uranium;
        user.healthRegen = players[id].healthRegen;
        user.moveSpeed = players[id].moveSpeed;
        user.save();

        if(deleteStatsFromMemory) {
            delete players[id];
        }
    });
}

let updateRate = 80;
setInterval(serverTick, 1000 / updateRate);

let players = {};

let map = new U.Map(30, 100, 100);
map.addTiles(3, 2);
map.addTiles(4, 1);

let chat = new U.Chat(300);
chat.addMessage("SERVER", "SERVER STARTED :D", "red");


io.on('connection', function(socket) {
    //console.log('Socket connected', socket.id);

    socket.on('disconnect', function() {
        if(players[socket.id] === undefined) {
            return;
        }
        //SAVES PLAYER STATS TO DATABASE BEFORE REMOVING THEM FROM SERVER MEMORY
        savePlayerStats(socket.id, true);
    });

    socket.on('LOGIN', function(data) {
        let passwordHash = hash256(data.password);

        if(!data.username || !passwordHash) {
            return;
        }

        userData.findOne({username: data.username}, function(err, user) {
            if(user && user.password === passwordHash) {
                players[socket.id] = new U.Player(data.username, user.uranium, user.healthRegen, user.moveSpeed);
                players[socket.id].respawnPlayer(map);
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
        let passwordHash = hash256(data.password);

        if(!onlyLetters(data.username) || data.username.length < 6 || data.username.length > 20 ) {
            socket.emit('REGISTERFAILED', 'Username can only contain letters and numbers and it must be between 6 and 20 characters long.')
            return;
        }

        userData.findOne({username: data.username}, function(err, user) {
            if(user) {
                socket.emit('REGISTERFAILED', 'That username is already in use');
            } else {
                //MAKES NEW USER
                let newUser = new userData({
                    username: data.username,
                    password: passwordHash,
                    uranium: 0,
                    healthRegen: 1,
                    moveSpeed: 5
                });

                newUser.save().then(function() {
                    socket.emit('REGISTERED', '');
                    console.log('Player ' + data.username + ' registered');
                })
                .catch(function(err) {
                    socket.emit('REGISTERFAILED', err);
                });
            }
        });
    });

    socket.on('SAVESTATS', function() {
        savePlayerStats(socket.id, false);
        socket.emit('SAVECONFIRMED', '');
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
            while(shootingDistance < map.tileSize * 2 && obgInsideMap(players[socket.id].beamEnd, 0)) {
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
                    players[playerHitID].health -= 5;
                    if(players[playerHitID].health <= 0) {
                        players[playerHitID].respawnPlayer(map);
                    }
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
        
        //MOVES PLAYER
        let possibleMove = new U.Point(players[socket.id].location.x + data.move.x * players[socket.id].moveSpeed, players[socket.id].location.y + data.move.y * players[socket.id].moveSpeed);
        if(obgInsideMap(new U.Point(possibleMove.x, 0), map.tileSize)) { 
            players[socket.id].location.x = possibleMove.x;
        }
        if(obgInsideMap(new U.Point(0, possibleMove.y), map.tileSize)) { 
            players[socket.id].location.y = possibleMove.y;
        }
        //REMOVES ANY SOLID BLOCKS FROM PLAYERS LOCATION, IF TILE IS SHARD ADDS SHARD TO PLAYER
        let thisTile = getTileCoordinates(getPlayerCenter(socket.id));  
        if(map.tile[thisTile.x][thisTile.y] == 4) {
            players[socket.id].uranium += 1;
        }
        map.pushTileUpdate(thisTile, 0);    
        
        //PLACES BLOCKS THAT PLAYER WANTS TO PLACE
        if(data.tile !== null && insideMap(data.tile)) {
            map.pushTileUpdate(data.tile, 1);
        }

        //BUTTON CLICKED
        if(data.clickedButtonID != null) {
            if(data.clickedButtonID == 0 && players[socket.id].healthRegen > 0) {
                players[socket.id].tryChangeStats(-1, 0);
            } else if(data.clickedButtonID == 1 && players[socket.id].uranium > 0) {
                players[socket.id].tryChangeStats(1, 0);
            } else if(data.clickedButtonID == 2 && players[socket.id].moveSpeed > 1) {
                players[socket.id].tryChangeStats(0, -1);
            } else if(data.clickedButtonID == 3 && players[socket.id].uranium > 0) {
                players[socket.id].tryChangeStats(0, 1);
            }
        }   
    });

});

function serverTick() {
    //HEALTH REGEN
    for(id in players) {
        if(players[id].health < 100) {
            players[id].health += players[id].healthRegen;
        }
    }
    
    //NETWORKING
    packet = {
        updatedTiles: map.updatedTiles,
        updatedTileTypes: map.updatedTileTypes,
        players: players,
        chat: null
    }
    if(chat.chatUpdated) {
        packet.chat = chat.messages;
    }

    chat.chatUpdated = false;
    map.clearTileUpdates();

    io.sockets.emit('SERVERPACKET', packet);
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

function obgInsideMap(p, objSize) {
    if(p.x >= 0 && p.x + objSize <= map.width * map.tileSize && p.y >= 0 && p.y + objSize <= map.height * map.tileSize) {
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

