import { useState } from "react";

const API_URL = process.env.REACT_APP_API_URL;

export default function Logout() {
    const [responseMessage, setResponse] = useState("");
    const [successSubmission, setSuccessSubmission] = useState(false);

    const handleLogout = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            setResponse("No token found. You might already be logged out.");
            setSuccessSubmission(false);
            return;
        }

        const url = `${API_URL}/users/logout`;

        return fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.Error) {
                    setResponse(data.Message);
                    setSuccessSubmission(false);
                } else {
                    localStorage.removeItem("token");
                    setResponse(data.Message);
                    setSuccessSubmission(true);
                }
            })
            .catch((error) => {
                setResponse(error.message);
                setSuccessSubmission(false);
            });
    };

    return (
        <div className="logout-div">
            <h2 className="logout-title">Logout</h2>
            <button onClick={handleLogout} className="logout-button">Logout</button>
            {successSubmission && (
                <p className="logout-success">{responseMessage}</p>
            )}
            {!successSubmission && responseMessage && (
                <p className="logout-response">{responseMessage}</p>
            )}
        </div>
    );
}
