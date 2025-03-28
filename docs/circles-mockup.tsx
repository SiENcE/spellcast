import React, { useState } from 'react';

const SpellCastWithCircles = () => {
  // Mock state
  const [activeTab, setActiveTab] = useState('feed');
  const [circles, setCircles] = useState([
    { id: '1', name: 'Friends', peers: ['peer1', 'peer2'] },
    { id: '2', name: 'Work', peers: ['peer3'] },
    { id: '3', name: 'Family', peers: ['peer2', 'peer4'] }
  ]);
  const [selectedCircle, setSelectedCircle] = useState('all');
  const [peers, setPeers] = useState([
    { id: 'peer1', username: 'Alice', status: 'online' },
    { id: 'peer2', username: 'Bob', status: 'online' },
    { id: 'peer3', username: 'Charlie', status: 'offline' },
    { id: 'peer4', username: 'Diana', status: 'online' }
  ]);
  const [newCircleName, setNewCircleName] = useState('');
  const [draggingPeer, setDraggingPeer] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Mock functions
  const handleCreateCircle = () => {
    if (newCircleName.trim()) {
      setCircles([...circles, { id: Date.now().toString(), name: newCircleName, peers: [] }]);
      setNewCircleName('');
    }
  };
  
  const handleDragStart = (peerId) => {
    setDraggingPeer(peerId);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  
  const handleDropOnCircle = (circleId) => {
    if (!draggingPeer) return;
    
    setCircles(circles.map(circle => {
      if (circle.id === circleId && !circle.peers.includes(draggingPeer)) {
        return { ...circle, peers: [...circle.peers, draggingPeer] };
      }
      return circle;
    }));
    
    setDraggingPeer(null);
  };
  
  const handleRemovePeerFromCircle = (circleId, peerId) => {
    setCircles(circles.map(circle => {
      if (circle.id === circleId) {
        return { ...circle, peers: circle.peers.filter(p => p !== peerId) };
      }
      return circle;
    }));
  };
  
  const handleDeleteCircle = (circleId) => {
    setCircles(circles.filter(circle => circle.id !== circleId));
    if (selectedCircle === circleId) {
      setSelectedCircle('all');
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar for circles */}
      {showSidebar && (
        <div className="w-64 bg-white shadow-md p-4">
          <h2 className="text-xl font-bold mb-4">Circles</h2>
          
          <div className="mb-4">
            <div 
              className={`p-2 mb-1 rounded cursor-pointer ${selectedCircle === 'all' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              onClick={() => setSelectedCircle('all')}
            >
              All Peers
            </div>
          </div>
          
          <h3 className="font-semibold mb-2">Your Circles</h3>
          <div className="space-y-1 mb-4">
            {circles.map(circle => (
              <div 
                key={circle.id}
                className={`p-2 rounded flex justify-between items-center cursor-pointer ${selectedCircle === circle.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                onClick={() => setSelectedCircle(circle.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnCircle(circle.id)}
              >
                <div>
                  <span>{circle.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({circle.peers.length})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">SpellCast</h1>
            <div className="flex items-center space-x-2">
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                {showSidebar ? '◀ Hide Circles' : '▶ Show Circles'}
              </button>
              <span>Logged in as: <strong>YourUsername</strong></span>
            </div>
          </div>
        </header>
        
        {/* Tabs */}
        <div className="flex border-b">
          <div 
            className={`px-4 py-2 cursor-pointer ${activeTab === 'feed' ? 'border-b-2 border-blue-500 text-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            Feed
          </div>
          <div 
            className={`px-4 py-2 cursor-pointer ${activeTab === 'peers' ? 'border-b-2 border-blue-500 text-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('peers')}
          >
            Connect
          </div>
          <div 
            className={`px-4 py-2 cursor-pointer ${activeTab === 'circles' ? 'border-b-2 border-blue-500 text-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('circles')}
          >
            Circles
          </div>
          <div 
            className={`px-4 py-2 cursor-pointer ${activeTab === 'profile' ? 'border-b-2 border-blue-500 text-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Feed tab */}
          {activeTab === 'feed' && (
            <div>
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <textarea
                  className="w-full p-2 border rounded resize-none mb-2"
                  placeholder="Cast your spell..."
                  rows="3"
                />
                <div className="flex justify-between items-center">
                  <div>
                    <select 
                      className="border rounded p-1 text-sm"
                      value={selectedCircle}
                      onChange={(e) => setSelectedCircle(e.target.value)}
                    >
                      <option value="all">All Peers</option>
                      {circles.map(circle => (
                        <option key={circle.id} value={circle.id}>
                          {circle.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full font-medium">
                    Cast
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Sample tweets/casts */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between mb-2">
                    <div className="font-bold">Alice</div>
                    <div className="text-gray-500 text-sm">2023-03-04 12:34</div>
                  </div>
                  <div className="mb-2">Hello SpellCast world! This is my first cast.</div>
                  <div className="text-xs text-gray-500">
                    Sent to: All Peers
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between mb-2">
                    <div className="font-bold">Bob</div>
                    <div className="text-gray-500 text-sm">2023-03-04 12:30</div>
                  </div>
                  <div className="mb-2">Just joined the Friends circle!</div>
                  <div className="text-xs text-gray-500">
                    Sent to: Friends
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Peers tab */}
          {activeTab === 'peers' && (
            <div>
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="text-lg font-semibold mb-2">Connect to a peer</h2>
                <div className="flex">
                  <input 
                    type="text" 
                    className="flex-1 border rounded-l p-2" 
                    placeholder="Enter peer ID"
                  />
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r">
                    Connect
                  </button>
                </div>
              </div>
              
              <h2 className="text-lg font-semibold mb-2">Connected Peers</h2>
              <div className="space-y-2">
                {peers.map(peer => (
                  <div 
                    key={peer.id}
                    className="bg-white rounded-lg shadow p-4 flex justify-between items-center"
                    draggable
                    onDragStart={() => handleDragStart(peer.id)}
                  >
                    <div>
                      <div className="font-semibold">{peer.username}</div>
                      <div className="text-xs text-gray-500">{peer.id}</div>
                      <div className={`text-sm font-medium ${peer.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                        {peer.status.charAt(0).toUpperCase() + peer.status.slice(1)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Drag to add to a circle →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Circles tab */}
          {activeTab === 'circles' && (
            <div>
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="text-lg font-semibold mb-2">Create New Circle</h2>
                <div className="flex mb-4">
                  <input 
                    type="text" 
                    className="flex-1 border rounded-l p-2" 
                    placeholder="Circle name"
                    value={newCircleName}
                    onChange={(e) => setNewCircleName(e.target.value)}
                  />
                  <button 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
                    onClick={handleCreateCircle}
                  >
                    Create
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  Create circles to group your peers and send messages to specific groups.
                </p>
              </div>
              
              <h2 className="text-lg font-semibold mb-2">Manage Circles</h2>
              <div className="space-y-4">
                {circles.map(circle => (
                  <div 
                    key={circle.id}
                    className="bg-white rounded-lg shadow"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropOnCircle(circle.id)}
                  >
                    <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-semibold">{circle.name}</h3>
                      <button 
                        className="text-red-500 hover:text-red-700 text-sm"
                        onClick={() => handleDeleteCircle(circle.id)}
                      >
                        Delete Circle
                      </button>
                    </div>
                    <div className="p-4">
                      <h4 className="text-sm text-gray-600 mb-2">Members ({circle.peers.length})</h4>
                      {circle.peers.length === 0 ? (
                        <p className="text-sm text-gray-500">No peers in this circle yet. Drag peers here to add them.</p>
                      ) : (
                        <div className="space-y-2">
                          {circle.peers.map(peerId => {
                            const peer = peers.find(p => p.id === peerId);
                            return peer ? (
                              <div key={peerId} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                <span>{peer.username}</span>
                                <button 
                                  className="text-red-500 hover:text-red-700 text-xs"
                                  onClick={() => handleRemovePeerFromCircle(circle.id, peerId)}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Profile tab would go here but omitted for brevity */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
              <div className="mb-4">
                <p><strong>Username:</strong> YourUsername</p>
                <p><strong>Peer ID:</strong> your-peer-id-here</p>
              </div>
              <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
                Delete Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpellCastWithCircles;
