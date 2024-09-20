import { useState } from 'react';
const API_URL = process.env.REACT_APP_API_URL;
export default function UploadVideo() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState("");

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const handleUpload = async (e) => {
        e.preventDefault();

        if (!selectedFile) {
            setUploadStatus("Please select a file first.");
            return;
        }

        const formData = new FormData();
        formData.append('video', selectedFile);
        const url = `${API_URL}/upload/new`;
        console.log(`URL -> ${url}`);
  
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            const result = await response.json();
            console.log(result);
            if (response.ok) {
                setUploadStatus(`Upload successful: ${result.message}`);
            } else {
                setUploadStatus(`Upload failed: ${result.message}`);
            }
        } catch (error) {
            console.error("Error uploading file", error);
            setUploadStatus("Upload failed. Please try again.");
        }
    };

    return (
        <div className="uploadvideo-container">
            <h1>Upload a Video</h1>
            <form className="uploadvideo-form" onSubmit={handleUpload}>
                <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileChange} 
                    className="file-input" 
                />
                <button type="submit" className="upload-button">Upload Video</button>
            </form>
            <p className="upload-status">{uploadStatus}</p>
        </div>
    );
}
