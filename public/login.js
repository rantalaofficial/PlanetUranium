$(document).ready(function() {
    resetTexts();
});

var showRegister = false;

$('#submitButton').click(function() {
    submit();
});

$(document).on('keydown', function(e) {
    if(e.keyCode === 13) {
        submit();
    };
});

function submit() {
    resetTexts();
    if(showRegister) {
        register($('#usernameInput').val(), $('#passwordInput').val(), $('#passwordConfirmInput').val(), $('input[name=chrSelectRadioBtn]:checked').val());
    } else {
        login($('#usernameInput').val(), $('#passwordInput').val());
    }
}

$('#switchFormButton').click(function() {
    resetTexts();
    $('#passwordConfirmText').toggle();
    $('#passwordConfirmInput').toggle();
    $('#passwordWarningText').toggle();
    $('#chrSelect').toggle();

    if(showRegister) {
        showRegister = false;
        $('#submitButton').text('Login');
        $('#switchFormText').text('Are you new player? Register here:');
        $('#switchFormButton').text('Register');
    } else {
        showRegister = true;
        $('#submitButton').text('Register');
        $('#switchFormText').text('Already have an account? Login here:');
        $('#switchFormButton').text('Login');
    } 
});

function resetTexts() {
    $('#successfulText').text('');
    $('#failedText').text('');
}

function login(username, password) {
    if(username && password) {
        socket.emit('LOGIN', {
            username: username,
            password: password
        });
    } else {
        $('#failedText').text("Username and password cannot be empty.");
    }
}

function register(username, password, confirmPassword, character) {
    if(character === undefined || character < 0 || character > 3) {
        $('#failedText').text("You have to select a character.");
        return;
    }

    if(username && password) {
        if(password === confirmPassword) {
            socket.emit('REGISTER', {
                username: username,
                password: password,
                character: character
            });
        } else {
            $('#failedText').text("The passwords don't match.");
        }
    } else {
        $('#failedText').text("Username and password cannot be empty.");
    }
}

socket.on('LOGGED', function(data) {
    document.cookie = $('#usernameInput').val() + ' ' + $('#passwordInput').val();
    location.href = 'game.html';
});
socket.on('LOGINFAILED', function(data) {
    $('#failedText').text(data);
});

socket.on('REGISTERED', function(data) {
    $('#successfulText').text("Register successful, now just login.");
});
socket.on('REGISTERFAILED', function(data) {
    $('#failedText').text(data);
});