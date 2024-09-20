import React from "react";
import { Link } from "react-router-dom";



const Landing = () => (
  <section className="landing">
    <div className="landing-content">
      <h1 className="landing-title">Awesome Video Transcoding!</h1>
      <Link to="/register">Register</Link>
      <Link to="/login">Login</Link>
      <Link to="/transcoding">Video Transcoding!</Link>
    </div>
  </section>
);

export default function Home() {
  return (
    <main>
      <Landing />
    </main>
  );
}