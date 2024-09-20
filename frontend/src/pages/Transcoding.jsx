import { Link } from 'react-router-dom';


export default function Transcoding() {
  return (
    <div className="transcoding-div">
      <h1>Transcode Page</h1>


      <div className="transcoding-section">
        <button className="transcoding-button">
          <Link className="transcoding-link" to="/uploadvideo">Upload a Video</Link>
        </button>
      </div>

      <div className="transcoding-section">
        <button className="transcoding-button">
          <Link className="transcoding-link" to="/transcodevideo">Transcode a Video</Link>
        </button>
      </div>

      <div className="transcoding-section">
        <button className="transcoding-button">
          <Link className="transcoding-link" to="/listoftranscodedvideos">List of transcoded videos</Link>
        </button>
      </div>

      <div className="transcoding-section">
        <button className="transcoding-button">
          <Link className="transcoding-link" to="/listofuploadedvideos">List of uploaded videos</Link>
        </button>
      </div>

      
      <div className="transcoding-section">
        <button className="transcoding-button">
          <Link className="transcoding-link" to="/playtranscode">Play Transcoded Video</Link>
        </button>
      </div>
    </div>
  );
}
