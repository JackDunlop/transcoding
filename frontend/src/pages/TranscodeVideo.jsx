import React, { useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react'; // AG Grid React component
import 'ag-grid-community/styles/ag-grid.css'; // AG Grid core styles
import 'ag-grid-community/styles/ag-theme-alpine.css'; // AG Grid Alpine theme
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation

const API_URL = process.env.REACT_APP_API_URL;

export default function Transcodevideo() {
  const [rowData, setRowData] = useState([]);
  const navigate = useNavigate(); 

  const [columnDefs] = useState([
    { headerName: "Original Name", field: "originalName" },
    { headerName: "MIME Type", field: "mimeType" },
    { headerName: "Size (bytes)", field: "size" },
    { headerName: "Duration (sec)", field: "duration" },
    { headerName: "Bit Rate", field: "bit_rate" },
    { headerName: "Codec", field: "codec" },
    { headerName: "Width", field: "width" },
    { headerName: "Height", field: "height" },
  ]);

  // Fetch video data from the API
  useEffect(() => {
    const url = `${API_URL}/users/list`;
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(response => response.json())
      .then(data => {
        if (!data.Error) {
          setRowData(data.FileStructure); 
        } else {
          console.error("Error fetching data:", data.Message);
        }
      })
      .catch(error => {
        console.error('Error fetching video info:', error);
      });
  }, []);

  // Handle row click event and navigate with state
  const onRowClicked = (row) => {
    const videoNameTypeUploaded = row.data.videoNameTypeUploaded;
    const videoNameUploaded = row.data.videoNameUploaded;
    
    navigate(`/transcodevideo/${videoNameTypeUploaded}`, {
      state: { videoNameUploaded } 
    });
  };

  return (
    <div style={styles.container}>
      <div className="ag-theme-alpine" style={styles.grid}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          pagination={true}
          onRowClicked={onRowClicked}
        />
      </div>
    </div>
  );
}

// Styles for centering the grid
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center', 
    alignItems: 'center',     
    height: '90vh',           
    width: '100vw',           
    backgroundColor: '#374858a5', 
  },
  grid: {
    height: '500px',  
    width: '80%',     
  },
};
