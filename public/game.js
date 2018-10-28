var username;
var password;

var targetFPS = 60;
var fps = 0;
var fpsCounter = 0;

var gameWidth = 1000;
var gameHeight = 600;
var gameCanvas;
var ctx;
var bufferCanvas;
var bufferCTX;

//MAP
var tileSize = 30;
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
for(var i = 0; i <= 3; i++) {
    textures[i] = new Image();
    textures[i].src = "/tiles/" + i + ".png";
}
var solidTiles = [1, 2];

//PLAYER
var placingDistance = 8;
var shootingDistance = 14;
var movementSpeed = 5;

var usernames = {}
var playersX = {};
var playersY = {};
var movementUpdates = 0;
var moveDirectionX; 
var moveDirectionY; 
var playerTile;
var shooting = false;
var shootingDistance = 14;
var shootingDirectionX;
var shootingDirectionY;

//CONTROLS
var keys = [];
$(document).on('keydown', function(e) {
    keys[e.keyCode] = true;
});
$(document).on('keyup', function(e) {
    keys[e.keyCode] = false;
});
var mouseX, mouseY;
var mouseTimer;

//NETWORKING
var packet;
var lastPacket;
var placedTileX = null;
var placedTileY = null;
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
        mouseX = event.pageX - position.left;
        mouseY = event.pageY - position.top;
    });
    $(document).mousedown(function() {
        mouseTimer = setInterval(mouseDown, 1000 / targetFPS);
    });
    $(document).mouseup(function() {
        clearInterval(mouseTimer);
    });

    //INTERVALS
    setInterval(secTimer, 1000);
    setInterval(loop, 1000 / targetFPS);
});

socket.on('LOGINFAILED', function(data) {
    location.href = 'index.html';
});

function loop() {
    fpsCounter += 1;

    //MOVEMENT
    movementUpdates++
    moveDirectionX = 0;
    moveDirectionY = 0;
    if(movementUpdates > 10 - movementSpeed) {
        movementUpdates = 0;
        if(keys[87]) {moveDirectionY = -1; movedY = true;} 
        if(keys[65]) {moveDirectionX = -1; movedX = true; } 
        if(keys[83]) {moveDirectionY = 1; movedY = true;} 
        if(keys[68]) {moveDirectionX = 1; movedX = true;}

        if(moveDirectionX != 0 || moveDirectionY != 0) {
            shootingDirectionX = moveDirectionX;
            shootingDirectionY = moveDirectionY;
        }
    }
    //SHOOTING
    if(keys[32]) {
        shooting = true;
    } else {
        shooting = false;
    }

    playerTile = getTileCoordinates(gameCanvas.width / 2 + tileSize / 2, gameCanvas.height / 2 + tileSize / 2);
    sendPacket();
}

//NETWORKING
function sendPacket() {
    packet = {
        moveX: moveDirectionX,
        moveY: moveDirectionY,
        tileX: placedTileX,
        tileY: placedTileY,
        shooting: shooting
    }
    placedTileX = null;
    placedTileY = null;
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

    for(var y = 0; y < mapWidth; y++) {
        for(var x = 0; x < mapHeight; x++) {
            map[x][y] = data.map[x][y];
        }
    }

    usernames = data.usernames;
    playersX = data.playersX;
    playersY = data.playersY;

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
    //TILES
    for(var y = 0; y < mapHeight; y++) {
        for(var x = 0; x < mapWidth; x++) {
            var absolutePos = getAbsolutePosition(x, y);   
            bufferCTX.drawImage(textures[map[x][y]], absolutePos[0], absolutePos[1]);
        }
    }
    //PLAYERS
    for(var id in playersX) {
        var absolutePos = getAbsolutePosition(playersX[id], playersY[id]); 

        bufferCTX.font = "15px Arial";
        bufferCTX.fillText(usernames[id] ,absolutePos[0], absolutePos[1]);

        bufferCTX.drawImage(textures[2], absolutePos[0], absolutePos[1]);
    }  
    
    //SHOOTING BEAM
    if(shooting) {
        var beamDistance = getMaxShootingDistance();
        if(beamDistance > 1) {        
            bufferCTX.strokeStyle = 'red';
            bufferCTX.lineWidth = 10;
            bufferCTX.beginPath();
            var startingPos = getAbsolutePosition(playersX[socketID] + shootingDirectionX, playersY[socketID] + shootingDirectionY)
            var endingPos = getAbsolutePosition(playersX[socketID] + shootingDirectionX * beamDistance, playersY[socketID] + shootingDirectionY * beamDistance);
            startingPos[0] += tileSize / 2;
            endingPos[0] += tileSize / 2;
            startingPos[1] += tileSize / 2;
            endingPos[1] += tileSize / 2;
            bufferCTX.moveTo(startingPos[0], startingPos[1]);
            bufferCTX.lineTo(endingPos[0], endingPos[1]);
            bufferCTX.stroke();
            bufferCTX.lineWidth = 1;
        }
    }

    //MOUSE POINTER
    bufferCTX.fillStyle = 'white';
    bufferCTX.fillRect(mouseX, mouseY, 5, 5);

    //INFO
    bufferCTX.font = "20px Arial";
    bufferCTX.fillText("FPS:" + fps + " x: " + playersX[socketID] + " y: " + playersY[socketID], 2, 20);
    ctx.drawImage(bufferCanvas, 0, 0);
}

function getMaxShootingDistance() {
    var maxShootingDistance = 0;
    var x = playersX[socketID]
    var y = playersX[socketID]
    while(maxShootingDistance <= shootingDistance) {
        if(x < 0 || y < 0 || x > mapWidth || y > mapHeight) {
            return shootingDistance;
        }

        if(!solidTiles.includes(map[x][y])) {
            maxShootingDistance++;
        } else {
            return maxShootingDistance;
        }

        x += shootingDirectionX;
        y += shootingDirectionY;
    }

    return maxShootingDistance;
}

function getAbsolutePosition(x, y) {
    var absoluteX = x * tileSize - playersX[socketID] * tileSize + gameWidth / 2;
    var absoluteY = y * tileSize - playersY[socketID] * tileSize + gameHeight / 2;
    return [absoluteX, absoluteY];
} 

function mouseDown() {
    var pos = getTileCoordinates(mouseX, mouseY);
    //CHECKS THAT PLACE IS INSIDE MAX PLACING DISTANCE
    if(pos) {
        if(Math.abs(playersX[socketID] - pos[0]) <= placingDistance && Math.abs(playersY[socketID] - pos[1]) <= placingDistance) {
            placedTileX = pos[0];
            placedTileY = pos[1];
        }
    }
}

function getTileCoordinates(locX, locY) {
    for(var y = 0; y <= mapHeight; y++) {
        for(var x = 0; x <= mapWidth; x++) {
            var absolutePos = getAbsolutePosition(x,y);
            if(locX >= absolutePos[0] && locX < absolutePos[0] + tileSize && locY >= absolutePos[1] && locY < absolutePos[1] + tileSize) {
                return [x, y];
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