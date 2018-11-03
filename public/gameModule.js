class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static add(p1, p2) {
        return new Point(p1.x + p2.x, p1.y + p2.y)
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
    constructor(username, location, moveSpeed, beamStart, beamEnd) {
        this.username = username;
        this.location = location;
        this.moveSpeed = moveSpeed;

        this.beamStart = beamStart;
        this.beamEnd = beamEnd;
    }
}

export {Point, Map, Texture, Player};