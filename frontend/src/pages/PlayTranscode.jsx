import React, { useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react'; // AG Grid React component
import 'ag-grid-community/styles/ag-grid.css'; // AG Grid core styles
import 'ag-grid-community/styles/ag-theme-alpine.css'; // AG Grid Alpine theme
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation

const API_URL = process.env.REACT_APP_API_URL;

export default function PlayTranscode() {
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
  
    useEffect(() => {
      const url = `${API_URL}/users/listtranscoded`;
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(response => response.json())
        .then(data => {
          if (!data.Error) {
            setRowData(data.transcodedList);
          } else {
            console.error("Error fetching data:", data.Message);
          }
        })
        .catch(error => {
          console.error('Error fetching video info:', error);
        });
    }, []);
  
    const onRowClicked = (row) => {
      const newFileNamePreSplit = row.data.newFilename;
      const newFileNameSplit = newFileNamePreSplit.split('.')
      const filename = newFileNamePreSplit
      const originalnamePreSplit = row.data.originalName;
      const originalnameSplit = originalnamePreSplit.split('.')
      const originalname = originalnameSplit[0]
      navigate(`/stream/${filename}`, {
        state: { filename , originalname} 
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
  
 
  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center', 
      alignItems: 'center',     
      height: '90vh', 
      width: '100vw', 
      backgroundColor: '#374858a5', 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden', 
    },
    grid: {
      height: '500px', 
      width: '80%', 
    },
}
