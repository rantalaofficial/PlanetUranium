var express = require('express');
var socket = require('socket.io');
var mysql = require('mysql');
var crypto = require('crypto');

//APP SETUP
var serverPort = 8080;
var app = express();
var server = app.listen(serverPort, function() {
	console.log("Server started on port: " + serverPort)
});
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.static('public'));
var io = socket(server);

//MYSQL DATABASE
var DBconnection = mysql.createConnection({
    host: "localhost",
    user: "user",
    password: "hFxKMZZF5yir5FpI",
    database: "planeturanium"
  });
DBconnection.connect(function(err) {
if (err) throw err;
    console.log("Connected to DB");
});

io.on('connection', function(socket) {
    console.log('Socket connected', socket.id);

    socket.on('disconnect', function() {
        console.log('Socket disconnected', socket.id);
    });

    socket.on('LOGIN', function(data) {
        var username = data.username;
        var passwordHash = hash256(data.password);
        DBconnection.query("SELECT password FROM planeturanium.users WHERE username = '" + username + "';" , function(err, result) {
            if(result && passwordHash === result[0].password) {
                socket.emit('LOGGED', '');
            } else {
                socket.emit('LOGINFAILED', 'Wrong username or password.')
            }
        });
    });

    socket.on('REGISTER', function(data) {
        var username = data.username;
        var passwordHash = hash256(data.password);

        if(!onlyLetters(username) || username.length < 6 || username.length > 20 ) {
            socket.emit('REGISTERFAILED', 'Username can only contain letters and numbers and it must be between 6 and 20 characters long.')
            return;
        }

        DBconnection.query("INSERT INTO planeturanium.users (`username`, `password`) VALUES ('" + data.username + "', '" + passwordHash + "');", function(err, result) {
            if(err) {
                socket.emit('REGISTERFAILED', 'That username is already in use.')
                console.log(err);
            } else {
                socket.emit('REGISTERED', '');
            }
        });
    });
});

//HASH
function hash256(text) {
    if(text) {
        var sha256 = crypto.createHash('sha256');
        return sha256.update(text).digest('hex');
    }
}

function onlyLetters(text) {
    if(text) {
        return text.match("^[A-z0-9]+$");
    }
}

