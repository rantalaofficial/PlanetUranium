import * as U from '/Uranium2DEngine.js';

let username;
let password;

let targetFPS = 60;
let fps = 0;
let fpsCounter = 0;

let gameWidth = 1200;
let gameHeight = 700;
//RENDERS ONLY STUFF THAT IS INSIDE GAME
let extraDrawDistance = 100; //PIXELS
let gameCanvas;
let ctx;
let bufferCanvas;
let bufferCTX;

//GAME
let map;
let players = {};
let stars = []
let starSize = 3;
for(let y = 0; y <= gameHeight; y += starSize) {
    for(let x = 0; x <= gameWidth; x += starSize) {
        if(Math.random() * 1000 < 1) {
            stars.push(new U.Point(x, y));
        }
    }
}

//TEXTURES/ TILES
let textures = [];
textures.push(new U.Texture('/recources/0.png', false, new U.Point(0, 0)));
textures.push(new U.Texture('/recources/1.png', true, new U.Point(0, -16)));
textures.push(new U.Texture('/recources/2.png', false, new U.Point(0, 0)));
textures.push(new U.Texture('/recources/3.png', true, new U.Point(-30, -60)));
textures.push(new U.Texture('/recources/4.png', true, new U.Point(0, 0)));

let moveDirection = new U.Point(0, 0);
let shooting = false;
let shootingDirection = new U.Point(0, 0);
let placedTile = null;

let chatMessage = null;
let chatShown = false;

//CONTROLS
let keys = [];
let mousePos = new U.Point(0, 0);
let mouseTimer;

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
    socketID = data.socketID;
    $('#loginInfoText').text('Logged in as: ' + username);

    //INIT CANVAS
    gameCanvas = document.getElementById('gameCanvas');
    gameCanvas.width = gameWidth;
    gameCanvas.height = gameHeight;
    ctx = gameCanvas.getContext('2d');
    bufferCanvas = document.getElementById('bufferCanvas');
    bufferCanvas.width = gameWidth;
    bufferCanvas.height = gameHeight;
    bufferCTX = bufferCanvas.getContext('2d');

    //MOUSE
    $(document).mousemove(function(event) {
        let position = gameCanvas.getBoundingClientRect()
        mousePos = new U.Point(event.pageX - position.left, event.pageY - position.top);
    });
    $(document).mousedown(function(e) {
        if(e.target.id == "gameCanvas") {
            //DETECTS CLICKS ONLY ON CANVAS
            mouseTimer = setInterval(mouseDown, 1000 / targetFPS);
        }
    });
    $(document).mouseup(function(e) {
        clearInterval(mouseTimer);
    });

    //KEYS
    $(document).on('keydown', function(e) {
        keys[e.keyCode] = true;
    });
    $(document).on('keyup', function(e) {
        keys[e.keyCode] = false;
    });
    $('#chatMessageBox').keypress(function(e) {
        if(e.keyCode == '13' && $('#chatMessageBox').val().length > 0) {
            chatMessage = $('#chatMessageBox').val();
            $('#chatMessageBox').val('');
        }
    });

    //INIT GAME
    map = data.map;
    players = data.players;
    renderChat(data.chat);

    //INTERVALS
    setInterval(secTimer, 1000);
    setInterval(loop, 1000 / targetFPS);
});

socket.on('LOGINFAILED', function(data) {
    location.href = 'index.html';
});

socket.on('disconnect', function() {
    location.href = 'index.html';
});

function loop() {
    //CHAT
    if(keys[67]) {
        chatShown = true;
        $('#chatMessageBox').focus();
        $('#chatMessageBox').attr("placeholder", "Press ESC to hide chat");

        $('#chatContainer').css('opacity', '0.9');
        $('#chatContainer').css('pointer-events', 'all');
    } else if(keys[27]) {
        chatShown = false;
        $('#chatMessageBox').blur();
        $('#chatMessageBox').attr("placeholder", "Press C to chat");

        $('#chatContainer').css('opacity', '0.6');
        $('#chatContainer').css('pointer-events', 'none');
    }

    //GAME CONTROLS, CHECK ONLY WHEN CHAT NOT SHOWN
    moveDirection = new U.Point(0,0);
    if(chatShown == false) {
        if(keys[87]) {moveDirection.y = -1;} 
        if(keys[65]) {moveDirection.x = -1;} 
        if(keys[83]) {moveDirection.y = 1;} 
        if(keys[68]) {moveDirection.x = 1;}
        if(moveDirection.x !== 0 || moveDirection.y !== 0) {
            shootingDirection = moveDirection;
        }
        if(keys[32]) {shooting = true;} else {shooting = false;}
    }

    sendPacket();
    drawGrapichs();
}

//NETWORKING
function sendPacket() {
    packet = {
        move: moveDirection,
        shoot: shootingDirection,
        tile: placedTile,
        shooting: shooting,
        message: chatMessage
    }
    placedTile = null;
    chatMessage = null;
    socket.emit('PLAYERPACKET', packet);
}

socket.on('SERVERPACKET', function(data) {
    if(!socketID) {
        return;
    }

    if(data.updatedTiles) {
        for(var i = 0; i < data.updatedTiles.length; i++) {
            map.tile[data.updatedTiles[i].x][data.updatedTiles[i].y] = data.updatedTileTypes[i];
        }
    }
    players = data.players
    if(data.chat !== null) {
        renderChat(data.chat);
    }
});

function drawGrapichs() {
    fpsCounter += 1;
    //SPACE AND STARS
    bufferCTX.fillStyle = 'black';
    bufferCTX.fillRect(0,0, gameCanvas.width, gameCanvas.height);
    bufferCTX.fillStyle = 'white';
    for(let i = 0; i < stars.length; i++) {
        bufferCTX.fillRect(stars[i].x, stars[i].y, starSize, starSize);
    }
    //TILES, DRAWS ON TOP TILES LAST
    let onTopTiles = [];
    for(let y = 0; y < map.height; y++) {
        for(let x = 0; x < map.width; x++) {
            let absolutePos = getTilePosition(new U.Point(x, y));

            //IF OUTSIDE GAME SKIPS TO NEXT TILE
            if(!insideGameWindow(absolutePos)) {
                continue;
            }

            let tileType = map.tile[x][y];
            if(textures[tileType].isOnTop) {
                bufferCTX.drawImage(textures[0].image, absolutePos.x + textures[0].offset.x, absolutePos.y + textures[0].offset.y);
                onTopTiles.push(new U.Point(x, y));
            } else {
                bufferCTX.drawImage(textures[tileType].image, absolutePos.x + textures[tileType].offset.y, absolutePos.y + textures[tileType].offset.y);
            }
        }
    }
    
    for(let id in players) {
        //PLAYERS
        if(players[id].beamStart !== null) {
            bufferCTX = U.Player.drawBeam(bufferCTX, getAbsolutePosition(players[id].beamStart), getAbsolutePosition(players[id].beamEnd));
        }
        bufferCTX = U.Player.drawPlayer(bufferCTX, textures[2].image, players[id], players[socketID].location);
    }  

    //DRAWS BIG TILES
    if(onTopTiles.length > 0) {
        for(let i = 0; i < onTopTiles.length; i++) {
            let loc = onTopTiles[i];
            let tileType = map.tile[loc.x][loc.y];
            let absolutePos = getTilePosition(new U.Point(loc.x, loc.y)); 
            bufferCTX.drawImage(textures[tileType].image, absolutePos.x + textures[tileType].offset.x, absolutePos.y + textures[tileType].offset.y);
        }
    }
    
    //MOUSE POINTER
    bufferCTX.fillStyle = 'white';
    bufferCTX.fillRect(mousePos.x, mousePos.y, 5, 5);

    /*INFO TEXT 
    bufferCTX.font = "20px Arial";
    bufferCTX.fillText("FPS:" + fps + " x: " + players[socketID].location.x + " y: " + players[socketID].location.y, 2, 20);
    */

    ctx.drawImage(bufferCanvas, 0, 0);
}

function renderChat(messages) {
    let chatHTML = "";
    for(let i = 0; i < messages.length; i++) {
        chatHTML += '<p>' + messages[i] + '</p>';
    }
    $('#chatDiv').html(chatHTML);
    //SCROLLS TO BOTTOM
    $("#chatDiv").animate({ scrollTop: $('#chatDiv').prop("scrollHeight")}, 1000);
}

function getTilePosition(p) {
    let absoluteX = p.x * map.tileSize - players[socketID].location.x + gameWidth / 2;
    let absoluteY = p.y * map.tileSize - players[socketID].location.y + gameHeight / 2;
    return new U.Point(absoluteX, absoluteY);
} 

function getAbsolutePosition(p) {
    let absoluteX = p.x - players[socketID].location.x + gameWidth / 2;
    let absoluteY = p.y - players[socketID].location.y + gameHeight / 2;
    return new U.Point(absoluteX, absoluteY);
}

function insideGameWindow(p) {
    if(p.x + extraDrawDistance < 0 || p.y + extraDrawDistance < 0 || p.x - extraDrawDistance > gameWidth || p.y - extraDrawDistance > gameHeight) {
        return false;
    }
    return true;
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
            let absolutePos = getTilePosition(new U.Point(x, y));
            if(p.x >= absolutePos.x && p.x < absolutePos.x + map.tileSize && p.y >= absolutePos.y && p.y < absolutePos.y + map.tileSize) {
                return new U.Point(x, y);
            }
        }
    }
    return false;
}

function secTimer() {
    fps = fpsCounter
    fpsCounter = 0;
}