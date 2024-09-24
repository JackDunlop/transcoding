import './App.css';
// components
import Header from "./components/Header";
import Footer from "./components/Footer";

// pages
import Landing from "./pages/Landing";
import Transcoding from "./pages/Transcoding";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Logout from "./pages/Logout"
import Transcodevideo from './pages/TranscodeVideo';
import ListOfTranscodedVideos from './pages/ListOfTranscodedVideos';
import ListOfUploadedVideos from './pages/ListOfUploadedVideos';
import ListOfTranscodedVideosAdmin from './pages/ListOfTranscodedAdminVideos';
import UploadVideo from './pages/UploadVideo';
import TranscodeVideoPage from './pages/TranscodeVideoPage';
import PlayTranscode from './pages/PlayTranscode';
import Stream from './pages/Stream';



import { BrowserRouter, Routes, Route } from 'react-router-dom';





function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Header />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/transcoding" element={<Transcoding />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/transcodevideo" element={<Transcodevideo />} />
          <Route path="/listoftranscodedvideos" element={<ListOfTranscodedVideos />} />
          <Route path="/listofuploadedvideos" element={<ListOfUploadedVideos />} />
          <Route path="/uploadvideo" element={<UploadVideo />} />
          <Route path="/playtranscode" element={<PlayTranscode />} />
          <Route path="/transcodevideo/:videoNameTypeUploaded" element={<TranscodeVideoPage />} />
          <Route path="/stream/:filename" element={<Stream />} />
          <Route path="/listoftranscodedvideosadmin" element={<ListOfTranscodedVideosAdmin />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
