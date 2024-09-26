import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom'; 
import { Player } from 'video-react';
import 'video-react/dist/video-react.css'; 

const apiUrl = process.env.REACT_APP_API_URL; 
const API_URL = `${apiUrl}/transcode/stream`; 

export default function Stream() {
    const location = useLocation();
    const { filename, originalname } = location.state || {}; 
    const [videoSrc, setVideoSrc] = useState('');
    const [recommendedVideos, setRecommendedVideos] = useState([]);
    const [youtubeUrl, setYoutubeUrl] = useState(''); 

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token'); 
            const fetchSecret = async () => {
                try {
                    const response = await fetch(`${apiUrl}/users/secertRetriever`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ name: "n11431415/assignment/youtube" }),
                    });

                    const data = await response.json();
                    if (!data.Error) {
                        const parsedSecret = JSON.parse(data.secert);
                        return parsedSecret.youtube; 
                    } else {
                        console.error('Error retrieving secret:', data.Message);
                    }
                } catch (error) {
                    console.error('Secret fetch error:', error);
                }
                return null; 
            };

            const fetchParameter = async (parameterInput) => {
                try {
                    const response = await fetch(`${apiUrl}/users/parameterRetriever`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ name:  parameterInput }),
                    });

                    const data = await response.json();
                    if (!data.Error) {
                        return data.paramter; 
                    } else {
                        console.error('Error retrieving parameter:', data.Message);
                    }
                } catch (error) {
                    console.error('Parameter fetch error:', error);
                }
                return null; 
            };

            const fetchVideo = async () => {
                if (filename && token) {
                    try {
                        const response = await fetch(`${API_URL}/${filename}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                            },
                        });
                        const data = await response.json();
                        if (!data.error) {
                            console.log(data.streamUrl.url);
                            setVideoSrc(data.streamUrl.url); 
                        } else {
                            console.error("Error fetching data:", data.message);
                        }
                    } catch (error) {
                        console.error('Fetch error:', error);
                    }
                }
            };

            const fetchRecommendedVideos = async (apiKey, YOUTUBE_API_URL) => {
                if (originalname && apiKey) {
                    try {
                        const response = await fetch(`${YOUTUBE_API_URL}?part=snippet&q=${originalname}&key=${apiKey}&type=video`);
                        const data = await response.json();
                        setRecommendedVideos(data.items || []);
                    } catch (error) {
                        console.error('YouTube API fetch error:', error);
                    }
                }
            };

            const apiKey = await fetchSecret();
            const YOUTUBE_API_URL = await fetchParameter("/n11431415/assignment/YOUTUBE_API_URL");
            const YOUTUBE_URL = await fetchParameter("/n11431415/assignment/YOUTUBE_URL");
            setYoutubeUrl(YOUTUBE_URL); 
            await fetchVideo();
            await fetchRecommendedVideos(apiKey, YOUTUBE_API_URL);
        };

        fetchData(); 
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
                            <a href={`${youtubeUrl}${video.id.videoId}`} target="_blank" rel="noopener noreferrer">
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
