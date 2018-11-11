let gameWidth = 1200;
let gameHeight = 700;
//RENDERS ONLY STUFF THAT IS INSIDE GAME
let extraDrawDistance = 100; //PIXELS

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static add(p1, p2) {
        return new Point(p1.x + p2.x, p1.y + p2.y)
    }
}

//WORK IN PROGRESS
class Game {

    constructor(ctx, width, height, socketID, map, textures) {
        this.ctx = ctx;
        
        this.width = width;
        this.height = height;

        this.socketID = socketID;

        this.map = map;

        this.textures = textures;
    }

    drawMiniMap(miniMapSize, players, signs) {
        let miniMapPos = new Point(this.width - miniMapSize.x, this.height - miniMapSize.y);

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(miniMapPos.x, miniMapPos.y, miniMapSize.x, miniMapSize.y);
        
        this.ctx.beginPath();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'white';
        this.ctx.rect(miniMapPos.x - 2, miniMapPos.y - 2, miniMapSize.x * 2, miniMapSize.y * 2);
        this.ctx.stroke(); 
        //PLAYERS
        for(let id in players) {
            if(id == this.socketID) {
                this.ctx.fillStyle = 'white';
            } else {
                this.ctx.fillStyle = 'red';
            }

            let scaledLoc = new Point((players[id].location.x / (this.map.tileSize * this.map.width)) * miniMapSize.x + miniMapPos.x, (players[id].location.y / (this.map.tileSize * this.map.height)) * miniMapSize.y + miniMapPos.y);
            this.ctx.fillRect(scaledLoc.x - 2, scaledLoc.y - 2, 4, 4);
        }
        //SIGNS
        for(let i in signs) {
            this.ctx.fillStyle = '#42f456';
            let scaledLoc = new Point(signs[i].x * (miniMapSize.x / this.map.width) + miniMapPos.x, signs[i].y * (miniMapSize.y / this.map.height) + miniMapPos.y);
            this.ctx.fillRect(scaledLoc.x - 2, scaledLoc.y - 2, 4, 4);
        }
    }
}

class Texture {
    constructor(source, isOnTop, offset) {
        this.image = new Image();
        this.image.src = source;

        this.isOnTop = isOnTop;

        this.offset = offset;
    }
}

class Player {
    static drawBeam(ctx, beamStart, beamEnd) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(beamStart.x, beamStart.y);
        ctx.lineTo(beamEnd.x, beamEnd.y);
        ctx.stroke();

        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(beamStart.x, beamStart.y);
        ctx.lineTo(beamEnd.x, beamEnd.y);
        ctx.stroke();
        return ctx;
    }

    static drawPlayer(ctx, texture, player, camera) {
        let location = getAbsolutePosition(player.location, camera);
        if(insideGameWindow(location)) {
            //HEALTH BAR
            ctx.fillStyle = 'black';
            ctx.fillRect(location.x, location.y - 10, 50, 10);
            ctx.fillStyle = 'red';
            ctx.fillRect(location.x, location.y - 10, player.health / 2, 10);

            ctx.fillStyle = 'white';
            ctx.font = "15px Arial";
            ctx.fillText(player.username, location.x, location.y);
            ctx.drawImage(texture, location.x, location.y);
        }
        return ctx;
    }
}

function getAbsolutePosition(p, camera) {
    let absoluteX = p.x - camera.x + gameWidth / 2;
    let absoluteY = p.y - camera.y + gameHeight / 2;
    return new Point(absoluteX, absoluteY);
}

function insideGameWindow(p) {
    if(p.x + extraDrawDistance < 0 || p.y + extraDrawDistance < 0 || p.x - extraDrawDistance > gameWidth || p.y - extraDrawDistance > gameHeight) {
        return false;
    }
    return true;
}

export {Point, Game, Texture, Player};