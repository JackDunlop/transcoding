import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <nav className="main-nav">
      <ul className="nav-list">
        <li className="nav-item"><Link className="nav-link" to="/">Home</Link></li>
        <li className="nav-item"><Link className="nav-link" to="/transcoding">Video Transcoding</Link></li>
        <li className="nav-item"><Link className="nav-link" to="/register">Register</Link></li>
        <li className="nav-item"><Link className="nav-link" to="/login">Login</Link></li>
        <li className="nav-item"><Link className="nav-link" to="/logout">Logout</Link></li>
      </ul>
    </nav>
  );
}
