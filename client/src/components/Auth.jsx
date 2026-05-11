import { useState } from "react";
import axios from "axios";

function Auth({ setUsername }) {
    const [isLogin, setIsLogin] = useState(true);

    const [formData, setFormData] = useState({
        username: "",
        password: ""
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async () => {
        try {
            const endpoint = isLogin ? "login" : "register";

            const response = await axios.post(
                `http://localhost:5001/${endpoint}`,
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

                setUsername(response.data.username);
            } else {
                alert("Registration successful");
                setIsLogin(true);
            }
        } catch (error) {
            alert(
                error.response?.data?.message || "Something went wrong"
            );
        }
    };

    return (
        <div style={styles.container}>
            <h2>{isLogin ? "Login" : "Register"}</h2>
            
            <input 
                type="text" 
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                style={styles.input}
            />

            <input 
                type="password" 
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                style={styles.input}
            />

            <button onClick={handleSubmit} style={styles.button}>
                {isLogin ? "Login" : "Register"}
            </button>

            <p
                onClick={() => setIsLogin(!isLogin)}
                style={styles.toggle}
            >
                {isLogin ? "Create new account" : "Already have an account?"}
            </p>
        </div>
    );
}

const styles = {
    container: {
        maxWidth: "400px",
        margin: "100px auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
    },

    input: {
        padding: "10px"
    },

    button: {
        padding: "10px",
        cursor: "pointer"
    },

    toggle: {
        color: "blue",
        cursor: "pointer"
    }
};

export default Auth;