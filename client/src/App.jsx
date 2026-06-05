import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import axios from "axios";
import Auth from "./components/Auth";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;
const socket = io(SERVER_URL);

const ROOMS = [
  { id: "general", label: "General", icon: "◈" },
  { id: "study", label: "Study", icon: "◎" },
  { id: "project", label: "Project", icon: "◆" },
];

const EMOJIS = [
  "😀", "😂", "😍", "🥹", "😎", "😭", "🤯", "🥳", "😴", "🤔",
  "👍", "👎", "❤️", "🔥", "💯", "🎉", "✅", "🚀", "💀", "👀",
  "😤", "🫡", "🤝", "🙏", "👏", "💪", "🫶", "😈", "🤡", "💅",
];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "👏"];

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

function Lightbox({ src, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "#000000cc",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
    >
      <img 
        src={src}
        alt="full size"
        style={{
          maxWidth: "90vw", maxHeight: "90vh",
          borderRadius: 12,
          boxShadow: "0 20px 60px #000"
        }}
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 24,
          background: "none", border: "none",
          color: "#fff", fontSize: 28, cursor: "pointer"
        }}
      >x</button>
    </div>
  );
}

function getDMRoom(userA, userB) {
  return "dm_" + [userA, userB].sort().join("_");
}

export default function App() {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [room, setRoom] = useState("general");
  const [showEmoji, setShowEmoji] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, study: 0, project: 0 });
  const [reactions, setReactions] = useState({});
  const [hoverMsg, setHoverMsg] = useState(null);
  const [activeDM] = useState(() => new Set()); // Track joined DM rooms
  const [dmUser, setDmUser] = useState(null);
  const [readReceipts, setReadReceipts] = useState({});
  const [dmToast, setDmToast] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const chatEndRef = useRef(null);
  const usernameRef = useRef(username);
  const inputRef = useRef(null);
  const roomRef = useRef(room);
  const msgRefs = useRef({});
  const fileInputRef = useRef(null);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);

  useEffect(() => {
    if (!username) return;
    socket.emit("join_chat", username);
    ROOMS.forEach(r => socket.emit("join_room", r.id));

    const handleReconnect = () => {
      socket.emit("join_chat", username);
      ROOMS.forEach(r => socket.emit("join_room", r.id));
    };

    socket.on("connect", handleReconnect);

    socket.on("receive_message", (data) => {
      if (data.room === roomRef.current) {
        // Only add to chat if it's the current room
        setChat(prev => {
          const updated = [...prev, data];
          if (data.user !== usernameRef.current) {
            markLastMessageRead(updated);
          }
          return updated;
        });
      } else {
        // Increment unread for other rooms
        setUnreadCounts(prev => ({
          ...prev,
          [data.room]: (prev[data.room] || 0) + 1
        }));
        // Show toast for DM messages
        if (data.room.startsWith("dm_") && data.user !== usernameRef.current) {
          setDmToast({ from: data.user, dmRoom: data.room });
          setTimeout(() => setDmToast(null), 4000);
        }
      }

      if (data.user !== usernameRef.current && Notification.permission === "granted" && document.hidden) {
        new Notification(data.user, { body: data.message });
      }
    });
    socket.on("show_typing", (user) => {
      setTypingUser(user);
      setTimeout(() => setTypingUser(""), 2000);
    });
    socket.on("online_users", (users) => setOnlineUsers(users));
    socket.on("reaction_updated", ({ messageId, reactions }) => {
      setChat(prev =>
        prev.map(msg =>
          msg._id === messageId
            ? { ...msg, reactions }
            : msg
        )
      );
    });
    socket.on("incoming_dm", ({ from, dmRoom }) => {
      // Show notification
      if (Notification.permission === "granted" && document.hidden) {
        new Notification(`💬 ${from}`, { body: "Sent you a private message" });
      }
      socket.emit("join_room", dmRoom);
      setUnreadCounts(prev => ({
        ...prev,
        [dmRoom]: (prev[dmRoom] || 0) + 1,
      }));
      // Show in-app toast
      setDmToast({ from, dmRoom });
      setTimeout(() => setDmToast(null), 4000);
    });
    socket.on("message_read", ({ username: reader, messageId }) => {
      setReadReceipts(prev => {
        const current = prev[messageId] || [];
        if (current.includes(reader)) return prev;
        return { ...prev, [messageId]: [...current, reader] };
      });
    });

    return () => {
      socket.off("receive_message");
      socket.off("show_typing");
      socket.off("online_users");
      socket.off("connect", handleReconnect);
      socket.off("incoming_dm");
      socket.off("message_read");
    };
  }, [username]);

  const markLastMessageRead = useCallback((messages) => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg._id) return;
    if (lastMsg.user === username) return;
    socket.emit("mark_read", {
      room: roomRef.current,
      username,
      messageId: lastMsg._id,
    });
  }, [username]);

  const fetchMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${SERVER_URL}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { room },
      });
      setChat(res.data);
      markLastMessageRead(res.data);
    } catch (e) {
      // Token expited or invelid, force re-login
      if (e.response?.status === 401 || e.response?.status === 403) {
        localStorage.clear();
        setUsername("");
      }
      console.log(e);
    }
  }, [room, markLastMessageRead]);

  const searchMessages = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${SERVER_URL}/messages/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { room, q },
      });
      setSearchResults(res.data);
    } catch (e) { console.log(e); }
    finally { setSearchLoading(false); }
  }, [room]);

  useEffect(() => {
    if (!username) return;
    fetchMessages();
    // Clear unread for the room just entered
    setUnreadCounts(prev => ({ ...prev, [room]: 0 }));
    setReactions({});
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  }, [room, fetchMessages, username]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMessages(searchQuery);
    }, 400);  // wait 400ms after user stops typing
    return () => clearTimeout(timer);
  }, [searchQuery, searchMessages]);

  // Check token expiry on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // JWT payload is base64 encoded in the middle section
      const payload = JSON.parse(atob(token.split(".")[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      if (isExpired) {
        localStorage.clear();
        setUsername("");
      }
    } catch (e) {
      // Malformed token — clear it
      localStorage.clear();
      setUsername("");
    }
  }, []);

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

  const uploadImage = async (file) => {
    // Validate file
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );

      const imageUrl = res.data.secure_url;

      // Send as a message with imageUrl
      socket.emit("send_message", {
        user: username,
        message: "",
        imageUrl,
        messageType: "image",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        room,
      });
    } catch (e) {
      console.log(e);
      alert("Image upload failed. Try again");
    } finally {
      setImageUploading(false);
    }
  };

  const jumpToMessage = (msgId) => {
    // Check if message is already in chat
    const el = msgRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(msgId);
      setTimeout(() => setHighlightedId(null), 2000);
      setShowSearch(false);
      return;
    }
    // if not in chat, fetch and inject
    setShowSearch(false);
  };

  const toggleReaction = (messageId, emoji) => {
    socket.emit("toggle_reaction", {
      messageId,
      emoji,
      username
    });
  };

  const openDM = (targetUser) => {
    if (targetUser === username) return;  // Can't DM yourself
    const dmRoom = getDMRoom(username, targetUser);
    setDmUser(targetUser);
    setRoom(dmRoom);
    if (!activeDM.has(dmRoom)) {
      socket.emit("join_dm", { from: username, to: targetUser });
      activeDM.add(dmRoom);
    }
  };

  if (!username) return <Auth setUsername={setUsername} />;

  const currentRoom = ROOMS.find(r => r.id === room);

  return (
    <div style={s.shell}>

      {/* DM Toast */}
      {dmToast && (
        <div
          onClick={() => {
            setDmUser(dmToast.from);
            setRoom(dmToast.dmRoom);
            setDmToast(null);
          }}
          style={s.dmToast}
        >
          <Avatar name={dmToast.from} size={28} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              💬 {dmToast.from}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              Send you a private message
            </p>
          </div>
          <span
            style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); setDmToast(null); }}
          >x</span>
        </div>
      )}

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
              onClick={() => { setRoom(r.id); setDmUser(null); }}
              style={{
                ...s.roomBtn,
                ...(r.id === room ? s.roomBtnActive : {}),
              }}
            >
              <span style={s.roomIcon}>{r.icon}</span>
              {r.label}
              {r.id === room ? <span style={s.activePip} /> : unreadCounts[r.id] > 0 && (
                <span style={s.badge}>{unreadCounts[r.id]}</span>
              )}
            </button>
          ))}

          {dmUser && (
            <div
              onClick={() => setRoom(getDMRoom(username, dmUser))}
              style={{
                background: room.startsWith("dm_") ? "var(--accent-dim)" : "none",
                border: `1px solid ${room.startsWith("dm_") ? "var(--accent-glow)" : "var(--border)"}`,
                borderRadius: 8, padding: "8px 10px",
                marginBottom: 8, fontSize: 12,
                color: room.startsWith("dm_") ? "var(--accent)" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: 6,
                cursor: "pointer", transition: "all 0.15s"
              }}
            >
              <Avatar name={dmUser} size={20} />
              <span style={{ flex: 1 }}>DM: {dmUser}</span>
              {unreadCounts[getDMRoom(username, dmUser)] > 0 && (
                <span style={s.badge}>
                  {unreadCounts[getDMRoom(username, dmUser)]}
                </span>
              )}
              <span
                style={{ cursor: "pointer", opacity: 0.6 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDmUser(null);
                  setRoom("general");
                }}
              >x</span>
            </div>
          )}

          <p style={{ ...s.sectionLabel, marginTop: 28 }}>Online — {onlineUsers.length}</p>
          <div style={s.userList}>
            {onlineUsers.filter(u => u !== username).map((u, i) => (
              <div key={i} style={{ ...s.userRow, cursor: "pointer" }} onClick={() => openDM(u)} title={`DM ${u}`}>
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
            <span style={s.headerIcon}>
              {dmUser ? <Avatar name={dmUser} size={28} /> : currentRoom?.icon}
            </span>
            <div>
              <p style={s.headerRoom}>{dmUser ? dmUser : currentRoom?.label}</p>
              <p style={s.headerSub}>
                {typingUser
                  ? <><TypingDots /><span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 12 }}>{typingUser} is typing</span></>
                  : dmUser ? "Private message" : `${onlineUsers.length} online`
                }
              </p>
            </div>
          </div>
          {dmUser && (
            <button
              style={{ ...s.logoutBtn, width: "auto", padding: "6px 12px" }}
              onClick={() => { setDmUser(null); setRoom("general"); }}
            >
              x Close DM
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              style={{
                ...s.notifBtn,
                ...(showSearch ? { opacity: 1, color: "var(--accent)" } : {}),
              }}
              onClick={() => {
                setShowSearch(prev => !prev);
                setSearchQuery("");
                setSearchResults([]);
              }}
              title="Search messages"
            >
              🔍
            </button>
            <button
              style={s.notifBtn}
              onClick={() => Notification.requestPermission()}
              title="Enable notification"
            >
              🔔
            </button>
          </div>
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
            const msgReactions = msg.reactions || {};

            return (
              <div key={i} ref={el => msgRefs.current[msg._id] = el} style={{ ...s.msgRow, justifyContent: isSelf ? "flex-end" : "flex-start" }} onMouseEnter={() => setHoverMsg(i)} onMouseLeave={() => setHoverMsg(null)} >
                {!isSelf && <Avatar name={msg.user} size={30} />}

                <div style={{ maxWidth: "65%", display: "flex", flexDirection: "column", gap: 3, alignItems: isSelf ? "flex-end" : "flex-start", position: "relative" }}>
                  {!isSelf && <span style={s.msgAuthor}>{msg.user}</span>}

                  {/* Reaction bar */}
                  {hoverMsg === i && !isSelf && (
                    <div style={{
                      ...s.reactionBar,
                      right: isSelf ? "auto" : undefined,
                      left: isSelf ? "auto" : undefined,
                      alignSelf: isSelf ? "flex-end" : "flex-start"
                    }}>
                      {QUICK_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          style={s.reactionPickBtn}
                          onClick={() => toggleReaction(msg._id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Bubble */}
                  <div style={{ ...s.bubble, ...(isSelf ? s.bubbleSelf : s.bubbleOther),
                    ...(msg.messageType === "image" ? { padding: 4, background: "none", border: "none" } : {})
                  }}>
                    {msg.messageType === "image" ? (
                      <img 
                        src={msg.imageUrl}
                        alt="shared image"
                        style={{
                          maxWidth: 240, maxHeight: 200,
                          borderRadius: 10, display: "block",
                          cursor: "pointer", objectFit: "cover"
                        }}
                        onClick={() => setLightboxImage(msg.imageUrl)}
                      />
                    ) : (
                      msg.message
                    )}
                  </div>

                  {/* Reaction chip below bubble */}
                  {Object.keys(msgReactions).length > 0 && (
                    <div style={s.reactionChips}>
                      {Object.entries(msgReactions).filter(([emoji, users]) => users.length > 0).map(([emoji, users]) => (
                        <span
                          key={emoji}
                          style={{
                            ...s.reactionChip,
                            borderColor: users.includes(username) ? "var(--accent)" : undefined,
                            color: users.includes(username) ? "var(--accent)" : undefined
                          }}
                          onClick={() => toggleReaction(msg._id, emoji)}
                        >
                          {emoji} {users.length}
                        </span>
                      ))}
                    </div>
                  )}

                  <span style={s.msgTime}>{msg.time}</span>

                  {/* Read receipts */}
                  {isSelf && msg._id && readReceipts[msg._id]?.length > 0 && (
                    <div style={s.seenRow}>
                      {readReceipts[msg._id].map((reader, idx) => (
                        <Avatar key={idx} name={reader} size={14} />
                      ))}
                      <span style={s.seenText}>Seen</span>
                    </div>
                  )}
                </div>
                {isSelf && <Avatar name={msg.user} size={30} />}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div style={s.searchPanel}>
            <div style={s.searchInputWrap}>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                style={s.searchInput}
              />
              {searchQuery && (
                <span
                  style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                >✕</span>
              )}
            </div>

            <div style={s.searchResults}>
              {searchLoading && (
                <p style={s.searchMeta}>Searching...</p>
              )}
              {!searchLoading && searchQuery && searchResults.length === 0 && (
                <p style={s.searchMeta}>No result for "{searchQuery}"</p>
              )}
              {!searchLoading && searchResults.map((msg, i) => {
                // Highligh matched text
                const parts = msg.message.split(new RegExp(`(${searchQuery})`, "gi"));
                return (
                  <div
                    key={i}
                    style={s.searchResultItem}
                    onClick={() => jumpToMessage(msg._id)}
                  >
                    <Avatar name={msg.user} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                          {msg.user}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{msg.time}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {parts.map((part, j) =>
                          part.toLowerCase() === searchQuery.toLowerCase()
                            ? <mark key={j} style={{ background: "var(--accent)", color: "#0d0f14", borderRadius: 3, padding: "0 2px" }}>{part}</mark>
                            : part
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input 
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) uploadImage(file);
            e.target.value = "";  // reset so the same file can be re-uploaded
          }}
        />

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

          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            style={{
              ...s.sendBtn,
              background: "var(--bg-elevated)",
              color: imageUploading ? "var(--text-muted)" : "var(--text-primary)",
              fontSize: 18, border: "1px solid var(--border)"
            }}
            title="Send image"
          >
            {imageUploading ? "⏳" : "🖼️"}
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

      {/* Lightbox */}
      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
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
  badge: {
    marginLeft: "auto",
    background: "var(--danger)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 20,
    padding: "1px 6px",
    minWidth: 18,
    textAlign: "center"
  },
  reactionBar: {
    display: "flex", gap: 2,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 20, padding: "3px 6px",
    boxShadow: "0 4px 12px #00000044",
    zIndex: 10, marginBottom: 4
  },
  reactionPickBtn: {
    background: "none", border: "none",
    fontSize: 16, cursor: "pointer",
    padding: "2px 4px", borderRadius: 6,
    transition: "transform 0.1s",
    lineHeight: 1
  },
  reactionChips: {
    display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2
  },
  reactionChip: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 20, padding: "2px 8px",
    fontSize: 12, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 3,
    transition: "border-color 0.15s"
  },
  seenRow: {
    display: "flex", alignItems: "center", gap: 3,
    marginTop: 2
  },
  seenText: {
    fontSize: 10,
    color: "var(--accent)",
    opacity: 0.7
  },
  dmToast: {
    position: "fixed",
    bottom: 24, right: 24,
    background: "var(--bg-elevated)",
    border: "1px solid var(--accent-glow)",
    borderRadius: 14,
    padding: "12px 16px",
    display: "flex", alignItems: "center", gap: 10,
    cursor: "pointer",
    zIndex: 200,
    boxShadow: "0 8px 32px #00000066",
    minWidth: 260,
    animation: "slideUp 0.3s ease"
  },
  searchPanel: {
    borderTop: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
    flexShrink: 0,
    maxHeight: 320,
    display: "flex",
    flexDirection: "column",
  },
  searchInputWrap: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
  },
  searchInput: {
    flex: 1, background: "none", border: "none",
    color: "var(--text-primary)", fontSize: 14,
    fontFamily: "'Sora', sans-serif", outline: "none",
  },
  searchResults: {
    overflowY: "auto", flex: 1,
  },
  searchMeta: {
    fontSize: 12, color: "var(--text-muted)",
    padding: "16px 20px", textAlign: "center",
  },
  searchResultItem: {
    display: "flex", gap: 10, alignItems: "center",
    padding: "10px 20px", cursor: "pointer",
    borderBottom: "1px solid var(--border)",
    transition: "background 0.15s",
  },
  msgHighlight: {
    background: "var(--accent-dim)",
    borderRadius: 12,
    transition: "background 0.5s",
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
    boxShadow: "0 8px 32px #00000066",
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