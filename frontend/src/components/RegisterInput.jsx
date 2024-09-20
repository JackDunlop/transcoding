import { useState } from 'react';

function RegisterInput({ onSubmission }) {
    const [innerUsername, setInnerUsername] = useState("");
    const [innerEmail, setInnerEmail] = useState("");
    const [innerPassword, setInnerPassword] = useState("");
    const [innerDob, setInnerDob] = useState("");
    const [innerFullname, setInnerFullname] = useState("");
    const [errorEmail, setErrorEmail] = useState(null);
    const [errorPassword, setErrorPassword] = useState(null);

    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

    const handleEmailChange = (e) => {
        const { value } = e.target;
        if (value === "") {
            setErrorEmail("Email input can't be empty");
        } else if (!emailRegex.test(value)) {
            setErrorEmail("Invalid email format");
        } else {
            setErrorEmail(null);
        }
        setInnerEmail(value);
    };

    const handlePasswordChange = (e) => {
        const { value } = e.target;
        if (value === "") {
            setErrorPassword("Password input can't be empty");
        } else {
            setErrorPassword(null);
        }
        setInnerPassword(value);
    };

    const handleSubmit = () => {
        if (!innerEmail || !innerPassword || errorEmail || errorPassword) {
            console.log("Cannot submit, errors present or inputs are empty.");
            return;
        }
        onSubmission(innerUsername, innerEmail, innerPassword, innerDob, innerFullname);
    };

    return (
        <div className="register-input-div">
            <form>
                <input
                    aria-labelledby="register-input-button"
                    name="username"
                    id="username"
                    type="text"
                    value={innerUsername}
                    onChange={(e) => setInnerUsername(e.target.value)}
                    placeholder="Username"
                    className="input-field"
                />
                <input
                    aria-labelledby="register-input-button"
                    name="fullname"
                    id="fullname"
                    type="text"
                    value={innerFullname}
                    onChange={(e) => setInnerFullname(e.target.value)}
                    placeholder="Full Name"
                    className="input-field"
                />
                <input
                    aria-labelledby="register-input-button"
                    name="dob"
                    id="dob"
                    type="date"
                    value={innerDob}
                    onChange={(e) => setInnerDob(e.target.value)}
                    placeholder="Date of Birth"
                    className="input-field"
                />
                <input
                    aria-labelledby="register-input-button"
                    name="email"
                    id="email"
                    type="email"
                    value={innerEmail}
                    onChange={handleEmailChange}
                    placeholder="Email"
                    className="input-field"
                />
                {errorEmail && <p className="error-message">Error: {errorEmail}</p>}

                <input
                    aria-labelledby="register-input-button"
                    name="password"
                    id="password"
                    type="password"
                    value={innerPassword}
                    onChange={handlePasswordChange}
                    placeholder="Password"
                    className="input-field"
                />
                {errorPassword && <p className="error-message">Error: {errorPassword}</p>}

                <button
                    id="register-input-button"
                    type="button"
                    onClick={handleSubmit}
                    className="submit-button"
                >
                    Register
                </button>
            </form>
        </div>
    );
}

export default RegisterInput;
