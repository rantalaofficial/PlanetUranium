import * as GM from '/gameModule.js';

let username;
let password;

let targetFPS = 60;
let fps = 0;
let fpsCounter = 0;

let gameWidth = 1200;
let gameHeight = 700;
let gameCanvas;
let ctx;
let bufferCanvas;
let bufferCTX;

//MAP
let map = new GM.Map(30, 30, 30);
let starsX = [];
let starsY = [];
let starSize = 3;
for(let y = 0; y <= gameHeight; y += starSize) {
    for(let x = 0; x <= gameWidth; x += starSize) {
        if(Math.random() * 1000 < 1) {
            starsX.push(x);
            starsY.push(y);
        }
    }
}

//TEXTURES/ TILES
let textures = [];
textures.push(new GM.Texture('/recources/0.png', false, new GM.Point(0, 0)));
textures.push(new GM.Texture('/recources/1.png', true, new GM.Point(0, -16)));
textures.push(new GM.Texture('/recources/2.png', false, new GM.Point(0, 0)));
textures.push(new GM.Texture('/recources/3.png', true, new GM.Point(-30, -60)));
textures.push(new GM.Texture('/recources/4.png', true, new GM.Point(0, 0)));

//PLAYER
let players = {};

let moveDirection = new GM.Point(0, 0);

let shooting = false;
let shootingDirection = new GM.Point(0, 0);

let placedTile = null;

//CONTROLS
let keys = [];
$(document).on('keydown', function(e) {
    keys[e.keyCode] = true;
});
$(document).on('keyup', function(e) {
    keys[e.keyCode] = false;
});
let mousePos = new GM.Point(0, 0);

let mouseTimer;
let loopTimer;

//NETWORKING
let packet;
let socketID;

$(document).ready(function() {
    if(typeof document.cookie === 'undefined') {
        location.href = 'index.html';
    } else {
        let logindata = document.cookie.split(' ');
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
        let position = gameCanvas.getBoundingClientRect()
        mousePos = new GM.Point(event.pageX - position.left, event.pageY - position.top);
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
    moveDirection = new GM.Point(0,0);
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

    //IF PACKET IS MORE THAN 1 SECOND OLD DISCARDS IT
    let date = new Date();
    let timestamp = date.getTime();
    if(data.timestamp - timestamp > 1000) {
        return;
    }

    for(let y = 0; y < map.height; y++) {
        for(let x = 0; x < map.width; x++) {
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
    for(let i = 0; i < starsX.length; i++) {
        bufferCTX.fillRect(starsX[i], starsY[i], starSize, starSize);
    }
    //TILES, DRAWS ON TOP TILES LAST
    let onTopTiles = [];
    for(let y = 0; y < map.height; y++) {
        for(let x = 0; x < map.width; x++) {
            let absolutePos = getTilePosition(new GM.Point(x, y));
            let tileType = map.tile[x][y];
            if(textures[tileType].isOnTop) {
                bufferCTX.drawImage(textures[0].image, absolutePos.x + textures[0].offset.x, absolutePos.y + textures[0].offset.y);
                onTopTiles.push(new GM.Point(x, y));
            } else {
                bufferCTX.drawImage(textures[tileType].image, absolutePos.x + textures[tileType].offset.y, absolutePos.y + textures[tileType].offset.y);
            }
        }
    }
    
    for(let id in players) {
        //PLAYERS
        let loc = getAbsolutePosition(players[id].location); 
        bufferCTX.font = "15px Arial";
        bufferCTX.fillText(players[id].username ,loc.x, loc.y);
        bufferCTX.drawImage(textures[2].image, loc.x, loc.y);

        //BEAMS
        if(players[id].beamStart !== null) {
            bufferCTX.strokeStyle = 'red';
            bufferCTX.lineWidth = 10;
            bufferCTX.beginPath();
            let beamStart = getAbsolutePosition(players[id].beamStart);
            let beamEnd = getAbsolutePosition(players[id].beamEnd);
            bufferCTX.moveTo(beamStart.x, beamStart.y);
            bufferCTX.lineTo(beamEnd.x, beamEnd.y);
            bufferCTX.stroke();
        }
    }  

    //DRAWS BIG TILES
    if(onTopTiles.length > 0) {
        for(let i = 0; i < onTopTiles.length; i++) {
            let loc = onTopTiles[i];
            let tileType = map.tile[loc.x][loc.y];
            let absolutePos = getTilePosition(new GM.Point(loc.x, loc.y)); 
            bufferCTX.drawImage(textures[tileType].image, absolutePos.x + textures[tileType].offset.x, absolutePos.y + textures[tileType].offset.y);
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
    let absoluteX = p.x * map.tileSize - players[socketID].location.x + gameWidth / 2;
    let absoluteY = p.y * map.tileSize - players[socketID].location.y + gameHeight / 2;
    return new GM.Point(absoluteX, absoluteY);
} 

function getAbsolutePosition(p) {
    let absoluteX = p.x - players[socketID].location.x + gameWidth / 2;
    let absoluteY = p.y - players[socketID].location.y + gameHeight / 2;
    return new GM.Point(absoluteX, absoluteY);
}

function mouseDown() {
    let pos = getTileCoordinates(mousePos);
    //CHECKS THAT PLACE IS INSIDE MAX PLACING DISTANCE
    if(pos) {
        placedTile = pos;
    }
}

function getTileCoordinates(p) {
    for(let y = 0; y <= map.height; y++) {
        for(let x = 0; x <= map.width; x++) {
            let absolutePos = getTilePosition(new GM.Point(x, y));
            if(p.x >= absolutePos.x && p.x < absolutePos.x + map.tileSize && p.y >= absolutePos.y && p.y < absolutePos.y + map.tileSize) {
                return new GM.Point(x, y);
            }
        }
    }
    return false;
}

function objectsEqual(a, b) {
    let aProps = Object.getOwnPropertyNames(a);
    let bProps = Object.getOwnPropertyNames(b);
    if (aProps.length != bProps.length) {
        return false;
    }
    for (let i = 0; i < aProps.length; i++) {
        let propName = aProps[i];
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