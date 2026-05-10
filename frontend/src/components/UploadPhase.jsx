import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

const UploadPhase = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setError('');
    const validTypes = [
      'application/pdf', 
      'text/plain', 
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (validTypes.includes(selectedFile.type) || 
        selectedFile.name.endsWith('.pdf') ||
        selectedFile.name.endsWith('.txt') ||
        selectedFile.name.endsWith('.csv') ||
        selectedFile.name.endsWith('.docx')) {
      setFile(selectedFile);
    } else {
      setError('Please upload a supported file format (.pdf, .txt, .csv, .docx)');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://genai-rag.onrender.com';
      await axios.post(`${apiUrl}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      onUploadSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error uploading file. Please ensure backend is running.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <h1 className="upload-title">Welcome to NotebookLM</h1>
      <p className="upload-subtitle">Upload your document to start asking questions.</p>

      <div 
        className={`drop-zone ${isDragging ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <UploadCloud className="drop-icon" />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <File size={20} />
            <span style={{ fontWeight: 500 }}>{file.name}</span>
          </div>
        ) : (
          <div>
            <h3>Drag & Drop your file here</h3>
            <p className="supported-formats">or click to browse</p>
          </div>
        )}
        <p className="supported-formats">Supported formats: PDF, TXT, CSV, DOCX</p>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInput} 
          className="file-input"
          accept=".pdf,.txt,.csv,.docx"
        />
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <button 
        className="upload-button" 
        onClick={handleUpload}
        disabled={!file || isUploading}
      >
        {isUploading ? (
          <>
            <div className="loader"></div>
            Processing Document...
          </>
        ) : (
          'Upload & Analyze'
        )}
      </button>
    </div>
  );
};

export default UploadPhase;
