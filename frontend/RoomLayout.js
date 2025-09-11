
import React, { useState, useEffect } from 'react';
import './RoomLayout.css';

const RoomLayout = () => {
  const [tvs, setTvs] = useState([]);
  const [presets, setPresets] = useState([]);
  const [systemStatus, setSystemStatus] = useState({});
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Input/Source definitions
  const videoInputs = {
    1: "ESPN HD",
    2: "Fox Sports 1", 
    3: "NBC Sports",
    4: "Local Broadcast",
    5: "CNN",
    6: "Weather Channel",
    7: "Music Videos",
    8: "Menu Channel"
  };

  const audioSources = {
    1: "ESPN Audio",
    2: "Fox Sports Audio",
    3: "NBC Sports Audio", 
    4: "Local Audio",
    5: "CNN Audio",
    6: "Weather Audio",
    7: "Background Music",
    8: "Ambient/Menu Audio"
  };

  // Fetch system status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      
      setSystemStatus(data.system);
      setPresets(Object.values(data.presets));
      setSyncEnabled(data.system.sync_enabled);
      
      // Convert mappings to TV array with current routes
      const tvArray = Object.values(data.mappings).map(mapping => ({
        id: mapping.video_output,
        name: mapping.name || `TV ${mapping.video_output}`,
        videoOutput: mapping.video_output,
        audioZone: mapping.audio_zone,
        currentVideoInput: data.current_routes.video[mapping.video_output] || 1,
        currentAudioSource: data.current_routes.audio[mapping.audio_zone]?.source || 1,
        volume: data.current_routes.audio[mapping.audio_zone]?.volume || 0.5,
        muted: data.current_routes.audio[mapping.audio_zone]?.muted || false
      }));
      
      setTvs(tvArray);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setLoading(false);
    }
  };

  // Recall preset
  const recallPreset = async (presetId) => {
    try {
      const response = await fetch(`/api/preset/${presetId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchStatus(); // Refresh status
        showNotification(`Preset "${presets.find(p => p.id === presetId)?.name}" activated`, 'success');
      } else {
        showNotification('Failed to activate preset', 'error');
      }
    } catch (error) {
      console.error('Preset recall failed:', error);
      showNotification('Failed to activate preset', 'error');
    }
  };

  // Toggle sync
  const toggleSync = async () => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !syncEnabled })
      });
      const data = await response.json();
      
      if (data.success) {
        setSyncEnabled(data.sync_enabled);
        showNotification(`Sync ${data.sync_enabled ? 'enabled' : 'disabled'}`, 'info');
      } else {
        showNotification('Failed to toggle sync', 'error');
      }
    } catch (error) {
      console.error('Sync toggle failed:', error);
      showNotification('Failed to toggle sync', 'error');
    }
  };

  // Change video input
  const changeVideoInput = async (tvId, inputId) => {
    try {
      const response = await fetch('/api/manual_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          output: tvId, 
          input: parseInt(inputId) 
        })
      });
      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setTvs(prevTvs => 
          prevTvs.map(tv => 
            tv.id === tvId 
              ? { ...tv, currentVideoInput: parseInt(inputId) }
              : tv
          )
        );
      } else {
        showNotification('Failed to change video input', 'error');
      }
    } catch (error) {
      console.error('Video input change failed:', error);
      showNotification('Failed to change video input', 'error');
    }
  };

  // Change volume
  const changeVolume = async (tvId, volume) => {
    const tv = tvs.find(t => t.id === tvId);
    if (!tv) return;

    try {
      const response = await fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zone_id: tv.audioZone, 
          volume: parseFloat(volume) 
        })
      });
      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setTvs(prevTvs => 
          prevTvs.map(t => 
            t.id === tvId 
              ? { ...t, volume: parseFloat(volume) }
              : t
          )
        );
      } else {
        showNotification('Failed to change volume', 'error');
      }
    } catch (error) {
      console.error('Volume change failed:', error);
      showNotification('Failed to change volume', 'error');
    }
  };

  // Toggle mute
  const toggleMute = async (tvId) => {
    const tv = tvs.find(t => t.id === tvId);
    if (!tv) return;

    try {
      const response = await fetch('/api/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zone_id: tv.audioZone, 
          muted: !tv.muted 
        })
      });
      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setTvs(prevTvs => 
          prevTvs.map(t => 
            t.id === tvId 
              ? { ...t, muted: !t.muted }
              : t
          )
        );
      } else {
        showNotification('Failed to toggle mute', 'error');
      }
    } catch (error) {
      console.error('Mute toggle failed:', error);
      showNotification('Failed to toggle mute', 'error');
    }
  };

  // Simple notification system
  const showNotification = (message, type) => {
    // In a real app, you'd use a proper notification library
    console.log(`${type.toUpperCase()}: ${message}`);
    // You could also show a toast notification here
  };

  // Load data on component mount
  useEffect(() => {
    fetchStatus();
    
    // Set up periodic refresh
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="room-layout loading">
        <div className="loading-spinner">Loading Sports Bar Control...</div>
      </div>
    );
  }

  return (
    <div className="room-layout">
      {/* Header */}
      <div className="header">
        <h1>🏈 Sports Bar AV Control</h1>
        <div className="status-bar">
          <div className="status-indicators">
            <div className={`status-indicator ${systemStatus.wolfpack_connected ? 'connected' : 'disconnected'}`}>
              <span className="indicator-dot"></span>
              Video Matrix
            </div>
            <div className={`status-indicator ${systemStatus.atmosphere_connected ? 'connected' : 'disconnected'}`}>
              <span className="indicator-dot"></span>
              Audio Processor
            </div>
          </div>
          <div className="sync-control">
            <label>
              Bi-Directional Sync:
              <button 
                className={`sync-toggle ${syncEnabled ? 'enabled' : 'disabled'}`}
                onClick={toggleSync}
              >
                {syncEnabled ? 'ON' : 'OFF'}
              </button>
            </label>
          </div>
        </div>
      </div>

      {/* Presets Section */}
      <div className="presets-section">
        <h2>Quick Presets</h2>
        <div className="presets-grid">
          {presets.map(preset => (
            <div 
              key={preset.id}
              className="preset-card"
              onClick={() => recallPreset(preset.id)}
            >
              <h3>{preset.name}</h3>
              <p>{preset.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TV Controls Grid */}
      <div className="tv-controls-section">
        <h2>Individual TV Controls</h2>
        <div className="tv-grid">
          {tvs.map(tv => (
            <div key={tv.id} className="tv-card">
              <div className="tv-header">
                <h3>{tv.name}</h3>
                <div className="tv-status">
                  <span className="video-input">
                    📺 {videoInputs[tv.currentVideoInput]}
                  </span>
                  <span className="audio-source">
                    🔊 {audioSources[tv.currentAudioSource]}
                  </span>
                </div>
              </div>

              <div className="tv-controls">
                {/* Video Input Control */}
                <div className="control-group">
                  <label>Video Input:</label>
                  <select 
                    value={tv.currentVideoInput}
                    onChange={(e) => changeVideoInput(tv.id, e.target.value)}
                  >
                    {Object.entries(videoInputs).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* Volume Control */}
                <div className="control-group">
                  <label>Volume: {Math.round(tv.volume * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={tv.volume}
                    onChange={(e) => changeVolume(tv.id, e.target.value)}
                    className="volume-slider"
                  />
                </div>

                {/* Mute Button */}
                <div className="control-group">
                  <button 
                    className={`mute-button ${tv.muted ? 'muted' : 'unmuted'}`}
                    onClick={() => toggleMute(tv.id)}
                  >
                    {tv.muted ? '🔇 UNMUTE' : '🔊 MUTE'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoomLayout;
