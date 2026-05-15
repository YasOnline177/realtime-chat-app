import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import axios from "axios";

import Auth from "./components/Auth";

const socket = io("http://localhost:5001");

function App() {
  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );

  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [room, setRoom] = useState("general");

  const chatEndRef = useRef(null);

  const sendMessage = () => {
    if (message.trim()) {
      const messageData = {
        user: username,
        message,
        time: new Date().toLocaleTimeString(),
        room
      };

      socket.emit("send_message", messageData);

      setMessage("");
    }
  };

  const usernameRef = useRef(username);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    if (!username) return;
    socket.emit("join_chat", username);

    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);

      if (data.user !== usernameRef.current && Notification.permission === "granted" && document.hidden) {
        new Notification(`${data.user}`, {
          body: data.message
        });
      }
    });

    socket.on("show_typing", (user) => {
      setTypingUser(user);
      setTimeout(() => setTypingUser(""), 2000);
    });

    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.off("receive_message");
      socket.off("show_typing");
      socket.off("online_users");
    };
  }, [username]);

  const fetchMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://localhost:5001/messages", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: { room }  // Send room as query parameter
      });
      setChat(response.data);
    } catch (error) {
      console.log(error);
    }
  }, [room]); // re-create when room changes

  useEffect(() => {
    socket.emit("join_room", room);
    fetchMessages();  // Reload messages for the new room
  }, [room, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  if (!username) {
    return <Auth setUsername={setUsername} />;
  }

  return (
    <div style={styles.container}>
      <h1>Real-Time Chat</h1>

      <button
        onClick={() => {
          Notification.requestPermission();
        }}
      >
        Enable Notifications
      </button>

      <button
        onClick={() => {
          localStorage.clear();
          setUsername("");
        }}
      >
        Logout
      </button>

      <h3>Online Users</h3>

      <ul>
        {onlineUsers.map((user, index) => (
          <li key={index}>{user}</li>
        ))}
      </ul>

      <select 
        value={room}
        onChange={(e) => setRoom(e.target.value)}
      >
        <option value="general">General</option>
        <option value="study">Study</option>
        <option value="project">Project</option>
      </select>

      <div style={styles.chatBox}>
        {chat.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.message,
              alignSelf:
                msg.user === username ? "flex-end" : "flex-start",
              backgroundColor:
                msg.user === username ? "#4caf50" : "#333",
            }}
          >
            <strong>{msg.user}</strong>
            <p>{msg.message}</p>
            <small>{msg.time}</small>
          </div>
        ))}

        <div ref={chatEndRef}></div>
      </div>

      <p>{typingUser && `${typingUser} is typing...`}</p>

      <div style={styles.inputArea}>
        <input 
          type="text" 
          placeholder="Type message..." 
          value={message} 
          onChange={(e) => {
            setMessage(e.target.value);
            socket.emit("typing", {
              user: username,
              room
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }} 
          style={styles.input}
        />

        <button onClick={sendMessage} style={styles.button}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "600px",
    margin: "20px auto",
    padding: "20px",
    fontFamily: "Arial"
  },

  joinContainer: {
    maxWidth: "400px",
    margin: "100px auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },

  chatBox: {
    height: "400px",
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "10px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "10px"
  },

  message: {
    padding: "10px",
    borderRadius: "10px",
    color: "white",
    maxWidth: "70%"
  },

  inputArea: {
    display: "flex",
    gap: "10px"
  },

  input: {
    flex: 1,
    padding: "10px"
  },

  button: {
    padding: "10px 15px",
    cursor: "pointer"
  }
}

export default App;