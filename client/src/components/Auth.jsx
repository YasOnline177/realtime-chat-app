import { useState } from "react";
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function Auth({ setUsername }) {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError("");
    };

    const handleSubmit = async () => {
        if (!formData.username || !formData.password) {
            setError("Please fill in all fields");
            return;
        }
        setLoading(true);
        try {
            const endpoint = isLogin ? "login" : "register";
            const response = await axios.post(
                `${SERVER_URL}/${endpoint}`,
                formData
            );
            if (isLogin) {
                localStorage.setItem(
                    "token",
                    response.data.token
                );
                localStorage.setItem(
                    "username",
                    response.data.username
                );
                if (Notification.permission !== "granted") Notification.requestPermission();
                setUsername(response.data.username);
            } else {
                setError("Account created! Please login");
                setIsLogin(true);
            }
        } catch (error) {
            setError(
                error.response?.data?.message || "Something went wrong"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logo}>⬡</div>
                <h1 style={styles.title}>Nexus</h1>
                <p style={styles.subtitle}>{isLogin ? "Welcome back" : "Create an account"}</p>

                <div style={styles.fields}>
                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Username</label>
                        <input
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            placeholder="your_handle"
                            style={styles.input}
                            autoComplete="off"
                        />
                    </div>
                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Password</label>
                        <input
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            placeholder="••••••••"
                            style={styles.input}
                        />
                    </div>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                <button onClick={handleSubmit} style={styles.btn} disabled={loading}>
                    {loading ? "..." : isLogin ? "Sign In" : "Create Account"}
                </button>

                <p style={styles.toggle} onClick={() => { setIsLogin(!isLogin); setError(""); }}>
                    {isLogin ? "No account? Register →" : "Have an account? Sign in →"}
                </p>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)"
    },
    card: {
        width: 380,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        padding: "48px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
    },
    logo: {
        fontSize: 32,
        color: "var(--accent)",
        marginBottom: 12,
        lineHeight: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "-0.5px",
        color: "var(--text-primary)",
        marginBottom: 4,
    },
    subtitle: {
        color: "var(--text-secondary)",
        fontSize: 13,
        marginBottom: 32,
    },
    fields: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginBottom: 20,
    },
    fieldWrap: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
    },
    label: {
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
    },
    input: {
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "11px 14px",
        color: "var(--text-primary)",
        fontSize: 14,
        fontFamily: "'Sora', sans-serif",
        outline: "none",
        transition: "border-color 0.2s",
    },
    error: {
        fontSize: 12,
        color: "var(--danger)",
        marginBottom: 12,
    },
    btn: {
        background: "var(--accent)",
        color: "#0d0f14",
        border: "none",
        borderRadius: 10,
        padding: "12px",
        fontFamily: "'Sora', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
        marginBottom: 16,
        transition: "opacity 0.2s",
    },
    toggle: {
        fontSize: 12,
        color: "var(--text-secondary)",
        cursor: "pointer",
        textAlign: "center",
        transition: "color 0.2s",
    },

};

export default Auth;