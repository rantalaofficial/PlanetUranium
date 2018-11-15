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
    constructor(username, character, uranium, healthRegen, moveSpeed, beamLenght, kills) {
        this.username = username;
        this.character = character;
        this.uranium = uranium;
        this.healthRegen = healthRegen;
        this.health = 100;
        this.moveSpeed = moveSpeed;
        this.beamLenght = beamLenght
        this.kills = kills;

        this.location = new Point(0, 0);
        this.beamStart = null;
        this.beamEnd = null;
        this.signShown = false;
    }

    tryChangeStats(healthRegenChange, moveSpeedChange, beamLenghtChange) {
        let possibleHealthRegen = healthRegenChange + this.healthRegen;
        let possibleMoveSpeed = moveSpeedChange + this.moveSpeed;
        let possibleBeamLenght = beamLenghtChange + this.beamLenght;

        if(healthRegenChange > 0 && this.uranium - Math.pow(possibleHealthRegen, 2) >= 0) {
            this.uranium -= Math.pow(possibleHealthRegen, 2);
            this.healthRegen = possibleHealthRegen;
        } else if(healthRegenChange < 0 && possibleHealthRegen >= 0) {
            this.uranium += Math.pow(this.healthRegen, 2);
            this.healthRegen = possibleHealthRegen;
        }

        if(moveSpeedChange > 0 && this.uranium - Math.pow(possibleMoveSpeed, 2) >= 0) {
            this.uranium -= Math.pow(possibleMoveSpeed, 2);
            this.moveSpeed = possibleMoveSpeed;
        } else if(moveSpeedChange < 0 && possibleMoveSpeed > 0) {
            this.uranium += Math.pow(this.moveSpeed, 2);
            this.moveSpeed = possibleMoveSpeed;
        }

        if(beamLenghtChange > 0 && this.uranium - Math.pow(possibleBeamLenght, 2) >= 0) {
            this.uranium -= Math.pow(possibleBeamLenght, 2);
            this.beamLenght = possibleBeamLenght;
        } else if(beamLenghtChange < 0 && possibleBeamLenght >= 3) {
            this.uranium += Math.pow(this.beamLenght, 2);
            this.beamLenght = possibleBeamLenght;
        }
    }

    respawnPlayer(map) {
        this.health = 100;
        this.location.x = Math.round(Math.random() * map.tileSize * 14);
        this.location.y = Math.round(Math.random() * map.tileSize * 14);
    }
}
class Map {
    constructor(tileSize, width, height) {
        this.tileSize = tileSize;
        this.width = width;
        this.height = height;

        this.tile = [];
        this.safeZone = []
        for(let i = 0; i <= width; i++) {
            this.tile[i] = [];
            this.safeZone[i] = []
        }
        for(let y = 0; y < width; y++) {
            for(let x = 0; x < height; x++) {
                this.tile[x][y] = 0;
                this.safeZone[x][y] = false;
            }
        }

        this.signText = [];
        for(let i = 0; i <= width; i++) {
            this.signText[i] = [];
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

    addSign(text, loc) {
        this.tile[loc.x][loc.y] = 4;
        this.signText[loc.x][loc.y] = text;
    }

    pushTileUpdate(loc, type) {
        //CHECKS THAT TILE NOT SAME AND ALSO THAT IT ISN'T SAFE ZONE
        if(this.insideMap(loc, this.map) && this.tile[loc.x][loc.y] !== type && !this.safeZone[loc.x][loc.y]) {
            this.updatedTiles.push(loc);
            this.updatedTileTypes.push(type);
            this.tile[loc.x][loc.y] = type;
        }
    }

    clearTileUpdates() {
        this.updatedTiles = [];
        this.updatedTileTypes = [];
    }

    setSafeZone(value, topLeft, bottomRight) {
        for(let y = topLeft.y; y < bottomRight.y; y++) {
            for(let x = topLeft.x; x < bottomRight.x; x++) {
                this.safeZone[x][y] = value;
                this.tile[x][y] = 0;
            }
        }
    }

    insideMap(p) {
        if(p.x >= 0 && p.x <= this.width && p.y >= 0 && p.y <= this.height) {
            return true;
        }
        return false;
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