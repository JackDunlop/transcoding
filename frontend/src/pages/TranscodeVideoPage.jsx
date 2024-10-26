import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL;

export default function TranscodeVideoPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const initialVideoNameUploaded = location.state?.videoNameUploaded || localStorage.getItem('videoNameUploaded');

    const [videoNameUploaded, setVideoNameUploaded] = useState(initialVideoNameUploaded || '');

    const [width, setWidth] = useState(localStorage.getItem('width') || '');
    const [height, setHeight] = useState(localStorage.getItem('height') || '');
    const [bitrate, setBitrate] = useState(localStorage.getItem('bitrate') || '');
    const [codec, setCodec] = useState(localStorage.getItem('codec') || '');
    const [format, setFormat] = useState(localStorage.getItem('format') || '');
    const [framerate, setFramerate] = useState(localStorage.getItem('framerate') || '');
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [transcodeID, setTranscodeID] = useState(localStorage.getItem('transcodeID') || '');

    useEffect(() => {
        localStorage.setItem('width', width);
    }, [width]);

    useEffect(() => {
        localStorage.setItem('height', height);
    }, [height]);

    useEffect(() => {
        localStorage.setItem('bitrate', bitrate);
    }, [bitrate]);

    useEffect(() => {
        localStorage.setItem('codec', codec);
    }, [codec]);

    useEffect(() => {
        localStorage.setItem('format', format);
    }, [format]);

    useEffect(() => {
        localStorage.setItem('framerate', framerate);
    }, [framerate]);

   
    useEffect(() => {
        if (videoNameUploaded) {
            localStorage.setItem('videoNameUploaded', videoNameUploaded);
        }
    }, [videoNameUploaded]);

 
    useEffect(() => {
        if (transcodeID && videoNameUploaded) {
            setStatus('Transcoding in progress');
            startPolling(transcodeID);
        }
        
    }, []); 

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
                'Authorization': `Bearer ${localStorage.getItem('token')}`
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
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                setStatus('Transcoding failed');
            } else {
                const newTranscodeID = data.transcodeID;
                if (newTranscodeID) {
                    localStorage.setItem('transcodeID', newTranscodeID); 
                    setTranscodeID(newTranscodeID); 
                    startPolling(newTranscodeID);
                    setStatus('Transcoding started');
                }
            }
        })
        .catch(error => {
            console.error('Error during transcoding:', error);
            setStatus('Error during transcoding');
        });
    };

    const videoNameParts = videoNameUploaded.split(".");
    const videoNameExt = videoNameParts[0];
    const videoNameWithoutExt = videoNameParts[1];
    const videoNameWithTranscode = `${videoNameExt}_${transcodeID}`;
    const videoNameWithTranscodeWithExt = `${videoNameWithTranscode}.${videoNameWithoutExt}`;

    const startPolling = (currentTranscodeID) => {
        const interval = setInterval(() => {
            console.log(`${API_URL}/transcode/poll/${currentTranscodeID}`);
            fetch(`${API_URL}/transcode/poll/${currentTranscodeID}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        videoNameWithTranscodeWithExt,
                    }),
                })
            .then(response => response.json())
            .then(data => {
                console.log(data);
                if (data.error && data.message === 'Transcode ID not found.') {
                    console.warn('Cache miss: Transcode ID not found. Continuing to poll...');
                } else if (data.error) {
                    setStatus('Error fetching status');
                    clearInterval(interval);
                } else {
                    setStatus(data.status);
                    setProgress(data.progress);
                    if (data.status === 'finished' || data.status === 'error') {
                        clearInterval(interval);
                        localStorage.removeItem('transcodeID');  
                        setTranscodeID('');
                        if (data.status === 'finished') {
                            setStatus('Transcoding finished');
                        } else {
                            setStatus('Transcoding encountered an error');
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching status:', error);
            });
        }, 2500);
    };

    const handleDownload = () => {
        const username = localStorage.getItem("username");
        const s3Key = `users/${username}/transcoded/${videoNameWithTranscodeWithExt}`;
        const url = `${API_URL}/download/${videoNameWithTranscodeWithExt}`;
        fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to download video');
            }
            return response.blob();
        })
        .then(blob => {
            const downloadUrl = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `${videoNameUploaded}_transcoded.mp4`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        })
        .catch(error => {
            console.error('Error during video download:', error);
            setStatus('Error downloading video');
        });
    };

    return (
        <div className="transcode-video-page">
            <h1>Transcoding Video</h1>
            {videoNameUploaded ? (
                <>
                    <form className="transcode-form" onSubmit={(e) => e.preventDefault()}>
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
                        <button
                            type="button"
                            onClick={handleTranscode}
                            className="transcode-btn"
                            disabled={transcodeID !== ''}
                        >
                            Start Transcoding
                        </button>
                    </form>
                    <div className="status-section">
                        <p>Status: {status}</p>
                        <p>Progress: {progress}%</p>
                        <progress value={progress} max={100}></progress>
                    </div>
                    {status === 'finished' && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="download-btn"
                        >
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
