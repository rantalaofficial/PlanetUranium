var username;
var password;

var targetFPS = 60;
var fps = 0;
var fpsCounter = 0;

var gameWidth = 1200;
var gameHeight = 700;
var gameCanvas;
var ctx;
var bufferCanvas;
var bufferCTX;

//MAP
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
}
var map = new Map(30, 100, 100);

var starsX = [];
var starsY = [];
var starSize = 3;
for(var y = 0; y <= gameHeight; y += starSize) {
    for(var x = 0; x <= gameWidth; x += starSize) {
        if(Math.random() * 1000 < 1) {
            starsX.push(x);
            starsY.push(y);
        }
    }
}

//TEXTURES/ TILES
var textures = [];
var textureOffsetsX = [];
var textureOffsetsY = [];
for(var i = 0; i <= 5; i++) {
    textureOffsetsX[i] = 0;
    textureOffsetsY[i] = 0;
    textures[i] = new Image();
    textures[i].src = "/tiles/" + i + ".png";
}
textureOffsetsY[1] = -16;
textureOffsetsX[3] = -30;
textureOffsetsY[3] = -60;
textureOffsetsY[5] = -160;
textureOffsetsY[5] = -50;
var bigTiles = [1, 3, 4, 5]
var solidTiles = [1, 2];

//PLAYER
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
    constructor(username, location, moveSpeed, beamStart, beamEnd) {
        this.username = username;
        this.location = location;
        this.moveSpeed = moveSpeed;

        this.beamStart = beamStart;
        this.beamEnd = beamEnd;
    }
}
var players = {};

var placingDistance = 8;
var shootingDistance = 14;
var movementSpeed = 5;

var movementUpdates = 0;
var moveDirection = new Point(0, 0);

var shooting = false;
var shootingDistance = 14;
var shootingDirection = new Point(0, 0);

var placedTile = null;

//CONTROLS
var keys = [];
$(document).on('keydown', function(e) {
    keys[e.keyCode] = true;
});
$(document).on('keyup', function(e) {
    keys[e.keyCode] = false;
});
var mousePos = new Point(0, 0);

var mouseTimer;
var loopTimer;

//NETWORKING
var packet;
var lastPacket;
var socketID;

$(document).ready(function() {
    if(typeof document.cookie === 'undefined') {
        location.href = 'index.html';
    } else {
        var logindata = document.cookie.split(' ');
        if(logindata.length < 2) {
            location.href = 'index.html';
        }
        username = logindata[0];
        password = logindata[1];

        //SENDS LOGIN REQUEST TO CHECK THAT IS LOGGED IN
        socket.emit('LOGIN', {
            username: username,
            password: password
        });
    }
});

socket.on('LOGGED', function(data) {
    socketID = data;
    $('#loginInfoText').text('Logged in as: ' + username);

    //INIT CANVAS
    gameCanvas = document.getElementById('gameCanvas');
    gameCanvas.width = gameWidth;
    gameCanvas.height = gameHeight;
    //gameCanvas.width = $(window).width();
    //gameCanvas.height = $(window).height();
    ctx = gameCanvas.getContext('2d');
    bufferCanvas = document.getElementById('bufferCanvas');
    bufferCanvas.width = gameWidth;
    bufferCanvas.height = gameHeight;
    bufferCTX = bufferCanvas.getContext('2d');

    //MOUSE
    $(document).mousemove(function(event) {
        var position = gameCanvas.getBoundingClientRect()
        mousePos = new Point(event.pageX - position.left, event.pageY - position.top);
    });
    $(document).mousedown(function() {
        mouseTimer = setInterval(mouseDown, 1000 / targetFPS);
    });
    $(document).mouseup(function() {
        clearInterval(mouseTimer);
    });

    //INTERVALS
    setInterval(secTimer, 1000);
    loopTimer = setInterval(loop, 1000 / targetFPS);
});

socket.on('LOGINFAILED', function(data) {
    location.href = 'index.html';
});

socket.on('disconnect', function() {
    location.href = 'index.html';
});

function loop() {
    fpsCounter += 1;

    //MOVEMENT
    moveDirection = new Point(0,0);
    if(keys[87]) {moveDirection.y = -1;} 
    if(keys[65]) {moveDirection.x = -1;} 
    if(keys[83]) {moveDirection.y = 1;} 
    if(keys[68]) {moveDirection.x = 1;}
    //SHOOTING
    if(moveDirection.x !== 0 || moveDirection.y !== 0) {
        shootingDirection = moveDirection;
    }
    if(keys[32]) {
        shooting = true;
    } else {
        shooting = false;
    }

    sendPacket();
}

//NETWORKING
function sendPacket() {
    packet = {
        move: moveDirection,
        shoot: shootingDirection,
        tile: placedTile,
        shooting: shooting
    }
    placedTile = null;
    /*
    if(!objectsEqual(packet, lastPacket)) {
        
        lastPacket = jQuery.extend(true, {}, packet);
    }
    */
    socket.emit('PLAYERPACKET', packet);
}

socket.on('SERVERPACKET', function(data) {
    if(!socketID) {
        return;
    }

    for(var y = 0; y < map.height; y++) {
        for(var x = 0; x < map.width; x++) {
            map.tile[x][y] = data.map.tile[x][y];
        }
    }
    players = data.players

    drawGrapichs();
});

function drawGrapichs() {
    //SPACE AND STARS
    bufferCTX.fillStyle = 'black';
    bufferCTX.fillRect(0,0, gameCanvas.width, gameCanvas.height);
    bufferCTX.fillStyle = 'white';
    for(var i = 0; i < starsX.length; i++) {
        bufferCTX.fillRect(starsX[i], starsY[i], starSize, starSize);
    }
    //TILES, DRAWS BIG TILES LAST SO THAT THEY ARE ON TOP
    var bigTileLoc = [];
    for(var y = 0; y < map.height; y++) {
        for(var x = 0; x < map.width; x++) {
            var absolutePos = getTilePosition(new Point(x, y));
            var tileType = map.tile[x][y];
            if(bigTiles.includes(tileType)) {
                //DRAWS GROUND TO BIG TILES
                bufferCTX.drawImage(textures[0], absolutePos.x + textureOffsetsX[0], absolutePos.y + textureOffsetsY[0]);
                bigTileLoc.push(new Point(x, y));
            } else {
                bufferCTX.drawImage(textures[tileType], absolutePos.x + textureOffsetsX[tileType], absolutePos.y + textureOffsetsY[tileType]);
            }
        }
    }
    
    for(var id in players) {
        //PLAYERS
        var loc = getAbsolutePosition(players[id].location); 
        bufferCTX.font = "15px Arial";
        bufferCTX.fillText(players[id].username ,loc.x, loc.y);
        bufferCTX.drawImage(textures[2], loc.x, loc.y);

        //BEAMS
        if(players[id].beamStart !== null) {
            bufferCTX.strokeStyle = 'red';
            bufferCTX.lineWidth = 10;
            bufferCTX.beginPath();
            var beamStart = getAbsolutePosition(players[id].beamStart);
            beamStart = Point.add(beamStart, new Point(map.tileSize / 2, map.tileSize / 2))

            var beamEnd = getAbsolutePosition(players[id].beamEnd);
            beamEnd = Point.add(beamEnd, new Point(map.tileSize / 2, map.tileSize / 2))

            console.log(beamStart);
            console.log(beamEnd);

            bufferCTX.moveTo(beamStart.x, beamStart.y);
            bufferCTX.lineTo(beamEnd.x, beamEnd.y);
            bufferCTX.stroke();
        }
    }  

    //DRAWS BIG TILES
    if(bigTileLoc.length > 0) {
        for(var i = 0; i < bigTileLoc.length; i++) {
            var loc = bigTileLoc[i];
            var tileType = map.tile[loc.x][loc.y];
            var absolutePos = getTilePosition(new Point(loc.x, loc.y)); 
            bufferCTX.drawImage(textures[tileType], absolutePos.x + textureOffsetsX[tileType], absolutePos.y + textureOffsetsY[tileType]);
        }
    }
    
    //MOUSE POINTER
    bufferCTX.fillStyle = 'white';
    bufferCTX.fillRect(mousePos.x, mousePos.y, 5, 5);

    //INFO
    bufferCTX.font = "20px Arial";
    bufferCTX.fillText("FPS:" + fps + " x: " + players[socketID].location.x + " y: " + players[socketID].location.y, 2, 20);
    ctx.drawImage(bufferCanvas, 0, 0);
}

function getTilePosition(p) {
    var absoluteX = p.x * map.tileSize - players[socketID].location.x + gameWidth / 2;
    var absoluteY = p.y * map.tileSize - players[socketID].location.y + gameHeight / 2;
    return new Point(absoluteX, absoluteY);
} 

function getAbsolutePosition(p) {
    var absoluteX = p.x - players[socketID].location.x + gameWidth / 2;
    var absoluteY = p.y - players[socketID].location.y + gameHeight / 2;
    return new Point(absoluteX, absoluteY);
}

function mouseDown() {
    var pos = getTileCoordinates(mousePos);
    //CHECKS THAT PLACE IS INSIDE MAX PLACING DISTANCE
    if(pos) {
        placedTile = pos;
    }
}

function getTileCoordinates(p) {
    for(var y = 0; y <= map.height; y++) {
        for(var x = 0; x <= map.width; x++) {
            var absolutePos = getTilePosition(new Point(x, y));
            if(p.x >= absolutePos.x && p.x < absolutePos.x + map.tileSize && p.y >= absolutePos.y && p.y < absolutePos.y + map.tileSize) {
                return new Point(x, y);
            }
        }
    }
    return false;
}

function objectsEqual(a, b) {
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);
    if (aProps.length != bProps.length) {
        return false;
    }
    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];
        if (a[propName] !== b[propName]) {
            return false;
        }
    }
    return true;
}

function secTimer() {
    fps = fpsCounter
    fpsCounter = 0;
}