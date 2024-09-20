import React, { useState } from "react";
import RegisterInput from "../components/RegisterInput";

const API_URL = process.env.REACT_APP_API_URL;

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [fullname, setFullname] = useState("");
  const [responseMessage, setResponse] = useState("");
  const [successSubmission, setSuccessSubmission] = useState(false);

  const handleSubmission = (submittedUsername, submittedEmail, submittedPassword, submittedDob, submittedFullname) => {
    setUsername(submittedUsername);
    setEmail(submittedEmail);
    setPassword(submittedPassword);
    setDob(submittedDob);
    setFullname(submittedFullname);
    const url = `${API_URL}/users/register`;

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: submittedUsername,
        email: submittedEmail,
        password: submittedPassword,
        dob: submittedDob,
        fullname: submittedFullname,
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.Error) {
          setResponse(data.Message);
          setSuccessSubmission(false);
        } else {
          setResponse(data.Message);
          setSuccessSubmission(true);
        }
      })
      .catch((error) => {
        setResponse("An error occurred");
        setSuccessSubmission(false);
        console.error(error);
      });
  };

  return (
    <div className="register-div">
      <h2 className="register-title">Register</h2>
      <RegisterInput onSubmission={handleSubmission} />
      {responseMessage && <p className="register-response">{responseMessage}</p>}
    </div>
  );
}
