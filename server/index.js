const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const Message = require("./models/Message");
const User = require("./models/User");

let onlineUsers = [];
const userSockets = {};

const app = express();

app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
}));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// JWT Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ message: "Invalid token." });
  }
};

function getDMRoom(userA, userB) {
  return "dm_" + [userA, userB].sort().join("_");
}

app.get("/messages", authenticateToken, async (req, res) => {
  try {
    const { room } = req.query; // Get room from query parameters
    const filter = room ? { room } : {};
    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .limit(50);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/messages/search", authenticateToken, async (req, res) => {
  try {
    const { room, q } = req.query;
    if (!q || !room) return res.json([]);

    const results = await Message.find({
      room,
      message: { $regex: q, $options: "i" },  // case-insensitive search
    })
    .sort({ createdAt: 1 })
    .limit(30);

    res.json(results);
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
      // Send back with _id so client can track receipts
      io.to(data.room).emit("receive_message", {
        ...data,
        _id: newMessage._id.toString(),
      });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("mark_read", ({ room, username, messageId }) => {
    socket.to(room).emit("message_read", { username, messageId });
  });

  socket.on("toggle_reaction", async ({ messageId, emoji, username }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message.reactions) {
        message.reactions = new Map();
      }

      const users = message.reactions.get(emoji) || [];
      const hasReacted = users.includes(username);

      const updated = hasReacted
        ? users.filter((u) => u !== username)
        : [...users, username];

      message.reactions.set(emoji, updated);

      await message.save();

      io.to(message.room).emit("reaction_updated", {
        messageId,
        reactions: Object.fromEntries(message.reactions),
      });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("typing", ({ user, room }) => {
    socket.to(room).emit("show_typing", user);
  });

  socket.on("join_chat", (username) => {
    socket.username = username;
    userSockets[username] = socket.id;

    if (!onlineUsers.includes(username)) {
      onlineUsers.push(username);
    }

    io.emit("online_users", onlineUsers);
  });

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("join_dm", ({ from, to }) => {
    const dmRoom = getDMRoom(from, to);
    socket.join(dmRoom);

    // Find target user's socket and join them too
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.join(dmRoom);
        // Notify target of incoming DM
        targetSocket.emit("incoming_dm", { from, dmRoom });
      }
    }
    console.log(`${from} joined DM room: ${dmRoom}`);
  });

  socket.on("disconnect", () => {
    delete userSockets[socket.username];
    onlineUsers = onlineUsers.filter((user) => user !== socket.username);
    io.emit("online_users", onlineUsers);
    console.log(`User disconnected: ${socket.id}`);
  });
});

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      username: user.username,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
