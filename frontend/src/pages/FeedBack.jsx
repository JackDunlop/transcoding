import React, { useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css'; 
import 'ag-grid-community/styles/ag-theme-alpine.css'; 

const API_URL = process.env.REACT_APP_API_URL; 

export default function FeedBack () {
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);


  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/users/getallfeedback`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setFeedbackList(data.feedback);
      } else {
        setError(data.message || 'Failed to fetch feedback.');
      }
    } catch (err) {
      console.error('Error fetching feedback:', err);
      setError('An error occurred while fetching feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!feedbackInput.trim()) {
      setError('Feedback cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: feedbackInput }),
      });

      const data = await response.json();

      if (response.ok) {
        setFeedbackInput(''); 
        fetchFeedback(); 
      } else {
        setError(data.message || 'Failed to submit feedback.');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('An error occurred while submitting feedback.');
    }
  };

 
  const columns = [
    { headerName: 'Submitted By', field: 'submittedby', sortable: true, filter: true },
    { headerName: 'Feedback', field: 'feedback', sortable: true, filter: true, flex: 1 },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2>User Feedback</h2>

    
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder="Enter your feedback"
            style={{ flex: 1, padding: '10px' }}
          />
          <button type="submit" style={{ padding: '10px 20px' }}>
            Submit Feedback
          </button>
        </div>
      </form>

    
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}

   
      <div className="ag-theme-alpine" style={{ height: '400px', width: '100%' }}>
        <AgGridReact
          rowData={feedbackList}
          columnDefs={columns}
          pagination={true}
          paginationPageSize={10}
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true,
          }}
        />
      </div>


      {loading && (
        <div style={{ marginTop: '20px' }}>
          Loading feedback...
        </div>
      )}
    </div>
  );
};


