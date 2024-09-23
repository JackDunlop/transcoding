import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom'; 
import { Player } from 'video-react';
import 'video-react/dist/video-react.css'; 

const apiUrl = process.env.REACT_APP_API_URL; 
const API_URL = `${apiUrl}/transcode/stream`; 
const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

export default function Stream() {
    const location = useLocation();
    const { filename, originalname } = location.state || {}; 
    const [videoSrc, setVideoSrc] = useState('');
    const [recommendedVideos, setRecommendedVideos] = useState([]);

    useEffect(() => {
        const token = localStorage.getItem('token'); 
        
        if (filename && token) {
            const fetchVideo = async () => {
                try {
                   
                    const response = await fetch(`${API_URL}/${filename}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (!data.error) {
                            setVideoSrc(data.streamUrl.url); 
                        } else {
                            console.error("Error fetching data:", data.message);
                        }
                    })
                } catch (error) {
                    console.error('Fetch error:', error);
                }
            };

            fetchVideo();
        }

        const fetchRecommendedVideos = async () => {
            try {
                const response = await fetch(`${YOUTUBE_API_URL}?part=snippet&q=${originalname}&key=${YOUTUBE_API_KEY}&type=video`);
                const data = await response.json();
                setRecommendedVideos(data.items || []);
            } catch (error) {
                console.error('YouTube API fetch error:', error);
            }
        };

        if (originalname) {
            fetchRecommendedVideos();
        }
    }, [filename, originalname]);

    return (
        <div className="stream-container">
        <div className="video-wrapper">
            <h1 className="title">Play Transcoded Video: {originalname}</h1>
            {videoSrc ? (
                <Player
                    playsInline
                    src={videoSrc}
                    fluid={false}
                    width={800}
                    height={600}
                />
            ) : (
                <p className="loading-message">Video is loading... This may take a while for larger videos.</p>
            )}
        </div>
        
        <div className="recommended-videos-wrapper">
            <h2 className="recommended-title">Recommended Videos</h2>
            <div className="recommendations">
                {recommendedVideos.map(video => (
                    <div key={video.id.videoId} className="recommended-video">
                        <a href={`https://www.youtube.com/watch?v=${video.id.videoId}`} target="_blank" rel="noopener noreferrer">
                            <img src={video.snippet.thumbnails.default.url} alt={video.snippet.title} className="thumbnail"/>
                            <p className="video-title">{video.snippet.title}</p>
                        </a>
                    </div>
                ))}
            </div>
        </div>
    </div>
    );
}


