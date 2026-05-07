const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Message = require("./models/Message");

const app = express();

app.use(cors());

mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB connected")).catch((err) => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});

app.get("/messages", async (req, res) => {
    try {
        const messages = await Message.find();

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("send_message", async (data) => {
        try {
            const newMessage = new Message(data);

            await newMessage.save();

            io.emit("receive_message", data);
        } catch (error) {
            console.log(error);
        }
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(5000, () => {
    console.log(`Server running on port ${PORT}`);
});