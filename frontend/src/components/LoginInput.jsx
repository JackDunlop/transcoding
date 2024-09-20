import { useState } from 'react';

function LoginInput({ onSubmission }) {
    const [usernameInput, setUsername] = useState("");
    const [passwordInput, setPassword] = useState("");
    const [errorUsername, setErrorUsername] = useState();
    const [errorPassword, setErrorPassword] = useState();

    const handleUsernameChange = (e) => {
        const { value } = e.target;

        if (value === "") {
            setErrorUsername("Username input can't be empty");
        } else {
            setErrorUsername(null);
        }
        setUsername(value);
    };

    const handlePasswordChange = (e) => {
        const { value } = e.target;

        if (value === "") {
            setErrorPassword("Password input can't be empty");
        } else {
            setErrorPassword(null);
        }
        setPassword(value);
    };

    const handleSubmit = () => {
        if (!usernameInput || !passwordInput || errorUsername || errorPassword) {
            console.log("Cannot submit, errors present or inputs are empty.");

            if (!usernameInput) {
                setErrorUsername("Username input can't be empty");
            }
            if (!passwordInput) {
                setErrorPassword("Password input can't be empty");
            }
            return;
        }
        onSubmission(usernameInput, passwordInput);
    };

    return (
        <div className="login-input-div">
            <form>
                <input
                    aria-labelledby="login-input-button"
                    name="username"
                    id="username"
                    type="text"
                    value={usernameInput}
                    onChange={handleUsernameChange}
                    placeholder="Username"
                    className="input-field"
                />
                {errorUsername && <p className="error-message">Error: {errorUsername}</p>}

                <input
                    aria-labelledby="login-input-button"
                    name="password"
                    id="password"
                    type="password"
                    value={passwordInput}
                    onChange={handlePasswordChange}
                    placeholder="Password"
                    className="input-field"
                />
                {errorPassword && <p className="error-message">Error: {errorPassword}</p>}

                <button
                    id="login-input-button"
                    type="button"
                    onClick={handleSubmit}
                    className="submit-button"
                >
                    Login
                </button>
            </form>
        </div>
    );
}

export default LoginInput;
