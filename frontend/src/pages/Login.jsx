import { useState } from "react";
import LoginInput from "../components/LoginInput";
import Modal from './Modal'; 

const API_URL = process.env.REACT_APP_API_URL;

export default function Login() {
  const [responseMessage, setResponse] = useState("");
  const [successSubmission, setSuccessSubmission] = useState(false);
  const [session, setSession] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [username, setUsername] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState(""); 
  
// still buggy but works
  const handleSubmission = async (usernameSubmitted, passwordSubmitted) => {
    setUsername(usernameSubmitted);
    const url = `${API_URL}/users/login`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: usernameSubmitted, password: passwordSubmitted }),
      });
      const data = await res.json();
      console.log(data);

      if (data.Message === 'Please complete the MFA setup by scanning the QR code with your authenticator app.') {
        setSession(data.Session);
        console.log("Session set:", data.Session);
        setIsMfaRequired(true);
        setResponse("Please enter the MFA code from your authenticator app.");
        if (data.qrCodeUrl) {
          console.log(data.qrCodeUrl);
          setQrCodeUrl(data.qrCodeUrl);
        }
      } else if (data.Message === 'Please enter the MFA code from your authenticator app.') {
        setSession(data.Session);
        console.log("Session set:", data.Session);
        setIsMfaRequired(true);
        setResponse("Please enter the MFA code from your authenticator app.");
      } else if (data.idToken) {
        localStorage.setItem("token", data.accessToken);
        setResponse("Success! You are now logged in!");
        setSuccessSubmission(true);
      } else {
        setResponse(data.Message || "Login failed.");
      }
    } catch (error) {
      setResponse(error.message || "Login failed.");
      setSuccessSubmission(false);
    }
  };

  const handleSetupMfa = async () => {
    const url = `${API_URL}/users/setup-mfa`;
    console.log("Setting up MFA with session:", session);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userCode: totpCode, session }),
      });
      const data = await res.json();

      if (data.Message === 'MFA setup complete. You can now use TOTP for authentication.') {
        setResponse("MFA setup complete! You can now use TOTP for authentication.");
        setIsMfaRequired(false);
      } else {
        setResponse("Failed to verify MFA setup. Please try again.");
      }
    } catch (error) {
      setResponse(error.message || "MFA setup failed.");
      setSuccessSubmission(false);
    }
  };

  const handleVerifyMfa = async () => {
    const url = `${API_URL}/users/verify-mfa`;
    console.log("Verifying with session:", session);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, userCode: totpCode, session }),
      });
      const data = await res.json();

      if (data.idToken) {
        localStorage.setItem("token", data.accessToken);
        setResponse("MFA verification complete! You are now logged in!");
        setSuccessSubmission(true);
        setIsMfaRequired(false);
      } else {
        setResponse("Failed to verify MFA code. Please try again.");
      }
    } catch (error) {
      setResponse(error.message || "MFA verification failed.");
      setSuccessSubmission(false);
    }
  };

  return (
    <div className="login-div">
      <h2 className="login-title">Login</h2>
      <LoginInput onSubmission={handleSubmission} />


      <Modal isOpen={isMfaRequired} onClose={() => setIsMfaRequired(false)}>
        <div className="mfa-prompt">
          <p>{responseMessage}</p>

          {qrCodeUrl && <img src={qrCodeUrl} alt="Scan this QR code with your authenticator app" />}
          <input
            type="text"
            placeholder="Enter the MFA code from your app"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
          />
          {qrCodeUrl ? (
            <button onClick={handleSetupMfa}>Setup MFA</button>
          ) : (
            <button onClick={handleVerifyMfa}>Verify MFA Code</button>
          )}
        </div>
      </Modal>

      {successSubmission && <p className="login-success">{responseMessage}</p>}
      {!successSubmission && responseMessage && (
        <p className="login-response">{responseMessage}</p>
      )}
    </div>
  );
}
