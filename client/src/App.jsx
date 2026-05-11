import { useEffect, useState, useRef } from "react";
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

  const chatEndRef = useRef(null);

  const sendMessage = () => {
    if (message.trim()) {
      const messageData = {
        user: username,
        message,
        time: new Date().toLocaleTimeString(),
      };

      socket.emit("send_message", messageData);

      setMessage("");
    }
  };

  useEffect(() => {
    fetchMessages();

    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => socket.off("receive_message");
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5001/messages"
      );

      setChat(response.data);
    } catch (error) {
      console.log(error);
    }
  };

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
          localStorage.clear();
          setUsername("");
        }}
      >
        Logout
      </button>

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

      <div style={styles.inputArea}>
        <input 
          type="text" 
          placeholder="Type message..." 
          value={message} 
          onChange={(e) => setMessage(e.target.value)} 
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