const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: ""
    },
    time: {
        type: String
    },
    room: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String
    },
    messageType: {
        type: String,
        enum: ["text", "image"],
        default: "text"
    },
    reactions: {
        type: Map,
        of: [String],
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);