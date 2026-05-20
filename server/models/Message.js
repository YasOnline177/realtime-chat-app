const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    time: {
        type: String
    },
    room: {
        type: String,
        required: true
    },
    reactions: {
        type: Map,
        of: [String],
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);