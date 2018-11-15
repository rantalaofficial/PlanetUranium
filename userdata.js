const mongoose = require('mongoose');

let userDataSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true
    },
    character: {
        type: Number,
        required: true
    },
    uranium: {
        type: Number,
        required: true
    },
    healthRegen: {
        type: Number,
        required: true
    },
    moveSpeed: {
        type: Number,
        required: true
    },
    beamLenght: {
        type: Number,
        required: true
    },
    kills: {
        type: Number,
        required: true
    }
});

let userData = mongoose.model('userData', userDataSchema);

module.exports = userData;