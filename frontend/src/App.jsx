import React, { useState } from 'react';
import UploadPhase from './components/UploadPhase';
import ChatPhase from './components/ChatPhase';
import { BookOpen } from 'lucide-react';

function App() {
  const [isUploaded, setIsUploaded] = useState(false);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-title">
          <BookOpen className="logo-icon" />
          NotebookLM Clone
        </div>
      </header>
      
      <main className="main-content">
        {!isUploaded ? (
          <UploadPhase onUploadSuccess={() => setIsUploaded(true)} />
        ) : (
          <ChatPhase />
        )}
      </main>
    </div>
  );
}

export default App;
