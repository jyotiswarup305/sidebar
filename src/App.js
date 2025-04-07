// src/App.js
import React, { useEffect, useState } from 'react';

const getQueryParam = (param) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
};

function App() {
  const [spaceId, setSpaceId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [storyId, setStoryId] = useState(null);

  useEffect(() => {
    setSpaceId(getQueryParam('space_id'));
    setUserId(getQueryParam('user_id'));
  }, []);

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h2>🔧 Storyblok Sidebar Extension</h2>
      <p><strong>Space ID:</strong> {spaceId || 'Not available'}</p>
      <p><strong>User ID:</strong> {userId || 'Not available'}</p>
    </div>
  );
}

export default App;
