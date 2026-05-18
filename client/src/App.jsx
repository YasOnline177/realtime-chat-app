import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import axios from "axios";
import Auth from "./components/Auth";

const socket = io("http://localhost:5001");

const ROOMS = [
  { id: "general", label: "General", icon: "◈" },
  { id: "study", label: "Study", icon: "◎" },
  { id: "project", label: "Project", icon: "◆" },
];

const EMOJIS = [
  "😀","😂","😍","🥹","😎","😭","🤯","🥳","😴","🤔",
  "👍","👎","❤️","🔥","💯","🎉","✅","🚀","💀","👀",
  "😤","🫡","🤝","🙏","👏","💪","🫶","😈","🤡","💅",
]

function getInitials(name) {
  return name?.slice(0, 2).toUpperCase() || "??";
}

function Avatar({ name, size = 32 }) {
  const colors = ["#4fffb0", "#ff9f4f", "#4fb4ff", "#d44fff", "#fff44f"];
  const color = colors[name?.charCodeAt(0) % colors.length] || "#4fffb0";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color + "22", border: `1.5px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 600, color,
      fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 2px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--accent)",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function EmojiPicker({ onSelect, onClose }) {
  return (
    <div style={emojiStyles.backdrop} onClick={onClose}>
      <div style={emojiStyles.panel} onClick={(e) => e.stopPropagation()}>
        {EMOJIS.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            style={emojiStyles.emojiBtn}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [room, setRoom] = useState("general");
  const [showEmoji, setShowEmoji] = useState(false);
  const chatEndRef = useRef(null);
  const usernameRef = useRef(username);
  const inputRef = useRef(null);

  useEffect(() => { usernameRef.current = username; }, [username]);

  useEffect(() => {
    if (!username) return;
    socket.emit("join_chat", username);

    socket.on("receive_message", (data) => {
      setChat(prev => [...prev, data]);
      if (data.user !== usernameRef.current && Notification.permission === "granted" && document.hidden) {
        new Notification(data.user, { body: data.message });
      }
    });
    socket.on("show_typing", (user) => {
      setTypingUser(user);
      setTimeout(() => setTypingUser(""), 2000);
    });
    socket.on("online_users", (users) => setOnlineUsers(users));

    return () => {
      socket.off("receive_message");
      socket.off("show_typing");
      socket.off("online_users");
    };
  }, [username]);

  const fetchMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5001/messages", {
        headers: { Authorization: `Bearer ${token}` },
        params: { room },
      });
      setChat(res.data);
    } catch (e) { console.log(e); }
  }, [room]);

  useEffect(() => {
    socket.emit("join_room", room);
    fetchMessages();
  }, [room, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("send_message", {
      user: username,
      message,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      room,
    });
    setMessage("");
    inputRef.current?.focus();
  };

  if (!username) return <Auth setUsername={setUsername} />;

  const currentRoom = ROOMS.find(r => r.id === room);

  return (
    <div style={s.shell}>

      {/* ── SIDEBAR ── */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.brand}>
            <span style={s.brandIcon}>⬡</span>
            <span style={s.brandName}>Nexus</span>
          </div>

          <p style={s.sectionLabel}>Rooms</p>
          {ROOMS.map(r => (
            <button
              key={r.id}
              onClick={() => setRoom(r.id)}
              style={{
                ...s.roomBtn,
                ...(r.id === room ? s.roomBtnActive : {}),
              }}
            >
              <span style={s.roomIcon}>{r.icon}</span>
              {r.label}
              {r.id === room && <span style={s.activePip} />}
            </button>
          ))}

          <p style={{ ...s.sectionLabel, marginTop: 28 }}>Online — {onlineUsers.length}</p>
          <div style={s.userList}>
            {onlineUsers.map((u, i) => (
              <div key={i} style={s.userRow}>
                <Avatar name={u} size={26} />
                <span style={s.userName}>{u}</span>
                <span style={s.onlineDot} />
              </div>
            ))}
          </div>
        </div>

        <div style={s.sideBottom}>
          <div style={s.selfRow}>
            <Avatar name={username} size={30} />
            <span style={s.selfName}>{username}</span>
          </div>
          <button
            style={s.logoutBtn}
            onClick={() => { localStorage.clear(); setUsername(""); }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={s.main}>

        {/* Header */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}>{currentRoom?.icon}</span>
            <div>
              <p style={s.headerRoom}>{currentRoom?.label}</p>
              <p style={s.headerSub}>
                {typingUser ? <><TypingDots /><span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 12 }}>{typingUser} is typing</span></> : `${onlineUsers.length} online`}
              </p>
            </div>
          </div>
          <button
            style={s.notifBtn}
            onClick={() => Notification.requestPermission()}
            title="Enable notifications"
          >
            🔔
          </button>
        </header>

        {/* Messages */}
        <div style={s.feed}>
          {chat.length === 0 && (
            <div style={s.emptyState}>
              <span style={s.emptyIcon}>{currentRoom?.icon}</span>
              <p style={s.emptyText}>No messages yet. Say hello!</p>
            </div>
          )}

          {chat.map((msg, i) => {
            const isSelf = msg.user === username;
            return (
              <div key={i} style={{ ...s.msgRow, justifyContent: isSelf ? "flex-end" : "flex-start" }}>
                {!isSelf && <Avatar name={msg.user} size={30} />}
                <div style={{ maxWidth: "65%", display: "flex", flexDirection: "column", gap: 3, alignItems: isSelf ? "flex-end" : "flex-start" }}>
                  {!isSelf && <span style={s.msgAuthor}>{msg.user}</span>}
                  <div style={{ ...s.bubble, ...(isSelf ? s.bubbleSelf : s.bubbleOther) }}>
                    {msg.message}
                  </div>
                  <span style={s.msgTime}>{msg.time}</span>
                </div>
                {isSelf && <Avatar name={msg.user} size={30} />}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        {showEmoji && (
          <EmojiPicker
            onSelect={(emoji) => {
              setMessage(prev => prev + emoji);
              inputRef.current?.focus();
            }}
            onClose={() => setShowEmoji(false)}
          />
        )}

        <div style={s.inputBar}>
          <button
            onClick={() => setShowEmoji(prev => !prev)}
            style={{
              ...s.sendBtn,
              background: showEmoji ? "var(--accent-dim)" : "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: 18,
              border: "1px solid var(--border)"
            }}
            title="Emoji"
          >
            😊
          </button>
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              socket.emit("typing", { user: username, room });
            }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message #${currentRoom?.label.toLowerCase()}...`}
            style={s.input}
          />
          <button onClick={sendMessage} style={s.sendBtn} disabled={!message.trim()}>
            ➤
          </button>
        </div>

      </main>
    </div>
  );
}

const s = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "var(--bg-base)",
    overflow: "hidden",
  },

  // Sidebar
  sidebar: {
    width: 220,
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "20px 12px",
    flexShrink: 0,
  },
  sideTop: { display: "flex", flexDirection: "column", gap: 4 },
  brand: { display: "flex", alignItems: "center", gap: 8, marginBottom: 24 },
  brandIcon: { fontSize: 22, color: "var(--accent)" },
  brandName: { fontSize: 16, fontWeight: 600, letterSpacing: "-0.3px" },
  sectionLabel: {
    fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--text-muted)", padding: "0 8px", marginBottom: 4,
  },
  roomBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "none", border: "none", color: "var(--text-secondary)",
    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
    fontSize: 13, fontFamily: "'Sora', sans-serif", width: "100%",
    textAlign: "left", position: "relative", transition: "all 0.15s",
  },
  roomBtnActive: {
    background: "var(--accent-dim)", color: "var(--accent)",
  },
  roomIcon: { fontSize: 14 },
  activePip: {
    width: 6, height: 6, borderRadius: "50%",
    background: "var(--accent)", marginLeft: "auto",
  },
  userList: { display: "flex", flexDirection: "column", gap: 4, marginTop: 4 },
  userRow: { display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" },
  userName: { fontSize: 12, color: "var(--text-secondary)", flex: 1 },
  onlineDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "var(--online)", flexShrink: 0,
  },
  sideBottom: { display: "flex", flexDirection: "column", gap: 8 },
  selfRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" },
  selfName: { fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  logoutBtn: {
    background: "none", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text-secondary)",
    padding: "7px", fontSize: 12, cursor: "pointer",
    fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
    width: "100%",
  },

  // Main
  main: {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
    background: "var(--bg-base)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 24px", borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)", flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerIcon: { fontSize: 22, color: "var(--accent)" },
  headerRoom: { fontSize: 15, fontWeight: 600 },
  headerSub: { display: "flex", alignItems: "center", fontSize: 12, color: "var(--text-secondary)", marginTop: 1 },
  notifBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 16, opacity: 0.5, transition: "opacity 0.2s",
  },

  // Feed
  feed: {
    flex: 1, overflowY: "auto", padding: "24px",
    display: "flex", flexDirection: "column", gap: 16,
  },
  emptyState: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 12, opacity: 0.3, marginTop: "30vh",
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 13, color: "var(--text-secondary)" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 10 },
  msgAuthor: { fontSize: 11, color: "var(--text-secondary)", paddingLeft: 2 },
  bubble: {
    padding: "10px 14px", borderRadius: 14, fontSize: 14,
    lineHeight: 1.5, wordBreak: "break-word",
  },
  bubbleSelf: {
    background: "var(--bubble-self)",
    color: "var(--text-primary)",
    borderBottomRightRadius: 4,
    border: "1px solid #4fffb020",
  },
  bubbleOther: {
    background: "var(--bubble-other)",
    color: "var(--text-primary)",
    borderBottomLeftRadius: 4,
    border: "1px solid var(--border)",
  },
  msgTime: { fontSize: 10, color: "var(--text-muted)", paddingLeft: 2 },

  // Input
  inputBar: {
    display: "flex", gap: 10, padding: "16px 24px",
    borderTop: "1px solid var(--border)", background: "var(--bg-surface)",
    flexShrink: 0,
  },
  input: {
    flex: 1, background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: 12,
    padding: "12px 16px", color: "var(--text-primary)",
    fontSize: 14, fontFamily: "'Sora', sans-serif", outline: "none",
  },
  sendBtn: {
    background: "var(--accent)", color: "#0d0f14",
    border: "none", borderRadius: 12, width: 44,
    fontSize: 16, cursor: "pointer", fontWeight: 700,
    transition: "opacity 0.2s", flexShrink: 0,
  },
};

const emojiStyles = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 100
  },
  panel: {
    position: "absolute",
    bottom: 80, left: 240,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 14, 
    padding: 12,
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
    gap: 4,
    boxShadow: "0, 8px, 32px, #00000066",
    zIndex: 101
  },
  emojiBtn: {
    background: "none", border: "none",
    fontSize: 20, cursor: "pointer",
    padding: "4px 2px", borderRadius: 6,
    transition: "transform 0.1s",
    lineHeight: 1
  }
};