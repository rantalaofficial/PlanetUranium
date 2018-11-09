$(document).ready(function() {
    $('#databaseTable').hide();

    $('#adminPassword').keypress(function(e) {
        let password = $('#adminPassword').val()
        if(e.keyCode == '13' && password.length > 0) {
            socket.emit('ADMINLOGIN', password);
        }
    });
});

socket.on('ADMINLOGGED', function(users) {
    $('#adminPassword').val('');
    $('#databaseTable td').remove();
    for(let i in users) {
        let user = users[i];
        $('#databaseTable').append('<tr><td>' + user[0] + '</td><td>' + user[1] + ' </td><td>' + user[2] + '</td><td>' + user[3] + '</td></tr>');
    }
    $('#databaseTable').show();
});