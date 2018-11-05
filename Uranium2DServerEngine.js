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
    constructor(username, location, healthRegen, moveSpeed) {
        this.username = username;
        this.location = location;

        this.healthRegen = healthRegen;
        this.health = 100;

        this.moveSpeed = moveSpeed;

        this.beamStart = null;
        this.beamEnd = null;
    }
}
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

        this.updatedTiles = [];
        this.updatedTileTypes = [];
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

    pushTileUpdate(loc, type) {
        //CHECKS THAT TILE NOT SAME
        if(this.tile[loc.x][loc.y] !== type) {
            this.updatedTiles.push(loc);
            this.updatedTileTypes.push(type);
            this.tile[loc.x][loc.y] = type;
        }
    }

    clearTileUpdates() {
        this.updatedTiles = [];
        this.updatedTileTypes = [];
    }
}

class Chat {
    constructor(messageCap) {
        this.messageCap = messageCap;
        this.messages = [];
        this.chatUpdated = false;
    }

    addMessage(username, message, color) {
        this.chatUpdated = true;

        var time = new Date();
        var timeMark = '[' + time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0') + '] ';
        this.messages.push('<span style="color:' + color + ';">' + timeMark + username + '</span>: ' + message + '<br>');

        //CHECKS MESSAGE CAP AND DELETES MESSAGES THAT GO OVER IT
        if(this.messages.length > this.messageCap) {
            this.messages = this.messages.slice(Math.max(this.messages.length - this.messageCap, 0));
        }
    }
}

module.exports = {Point, Player, Map, Chat};