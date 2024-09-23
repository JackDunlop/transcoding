

export default function Logout() {

    function clearToken() {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.reload(); // is this correct? idk
        console.log("JWT token removed ");
    }

    return (<div className="logoff-div">  <button className="logoff-button" onClick={clearToken}>Logout</button></div>);
}