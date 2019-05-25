const express = require('express');
const socket = require('socket.io');
const crypto = require('crypto');
const U = require('./Uranium2DServerEngine');
const mongoose = require('mongoose');

//APP SETUP
let serverPort = process.env.POR || 8080;
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
mongoose.connect('mongodb+srv://PlanetUraniumUser:UraniumPlanetPass@planeturanium-qscto.mongodb.net/test?retryWrites=true', {useNewUrlParser: true, useCreateIndex: true}, function (err) {
   if (err) throw err;
   console.log('Connected to database');
});
mongoose.connection.on('disconnected', function () {  
    console.log('Connection lost to database, shutting down'); 
    shutdownServer('connection lost to database', 5);
});

const userData = require('./userdata');
//RESET DB
//userData.deleteMany({type: String}, function(err) {});

userData.find(function(err, users) {
    let usernameList = '';
    for(let i in users) {
        usernameList += users[i].username + ', '

        //users[i].character = 1;

        users[i].save();
    }
    console.log('Registered users: ' + usernameList);
});

let players = {};
let scoreboards = {};
let map = {};

let chat = new U.Chat(300);
chat.addMessage("SERVER", "Server started successfully", "red");

//TIMERS
mapReset();
databaseUpdater();
setInterval(databaseUpdater, 60000 * 5); //AUTOSAVES ALL PLAYERS AND UPDATES SCOREBOARDS EVERY 5 MINUTES
setInterval(mapReset, 60000 * 15); //RESETS MAP EVERY 15 MINUTES
setInterval(serverTick, 1000 / 70);

io.on('connection', function(socket) {

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

        //CHECKS THAT USERNAME IS NOT ALREADY INGAME
        for(let id in players) {
            if(players[id].username === data.username) {
                socket.emit('LOGINFAILED', 'You are already logged in.');
                return;
            }
        }

        userData.findOne({username: data.username}, function(err, user) {
            if(err) {
                socket.emit('LOGINFAILED', 'Wrong username or password.');
                return;
            }
            if(user && user.password === passwordHash) {
                players[socket.id] = new U.Player(user.username, user.character, user.uranium, user.healthRegen, user.moveSpeed, user.beamLenght, user.kills);
                players[socket.id].respawnPlayer(map);
                socket.emit('LOGGED', {
                    socketID: socket.id,
                    map: map,
                    players: players,
                    chat: chat.messages
                });
            } else {
                socket.emit('LOGINFAILED', 'Wrong username or password.');
            }
        });
    });

    socket.on('REGISTER', function(data) {
        let passwordHash = hash256(data.password);

        if(!onlyLetters(data.username) || data.username.length < 6 || data.username.length > 20 ) {
            socket.emit('REGISTERFAILED', 'Username can only contain letters and numbers and it must be between 6 and 20 characters long.')
            return;
        }

        if(isNaN(data.character) || data.character < 0 || data.character > 3) {
            socket.emit('REGISTERFAILED', 'You have to select a character.');
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
                    character: data.character,
                    uranium: 0,
                    healthRegen: 1,
                    moveSpeed: 5,
                    beamLenght: 3,
                    kills: 0
                });

                newUser.save().then(function() {
                    socket.emit('REGISTERED', '');
                    console.log('Player ' + data.username + ' registered');
                })
                .catch(function(err) {
                    //console.log(err);
                    socket.emit('REGISTERFAILED', err);
                });
            }
        });
    });

    socket.on('SAVESTATS', function() {
        savePlayerStats(socket.id, false).then(function(result) {
            if(result) {
                socket.emit('ALERT', {title: 'Server', text: 'Save successful'});
            } else {
                socket.emit('ALERT', {title: 'Server', text: 'Saving failed, try again'});
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
            while(shootingDistance < (map.tileSize / 5) * players[socket.id].beamLenght && obgInsideMap(players[socket.id].beamEnd, 0)) {
                //TEST IF HIT BLOCK
                let thisTile = getTileCoordinates(players[socket.id].beamEnd);
                if(thisTile) {
                    if(map.tile[thisTile.x][thisTile.y] !== 0) {
                        break;
                    }
                }
                //TEST IF PLAYER HIT AND NOT IN SAFE ZONE
                let playerHitID = getPlayersInRadius(socket.id , players[socket.id].beamEnd, map.tileSize / 2);
                if(playerHitID) {
                    let safeTile = getTileCoordinates(getPlayerCenter(playerHitID));  
                    if(!map.safeZone[safeTile.x][safeTile.y]) {
                        players[playerHitID].health -= 5;
                        if(players[playerHitID].health <= 0) {
                            let deathLoc = getTileCoordinates(players[playerHitID].location);
                            players[playerHitID].respawnPlayer(map);

                            players[socket.id].kills += 1;
                            //ADDS URANIUM TO THE GROUND
                            for(let y = deathLoc.y - 1; y <= deathLoc.y + 1; y++) {
                                for(let x = deathLoc.x - 1; x <= deathLoc.x + 1; x++) {
                                    map.pushTileUpdate(new U.Point(x, y), 3);
                                }
                            }

                            chat.addMessage("INFO", players[playerHitID].username + " was killed by " + players[socket.id].username, "yellow");
                        }
                        break;
                    }
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
        //REMOVES ANY SOLID BLOCKS FROM PLAYERS LOCATION, IF TILE IS SHARD ADDS SHARD TO PLAYER, IF TILE IS SIGN SENDS ALERT WITH SIGN TEXT
        let thisTile = getTileCoordinates(getPlayerCenter(socket.id));  
        if(map.tile[thisTile.x][thisTile.y] == 4) {
            //SHOWS SIGN TEXT ONLY ONCE
            if(!players[socket.id].signShown) {
                players[socket.id].signShown = true;
                socket.emit('ALERT', {title: 'Sign', text: map.signText[thisTile.x][thisTile.y]});
            }
        } else {
            players[socket.id].signShown = false;
            if(map.tile[thisTile.x][thisTile.y] == 3) {
                players[socket.id].uranium += 1;
            }   
        }
        map.pushTileUpdate(thisTile, 0);
        
        //PLACES BLOCKS IF NOT SIGN
        if(data.tile !== null && insideMap(data.tile)) {
            map.pushTileUpdate(data.tile, 1);
        }

        //BUTTON CLICKED
        if(data.clickedButtonID != null) {
            if(data.clickedButtonID == 0) {
                players[socket.id].tryChangeStats(-1, 0, 0);
            } else if(data.clickedButtonID == 1) {
                players[socket.id].tryChangeStats(1, 0, 0);
            } else if(data.clickedButtonID == 2) {
                players[socket.id].tryChangeStats(0, -1, 0);
            } else if(data.clickedButtonID == 3) {
                players[socket.id].tryChangeStats(0, 1, 0);
            } else if(data.clickedButtonID == 4) {
                players[socket.id].tryChangeStats(0, 0, -1);
            } else if(data.clickedButtonID == 5) {
                players[socket.id].tryChangeStats(0, 0, 1);
            } else if(data.clickedButtonID == 6) {
                socket.emit('SCOREBOARD', {
                    type: 0,
                    scoreboard: scoreboards.uranium
                });
            } else if(data.clickedButtonID == 7) {
                socket.emit('SCOREBOARD', {
                    type: 1,
                    scoreboard: scoreboards.kills
                });
            }
        }   
    });

    socket.on('ADMINLOGIN', function(data) {
        if(data === 'admin') {
            let userinfos = [];
            userData.find(function(err, users) {
                for(let i in users) {
                    userinfos.push([users[i].username, users[i].character, users[i].uranium, users[i].healthRegen, users[i].moveSpeed, users[i].beamLenght, users[i].kills]);
                }
                socket.emit('ADMINLOGGED', userinfos); 
            });
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

function databaseUpdater() {
    let playersCount = Object.keys(players).length;
    let playersSaved = 0;
    for(id in players) {
        savePlayerStats(id, false).then(function(result) {
            if(result) {
                playersSaved++;
            } else {
                chat.addMessage("SERVER", "Failed to autosave " + players[id].username, "red");
            }
            if(playersSaved >= playersCount) {
                chat.addMessage("SERVER", "All " + playersSaved + " players autosaved", "red");
            }
        });
    }

    //UPDATES SCOREBOARDS AFTER 10 SECONDS
    setTimeout(function() {
        //URANIUM
        getTopUsers({uranium: -1}, 10).then(function(users) {
            if(users) {
                scoreboards.uranium = [];
                for(let i in users) {
                    scoreboards.uranium.push([users[i].username, users[i].uranium]);
                }
            }
        });

        //KILLS
        getTopUsers({kills: -1}, 10).then(function(users) {
            if(users) {
                scoreboards.kills = [];
                for(let i in users) {
                    scoreboards.kills.push([users[i].username, users[i].kills]);
                }
            }
        });
    }, 10000);
}

function mapReset() {
    map = new U.Map(30, 100, 100);
    map.addTiles(2, 2);
    map.addTiles(3, 1);
    //SPAWN AREA
    map.setSafeZone(true, new U.Point(0, 0), new U.Point(16, 16));
    map.tile[14][0] = 2; map.tile[0][14] = 2; map.tile[0][0] = 2; map.tile[14][14] = 2;
    map.addSign('Controls:<br>Move: WASD<br>Shoot: SPACE<br>Place blocks: LEFT MOUSE', new U.Point(0, 4));
    map.addSign("You can delete blocks by just walking over them if you aren't in the safe zone. Hovever you can't shoot through blocks.", new U.Point(0, 10));
    map.addSign('You can get Uranium by collecting it from the ground or by killing players.', new U.Point(4, 0));
    map.addSign('With Uranium you can buy upgrades from the top menu. The prices increase with formula x^2.', new U.Point(10, 0));
    map.addSign('You are entering/leaving the safe zone.<br>Good luck!', new U.Point(7, 14));
    map.addSign('You are entering/leaving the safe zone.<br>Good luck!', new U.Point(14, 7));

    io.sockets.emit('RESETMAP', map);
    chat.addMessage("SERVER", "Map reset complete", "red");
}

function getTopUsers(sort, limit) {
    return new Promise(function(resolve) {
        userData.find(function(err, users) {
            if(err) {
                resolve(false);
            } else {
                resolve(users);
            }
        }).sort(sort).limit(limit);
    });
}

function savePlayerStats(id, deleteStatsFromMemory) {
    return new Promise(function(resolve) {
        if(players[id] === undefined) {
            resolve(false);
        }
        userData.findOne({username: players[id].username}, function(err, user) {
            if(err) {
                resolve(false);
            } else {
                user.uranium = players[id].uranium;
                user.healthRegen = players[id].healthRegen;
                user.moveSpeed = players[id].moveSpeed;
                user.beamLenght = players[id].beamLenght;
                user.kills = players[id].kills;
                user.save();

                if(deleteStatsFromMemory) {
                    delete players[id];
                }
                resolve(true);
            }
        });
    });
}

function shutdownServer(reason, seconds) {
    io.sockets.emit('ALERT', 'Server shutting down in ' + seconds + ' seconds becouse ' + reason);
    setTimeout(function() {
        process.exit();
    }, 1000 * seconds)
}

function getPlayersInRadius(self ,location, searchRadius) {
    for(let id in players) {
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

