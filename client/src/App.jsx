import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("send_message", message);
      setMessage("");
    }
  };

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => socket.off("receive_message");
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Real-Time Chat</h1>

      <div>
        {chat.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>

      <input 
        type="text" 
        placeholder="Type message..." 
        value={message} 
        onChange={(e) => setMessage(e.target.value)} 
      />

      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;