import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL;

export default function TranscodeVideoPage() {
  const { transcodeID } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { videoNameUploaded: videoNameUploadedFromState } = location.state || {};

  const [videoNameUploaded, setVideoNameUploaded] = useState(
    videoNameUploadedFromState || sessionStorage.getItem('videoNameUploaded') || ''
  );

  // Other state variables
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [bitrate, setBitrate] = useState('');
  const [codec, setCodec] = useState('');
  const [format, setFormat] = useState('');
  const [framerate, setFramerate] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentTranscodeID, setCurrentTranscodeID] = useState(transcodeID || '');

  useEffect(() => {
    // If transcodeID is present in URL but videoNameUploaded is missing, retrieve from sessionStorage
    if (transcodeID && !videoNameUploaded) {
      const storedVideoName = sessionStorage.getItem('videoNameUploaded');
      if (storedVideoName) {
        setVideoNameUploaded(storedVideoName);
      }
    }
    if (currentTranscodeID && videoNameUploaded) {
      startPolling(currentTranscodeID, videoNameUploaded);
    }
    return () => {
      clearPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTranscodeID, videoNameUploaded]);

  let pollingInterval = null;

  const clearPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };

  const startPolling = (transcodeIDParam, videoNameUploadedParam) => {
    clearPolling();
    pollingInterval = setInterval(() => {
      console.log(`${API_URL}/transcode/poll/${transcodeIDParam}`);
      fetch(`${API_URL}/transcode/poll/${transcodeIDParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          videoNameWithTranscodeWithExt: constructVideoNameWithTranscode(transcodeIDParam),
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log(data);
          if (data.error && data.message === 'Transcode ID not found.') {
            console.warn('Cache miss: Transcode ID not found. Continuing to poll...');
          } else if (data.error) {
            setStatus('Error fetching status');
            clearPolling();
          } else {
            setStatus(data.status);
            setProgress(data.progress);
            if (data.status === 'finished' || data.status === 'error') {
              clearPolling();
              sessionStorage.removeItem('transcodeID');
              sessionStorage.removeItem('videoNameUploaded');
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching status:', error);
        });
    }, 2500);
  };

  const constructVideoNameWithTranscode = (transcodeIDParam) => {
    const videoNameParts = videoNameUploaded.split('.');
    const videoNameExt = videoNameParts.slice(0, -1).join('.');
    const videoNameWithoutExt = videoNameParts[videoNameParts.length - 1];
    const videoNameWithTranscode = `${videoNameExt}_${transcodeIDParam}`;
    const videoNameWithTranscodeWithExt = `${videoNameWithTranscode}.${videoNameWithoutExt}`;
    return videoNameWithTranscodeWithExt;
  };

  const handleTranscode = () => {
    if (!videoNameUploaded) {
      alert('No video to transcode');
      return;
    }
    const url = `${API_URL}/transcode/video/${videoNameUploaded}`;
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        width,
        height,
        bitrate,
        codec,
        format,
        framerate,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          setStatus('Transcoding failed');
        } else {
          const newTranscodeID = data.transcodeID;
          if (newTranscodeID) {
            setCurrentTranscodeID(newTranscodeID);
            setStatus('Transcoding started');
            sessionStorage.setItem('transcodeID', newTranscodeID);
            sessionStorage.setItem('videoNameUploaded', videoNameUploaded);
            navigate(`/transcodevideo/${newTranscodeID}`);
          }
        }
      })
      .catch((error) => {
        console.error('Error during transcoding:', error);
        setStatus('Error during transcoding');
      });
  };

  const handleDownload = () => {
    const videoNameWithTranscodeWithExt = constructVideoNameWithTranscode(currentTranscodeID);
    const url = `${API_URL}/download/${videoNameWithTranscodeWithExt}`;
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to download video');
        }
        return response.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `${videoNameUploaded}_transcoded.${videoNameUploaded.split('.').pop()}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      })
      .catch((error) => {
        console.error('Error during video download:', error);
        setStatus('Error downloading video');
      });
  };

  return (
    <div className="transcode-video-page">
      <h1>Transcoding Video</h1>
      {videoNameUploaded ? (
        <>
          <form className="transcode-form">
            <div className="form-group">
              <label>
                Width:
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Height:
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Bitrate:
                <input
                  type="text"
                  value={bitrate}
                  onChange={(e) => setBitrate(e.target.value)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Codec:
                <input
                  type="text"
                  value={codec}
                  onChange={(e) => setCodec(e.target.value)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Format:
                <input
                  type="text"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Framerate:
                <input
                  type="text"
                  value={framerate}
                  onChange={(e) => setFramerate(e.target.value)}
                />
              </label>
            </div>
            <button type="button" onClick={handleTranscode} className="transcode-btn">
              Start Transcoding
            </button>
          </form>
          <div className="status-section">
            <p>Status: {status}</p>
            <p>Progress: {progress}%</p>
            <progress value={progress} max={100}></progress>
          </div>
          {status === 'finished' && (
            <button type="button" onClick={handleDownload} className="download-btn">
              Download Video
            </button>
          )}
        </>
      ) : (
        <p>No video selected for transcoding.</p>
      )}
    </div>
  );
}
