import LoginInput from "../components/LoginInput";
import { useState } from "react";

const API_URL = process.env.REACT_APP_API_URL;

export default function Login() {
  const [responseMessage, setResponse] = useState("");
  const [successSubmission, setSuccessSubmission] = useState(false);

  const handleSubmission = (usernameSubmitted, passwordSubmitted) => {
    const url = `${API_URL}/users/login`;

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: usernameSubmitted, password: passwordSubmitted })
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          return res.json().then((data) => {
            throw new Error(data.message || 'An error occurred');
          });
        }
      })
      .then((data) => {
        if (data.jwtToken) {
          localStorage.setItem("token", data.jwtToken);
          localStorage.setItem("username", usernameSubmitted);
          setResponse("Success! You are now logged in! Enjoy!");
          setSuccessSubmission(true);
        }
      })
      .catch((error) => {
        console.error(error);
        setResponse(error.message);
        setSuccessSubmission(false);
      });
  };

  return (
    <div className="login-div">
      <h2 className="login-title">Login</h2>
      <LoginInput onSubmission={handleSubmission} />
      {successSubmission && (
        <p className="login-success">{responseMessage}</p>
        
      )}
      {!successSubmission && responseMessage && (
        <p className="login-response">{responseMessage}</p>
      )}
    </div>
  );
}
