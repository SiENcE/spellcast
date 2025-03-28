// Manages UI components, event listeners and display logic

export class UIManager {
  constructor(userManager, peerManager, tweetManager, storageManager, mediaManager) {
    this.userManager = userManager;
    this.peerManager = peerManager;
    this.tweetManager = tweetManager;
    this.storageManager = storageManager;
	this.mediaManager = mediaManager;

    // DOM elements
    this.elements = {
      // Elements for media handling
      mediaUploadButton: null,
      mediaInput: null,
      mediaPreviewContainer: null,
      tweetMediaContainer: null,

      // Containers
      introContainer: document.getElementById('intro-container'),
      setupContainer: document.getElementById('setup-container'),
      loginContainer: document.getElementById('login-container'),
      appContainer: document.getElementById('app-container'),
      feedContainer: document.getElementById('feed-container'),
      peersContainer: document.getElementById('peers-container'),
      profileContainer: document.getElementById('profile-container'),

      // Content areas
      credentialsArea: document.getElementById('credentials'),
      tweetsContainer: document.getElementById('tweets-container'),
      peersList: document.getElementById('peers-list'),

      // Navigation
      feedTab: document.getElementById('feed-tab'),
      peersTab: document.getElementById('peers-tab'),
      profileTab: document.getElementById('profile-tab'),

      // Buttons
      createButton: document.getElementById('create-button'),
      loginButton: document.getElementById('login-button'),
      generateButton: document.getElementById('generate-button'),
      continueButton: document.getElementById('continue-button'),
      loginContinueButton: document.getElementById('login-continue-button'),
      tweetButton: document.getElementById('tweet-button'),
      connectButton: document.getElementById('connect-button'),
      deleteAccountButton: document.getElementById('delete-account-button'),
      deleteAllMessagesButton: document.getElementById('delete-all-messages-button'),

      // Inputs
      usernameInput: document.getElementById('username'),
      loginUsernameInput: document.getElementById('login-username'),
      loginPeerIdInput: document.getElementById('login-peerid'),
      tweetContentInput: document.getElementById('tweet-content'),
      connectIdInput: document.getElementById('connect-id'),

      // Information displays
      peerIdDisplay: document.getElementById('peer-id'),
      statusElement: document.getElementById('status'),
      currentUserElement: document.getElementById('current-user'),
      profileUsername: document.getElementById('profile-username'),
      profilePeerId: document.getElementById('profile-peerid'),

      // Visual elements
      qrcode: document.getElementById('qrcode'),
      profileQrcode: document.getElementById('profile-qrcode'),
      connectionQualityIndicator: document.getElementById('connection-quality')
    };

    // Media state tracking
    this.pendingMediaFile = null;

    // Bind methods to maintain 'this' context
    this.setupEventListeners = this.setupEventListeners.bind(this);
    this.renderTweets = this.renderTweets.bind(this);
    this.updatePeersList = this.updatePeersList.bind(this);
    this.updateConnectionStatus = this.updateConnectionStatus.bind(this);
    this.showIntroScreen = this.showIntroScreen.bind(this);
    this.connectToPeer = this.connectToPeer.bind(this);
    this.handleStatusUpdate = this.handleStatusUpdate.bind(this);
    this.handleConnectionQualityUpdate = this.handleConnectionQualityUpdate.bind(this);
    this.formatTimestamp = this.formatTimestamp.bind(this);

    // Bind media-related methods
    this.handleMediaUpload = this.handleMediaUpload.bind(this);
    this.clearMediaPreview = this.clearMediaPreview.bind(this);
    this.createTweetWithMedia = this.createTweetWithMedia.bind(this);
    this.displayMediaPreview = this.displayMediaPreview.bind(this);
    this.renderMediaInTweet = this.renderMediaInTweet.bind(this);
  }

  /**
   * Set up all event listeners for the UI
   */
  setupEventListeners() {
    // Navigation event listeners
    this.elements.createButton.addEventListener('click', () => {
      this.elements.introContainer.style.display = 'none';
      this.elements.setupContainer.style.display = 'block';
    });

    this.elements.loginButton.addEventListener('click', () => {
      this.elements.introContainer.style.display = 'none';
      this.elements.loginContainer.style.display = 'block';
    });

    this.elements.deleteAllMessagesButton.addEventListener('click', this.deleteAllMessages.bind(this));

    this.elements.generateButton.addEventListener('click', async () => {
      const username = this.elements.usernameInput.value.trim();
      if (!username) {
        alert('Please enter a username');
        return;
      }

      // Save username in user manager
      this.userManager.username = username;

      try {
        // Initialize peer connection
        const peerId = await this.peerManager.initializePeer();

        // Display the peer ID and QR code
        this.elements.peerIdDisplay.textContent = peerId;
        this.elements.credentialsArea.style.display = 'block';

        // Generate QR code
        new QRCode(this.elements.qrcode, {
          text: peerId,
          width: 200,
          height: 200
        });
      } catch (error) {
        console.error('Error initializing peer:', error);
        alert(`Error creating peer connection: ${error.message}`);
      }
    });

    this.elements.continueButton.addEventListener('click', () => {
      this.elements.setupContainer.style.display = 'none';
      this.elements.appContainer.style.display = 'block';
      this.elements.currentUserElement.textContent = this.userManager.username;
    });

    this.elements.loginContinueButton.addEventListener('click', async () => {
      const username = this.elements.loginUsernameInput.value.trim();
      const peerId = this.elements.loginPeerIdInput.value.trim();

      if (!username || !peerId) {
        alert('Please enter both username and peer ID');
        return;
      }

      try {
        // Save credentials and login
        this.userManager.loginWithCredentials(username, peerId);
        await this.peerManager.loginToPeer();

        // Hide login screens, show app
        this.elements.loginContainer.style.display = 'none';
        this.elements.appContainer.style.display = 'block';
        this.elements.currentUserElement.textContent = username;
      } catch (error) {
        console.error('Login error:', error);
        alert(`Error logging in: ${error.message}`);
      }
    });

    // Tab navigation
    this.elements.feedTab.addEventListener('click', () => {
      this.activateTab('feed');
    });

    this.elements.peersTab.addEventListener('click', () => {
      this.activateTab('peers');
    });

    this.elements.profileTab.addEventListener('click', () => {
      this.activateTab('profile');
      this.updateProfileInfo();
    });

    this.elements.connectButton.addEventListener('click', this.connectToPeer);

    this.elements.deleteAccountButton.addEventListener('click', this.deleteAccount.bind(this));

    // Status and connection quality update listeners
    window.addEventListener('status-update', this.handleStatusUpdate);
    window.addEventListener('connection-quality-update', this.handleConnectionQualityUpdate);

    // Browser refresh/close events
    window.addEventListener('beforeunload', () => {
      // Ensure we're saving state appropriately
      this.tweetManager.saveTweets();
      this.peerManager.savePeers();
    });

    // Register for tweet updates from the tweet manager
    this.tweetManager.onTweetsUpdated = this.renderTweets;
    this.peerManager.onPeersUpdated = this.updatePeersList;

    // Add media upload UI elements to the tweet form
    this.setupMediaUploadUI();
    
    // Add the tweet button event listener here with the media-enabled function
    this.elements.tweetButton.addEventListener('click', this.createTweetWithMedia);

    // Add this call at the end of the existing setupEventListeners method
    this.setupCharacterCounter();
  }

	setupMediaUploadUI() {
	  // Get the tweet form element
	  const tweetForm = document.getElementById('tweet-form');
	  if (!tweetForm) return;
	  
	  // Create media container for the form
	  const mediaContainer = document.createElement('div');
	  mediaContainer.className = 'media-upload-container';
	  mediaContainer.style.display = 'flex';
	  mediaContainer.style.marginBottom = '10px';
	  
	  // Create the upload button
	  const uploadButton = document.createElement('button');
	  uploadButton.type = 'button';
	  uploadButton.className = 'media-upload-button';
	  uploadButton.innerHTML = '<span class="icon">📷</span>';
	  uploadButton.title = 'Add image or GIF';
	  uploadButton.style.backgroundColor = '#1da1f2';
	  uploadButton.style.color = 'white';
	  uploadButton.style.border = 'none';
	  uploadButton.style.borderRadius = '50%';
	  uploadButton.style.width = '36px';
	  uploadButton.style.height = '36px';
	  uploadButton.style.marginRight = '10px';
	  uploadButton.style.cursor = 'pointer';
	  uploadButton.style.display = 'flex';
	  uploadButton.style.alignItems = 'center';
	  uploadButton.style.justifyContent = 'center';
	  
	  // Create hidden file input
	  const mediaInput = document.createElement('input');
	  mediaInput.type = 'file';
	  mediaInput.id = 'media-input';
	  mediaInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
	  mediaInput.style.display = 'none';
	  
	  // Create preview container
	  const previewContainer = document.createElement('div');
	  previewContainer.className = 'media-preview-container';
	  previewContainer.style.display = 'none';
	  previewContainer.style.position = 'relative';
	  previewContainer.style.width = '100px';
	  previewContainer.style.height = '100px';
	  previewContainer.style.marginRight = '10px';
	  previewContainer.style.borderRadius = '8px';
	  previewContainer.style.overflow = 'hidden';
	  
	  // Create clear button for preview
	  const clearButton = document.createElement('button');
	  clearButton.className = 'clear-media-button';
	  clearButton.innerHTML = '&times;';
	  clearButton.style.position = 'absolute';
	  clearButton.style.top = '2px';
	  clearButton.style.right = '2px';
	  clearButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
	  clearButton.style.color = 'white';
	  clearButton.style.border = 'none';
	  clearButton.style.borderRadius = '50%';
	  clearButton.style.width = '24px';
	  clearButton.style.height = '24px';
	  clearButton.style.cursor = 'pointer';
	  clearButton.style.display = 'flex';
	  clearButton.style.alignItems = 'center';
	  clearButton.style.justifyContent = 'center';
	  
	  // Create preview image
	  const previewImage = document.createElement('img');
	  previewImage.className = 'media-preview-image';
	  previewImage.style.width = '100%';
	  previewImage.style.height = '100%';
	  previewImage.style.objectFit = 'cover';
	  
	  // Assemble preview container
	  previewContainer.appendChild(previewImage);
	  previewContainer.appendChild(clearButton);
	  
	  // Add to media container
	  mediaContainer.appendChild(uploadButton);
	  mediaContainer.appendChild(mediaInput);
	  mediaContainer.appendChild(previewContainer);
	  
	  // FIX: Insert media container at the beginning of the tweet form
	  // This ensures we don't need to find a specific reference node
	  if (tweetForm.firstChild) {
		tweetForm.insertBefore(mediaContainer, tweetForm.firstChild);
	  } else {
		tweetForm.appendChild(mediaContainer);
	  }
	  
	  // Store references to new elements
	  this.elements.mediaUploadButton = uploadButton;
	  this.elements.mediaInput = mediaInput;
	  this.elements.mediaPreviewContainer = previewContainer;
	  this.elements.mediaPreviewImage = previewImage;
	  this.elements.clearMediaButton = clearButton;
	  
	  // Add event listeners
	  uploadButton.addEventListener('click', () => {
		mediaInput.click();
	  });
	  
	  mediaInput.addEventListener('change', this.handleMediaUpload);
	  clearButton.addEventListener('click', this.clearMediaPreview);
	}

  handleMediaUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file type. Please upload JPEG, PNG, GIF or WebP images.');
      return;
    }
    
    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      alert(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`);
      return;
    }
    
    // Store file for later upload with tweet
    this.pendingMediaFile = file;
    
    // Show preview
    this.displayMediaPreview(file);
  }

  displayMediaPreview(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this.elements.mediaPreviewImage.src = e.target.result;
      this.elements.mediaPreviewContainer.style.display = 'block';
    };
    
    reader.onerror = () => {
      alert('Error reading file');
      this.clearMediaPreview();
    };
    
    reader.readAsDataURL(file);
  }

  clearMediaPreview() {
    this.pendingMediaFile = null;
    this.elements.mediaPreviewImage.src = '';
    this.elements.mediaPreviewContainer.style.display = 'none';
    this.elements.mediaInput.value = '';
  }


  /**
   * Create a new tweet
   */
  async createTweetWithMedia() {
    const content = this.elements.tweetContentInput.value.trim();
    
    // Check if we have either content or media
    if (!content && !this.pendingMediaFile) {
      alert('Please enter a message or attach an image');
      return;
    }
    
    try {
      // Create the tweet with optional media
	  console.log('test', content, this.pendingMediaFile);
      await this.tweetManager.createTweet(content, this.pendingMediaFile);
      console.log('test 2');
      // Clear the inputs
      this.elements.tweetContentInput.value = '';
      this.clearMediaPreview();
    } catch (error) {
      console.error('Error creating tweet with media:', error);
      alert(`Error creating tweet: ${error.message}`);
    }
  }

  /**
   * Activate a specific tab in the UI
   * @param {string} tabName - The tab to activate ('feed', 'peers', or 'profile')
   */
  activateTab(tabName) {
    // Reset all tabs
    this.elements.feedTab.classList.remove('active');
    this.elements.peersTab.classList.remove('active');
    this.elements.profileTab.classList.remove('active');

    this.elements.feedContainer.style.display = 'none';
    this.elements.peersContainer.style.display = 'none';
    this.elements.profileContainer.style.display = 'none';

    // Activate the requested tab
    switch (tabName) {
      case 'feed':
        this.elements.feedTab.classList.add('active');
        this.elements.feedContainer.style.display = 'block';
        break;
      case 'peers':
        this.elements.peersTab.classList.add('active');
        this.elements.peersContainer.style.display = 'block';
        break;
      case 'profile':
        this.elements.profileTab.classList.add('active');
        this.elements.profileContainer.style.display = 'block';
        break;
    }
  }

  /**
   * Show the intro screen
   */
  showIntroScreen() {
    this.elements.introContainer.style.display = 'block';
    this.elements.setupContainer.style.display = 'none';
    this.elements.loginContainer.style.display = 'none';
    this.elements.appContainer.style.display = 'none';
  }

  /**
   * Update profile information in the UI
   */
  updateProfileInfo() {
    const { username, peerId } = this.userManager.getUserInfo();
    this.elements.profileUsername.textContent = username;
    this.elements.profilePeerId.textContent = peerId;

    // Generate QR code for profile if not already generated
    if (!this.elements.profileQrcode.querySelector("canvas")) {
      // Clear any existing children first to prevent stacking
      this.elements.profileQrcode.innerHTML = '';

      new QRCode(this.elements.profileQrcode, {
        text: peerId,
        width: 200,
        height: 200
      });
    }
  }

  /**
   * Setup tweet input character counter
   */
  setupCharacterCounter() {
    if (!this.elements.tweetContentInput) return;

    // Create character counter element if it doesn't exist
    if (!this.charCountElement) {
      this.charCountElement = document.createElement('div');
      this.charCountElement.className = 'char-count';
      this.charCountElement.style.textAlign = 'right';
      this.charCountElement.style.color = '#657786';
      this.charCountElement.style.fontSize = '0.9em';
      this.charCountElement.style.marginTop = '5px';

      // Add it after the tweet content input
      this.elements.tweetContentInput.parentNode.insertBefore(
        this.charCountElement,
        this.elements.tweetContentInput.nextSibling
      );
    }

    // Update counter on input
    this.elements.tweetContentInput.addEventListener('input', () => {
      const content = this.elements.tweetContentInput.value;
      const maxLength = this.tweetManager.MAX_TWEET_LENGTH;
      const remaining = maxLength - content.length;

      this.charCountElement.textContent = `${content.length}/${maxLength}`;

      // Change color when approaching limit
      if (remaining < 0) {
        this.charCountElement.style.color = '#e0245e'; // Red
      } else if (remaining < 20) {
        this.charCountElement.style.color = '#ffad1f'; // Yellow/Orange
      } else {
        this.charCountElement.style.color = '#657786'; // Default gray
      }
    });

    // Initial counter update
    this.elements.tweetContentInput.dispatchEvent(new Event('input'));
  }

  /**
   * Connect to a peer by ID
   */
  connectToPeer() {
    const peerId = this.elements.connectIdInput.value.trim();
    if (!peerId) {
      alert('Please enter a peer ID');
      return;
    }

    try {
      this.peerManager.connectToPeer(peerId);
      this.elements.connectIdInput.value = '';
    } catch (error) {
      console.error('Error connecting to peer:', error);
      alert(`Error connecting to peer: ${error.message}`);
    }
  }

  /**
   * Delete user account
   */
  deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This will disconnect you from all peers and remove your saved credentials.')) {
      // Close all connections
      const connections = this.peerManager.getAllConnections();
      connections.forEach(conn => {
        this.peerManager.disconnectPeer(conn);
      });

      // Delete account through user manager
      this.userManager.deleteAccount(() => {
        // Reset UI
        this.showIntroScreen();
        alert('Your account has been deleted successfully.');
      });
    }
  }

  /**
   * Render tweets in the UI
   */
  renderTweets() {
    const tweetsContainer = this.elements.tweetsContainer;
    tweetsContainer.innerHTML = '';

    // Get tweets from tweet manager
    const tweets = this.tweetManager.getAllTweets();

    if (tweets.length === 0) {
      const noTweets = document.createElement('p');
      noTweets.textContent = 'No spells cast yet. Be the first to cast a spell!';
      tweetsContainer.appendChild(noTweets);
      return;
    }

    tweets.forEach(tweet => {
      const tweetElement = document.createElement('div');
      tweetElement.className = 'tweet';
      tweetElement.dataset.id = tweet.id;

      const tweetHeader = document.createElement('div');
      tweetHeader.className = 'tweet-header';

      const tweetUser = document.createElement('div');
      tweetUser.className = 'tweet-user';
      tweetUser.textContent = tweet.username;

      const tweetTime = document.createElement('div');
      tweetTime.className = 'tweet-time';
      tweetTime.textContent = this.formatTimestamp(tweet.timestamp);

      tweetHeader.appendChild(tweetUser);
      tweetHeader.appendChild(tweetTime);

      const tweetContent = document.createElement('div');
      tweetContent.className = 'tweet-content';
      
      // Only add text content if it exists
      if (tweet.content && tweet.content.trim()) {
        tweetContent.textContent = tweet.content;
      }

      // Create media container
      const tweetMediaContainer = document.createElement('div');
      tweetMediaContainer.className = 'tweet-media-container';
      tweetMediaContainer.style.marginTop = '10px';
      tweetMediaContainer.style.marginBottom = '10px';
      
      // Add media if present
      if (tweet.mediaId) {
        this.renderMediaInTweet(tweet, tweetMediaContainer);
      }

      const tweetActions = document.createElement('div');
      tweetActions.className = 'tweet-actions';

      // Only add delete button for user's own tweets
      const { username } = this.userManager.getUserInfo();
      if (tweet.username === username) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-tweet-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => this.deleteTweet(tweet.id));

        tweetActions.appendChild(deleteButton);
      }

      tweetElement.appendChild(tweetHeader);
      tweetElement.appendChild(tweetContent);
      tweetElement.appendChild(tweetMediaContainer);
      tweetElement.appendChild(tweetActions);

      tweetsContainer.appendChild(tweetElement);
    });
  }

  renderMediaInTweet(tweet, container) {
    // If we have a thumbnail, display it immediately
    if (tweet.mediaThumbnail) {
      const img = document.createElement('img');
      img.className = 'tweet-media';
      img.src = tweet.mediaThumbnail;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '300px';
      img.style.borderRadius = '8px';
      img.style.cursor = 'pointer';
      
      // Click to show full-size media
      img.addEventListener('click', async () => {
        try {
          const mediaData = await this.tweetManager.getMediaForTweet(tweet.id);
          if (mediaData && mediaData.fullImage) {
            this.showMediaModal(mediaData.fullImage);
          }
        } catch (error) {
          console.error('Error loading full image:', error);
        }
      });
      
      container.appendChild(img);
    }
    // If no thumbnail but we have mediaId, add a placeholder/loading indicator
    else if (tweet.mediaId) {
      const placeholder = document.createElement('div');
      placeholder.className = 'media-placeholder';
      placeholder.textContent = 'Loading media...';
      placeholder.style.backgroundColor = '#f0f0f0';
      placeholder.style.color = '#666';
      placeholder.style.padding = '20px';
      placeholder.style.borderRadius = '8px';
      placeholder.style.textAlign = 'center';
      
      container.appendChild(placeholder);
      
      // Try to fetch the media
      this.tweetManager.getMediaForTweet(tweet.id)
        .then(mediaData => {
          if (mediaData && mediaData.thumbnail) {
            const img = document.createElement('img');
            img.className = 'tweet-media';
            img.src = mediaData.thumbnail;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '300px';
            img.style.borderRadius = '8px';
            img.style.cursor = 'pointer';
            
            // Replace placeholder
            container.innerHTML = '';
            container.appendChild(img);
          }
        })
        .catch(error => {
          console.error('Error fetching media:', error);
          placeholder.textContent = 'Failed to load media';
        });
    }
  }

  showMediaModal(imageSrc) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'media-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.objectFit = 'contain';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.fontSize = '30px';
    closeBtn.style.color = 'white';
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    
    // Close on button click, overlay click, or escape key
    closeBtn.addEventListener('click', () => document.body.removeChild(modal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) document.body.removeChild(modal);
    });
    
    // Add elements to modal
    modal.appendChild(img);
    modal.appendChild(closeBtn);
    
    // Add modal to document
    document.body.appendChild(modal);
    
    // Setup escape key listener
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escHandler);
      }
    };
    
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Delete a tweet
   * @param {string} tweetId - ID of the tweet to delete
   */
  async deleteTweet(tweetId) {
    if (confirm('Are you sure you want to delete this message? It will only be removed from your local database.')) {
      // Delete through tweet manager (updated to handle media)
      const success = await this.tweetManager.deleteTweet(tweetId);

      // If deletion was successful, update the UI
      if (success) {
        this.renderTweets();
      }
    }
  }

  /**
   * Delete all messages from the local database
   */
  deleteAllMessages() {
    if (confirm('Are you sure you want to delete all your messages? This will remove all spells from your local database but cannot remove them from other peers who have already received them.')) {
      // Delete through tweet manager
      const deletedCount = this.tweetManager.deleteAllTweets();
      alert(`Successfully deleted ${deletedCount} messages from your local database.`);
    }
  }

  /**
   * Update connection status in the UI
   */
  updateConnectionStatus() {
    const connections = this.peerManager.getAllConnections();

    if (connections.length === 0) {
      this.elements.statusElement.textContent = 'Not connected to any peers';
    } else {
      this.elements.statusElement.textContent = `Connected to ${connections.length} peer(s)`;
    }

    // Update connection quality indicator
    this.handleConnectionQualityUpdate({
      detail: { quality: this.peerManager.connectionQuality || 'unknown' }
    });
  }

  /**
   * Update the peers list in the UI
   */
  updatePeersList() {
    const peersList = this.elements.peersList;
    peersList.innerHTML = '';

    // Get data from peer manager
    const connections = this.peerManager.getAllConnections();
    const savedPeers = this.peerManager.savedPeers;

    // Combine connected and saved peers
    const allPeerIds = new Set([
      ...connections.map(conn => conn.peer),
      ...savedPeers.map(peer => peer.peerId)
    ]);

    if (allPeerIds.size === 0) {
      const noPeers = document.createElement('p');
      noPeers.textContent = 'No peers connected or saved';
      peersList.appendChild(noPeers);
      return;
    }

    // Create sections for online and offline peers
    const onlineSection = document.createElement('div');
    onlineSection.innerHTML = '<h4>Online Peers</h4>';

    const offlineSection = document.createElement('div');
    offlineSection.innerHTML = '<h4>Offline Peers</h4>';

    // Track if we added any peers to each section
    let hasOnlinePeers = false;
    let hasOfflinePeers = false;

    // Process each peer
    allPeerIds.forEach(peerId => {
      // Skip own peer ID
      if (peerId === this.userManager.peerId) return;

      const isConnected = connections.some(conn => conn.peer === peerId);
      const connection = connections.find(conn => conn.peer === peerId);
      const savedPeer = savedPeers.find(peer => peer.peerId === peerId);

      // Get peer info from either connection or saved peers
      const peerStatus = this.peerManager.peerStatus[peerId] || 'offline';
      const peerInfo = {
        peerId: peerId,
        username: connection?.metadata?.username || savedPeer?.username || 'Unknown user',
        status: isConnected ? 'online' : peerStatus,
        lastSeen: this.peerManager.lastSeen[peerId] || 0,
        connectionQuality: this.peerManager.peerConnectionQuality[peerId] || 'unknown'
      };

      // Create peer element for the UI
      const peerElement = this.createPeerElement(peerInfo, connection);

      // Add to appropriate section
      if (peerInfo.status === 'online') {
        onlineSection.appendChild(peerElement);
        hasOnlinePeers = true;
      } else {
        offlineSection.appendChild(peerElement);
        hasOfflinePeers = true;
      }
    });

    // Add sections to the peer list
    if (hasOnlinePeers) {
      peersList.appendChild(onlineSection);
    } else {
      onlineSection.innerHTML += '<p>No online peers</p>';
      peersList.appendChild(onlineSection);
    }

    if (hasOfflinePeers) {
      peersList.appendChild(offlineSection);
    }

    // Update connection status
    this.updateConnectionStatus();
  }

  /**
   * Create a peer element for the UI
   * @param {Object} peerInfo - Information about the peer
   * @param {Object} connection - The connection object if connected
   * @returns {HTMLElement} - The peer element
   */
  createPeerElement(peerInfo, connection) {
    // Helper to format the last seen time
    const formatLastSeen = (timestamp) => {
      if (!timestamp) return 'Never';

      const now = Date.now();
      const diff = now - timestamp;

      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
      return new Date(timestamp).toLocaleDateString();
    };

    // Create peer element
    const peerElement = document.createElement('div');
    peerElement.className = 'peer';

    // Create status indicator
    const statusIndicator = document.createElement('span');
    statusIndicator.className = `connection-quality ${peerInfo.connectionQuality}`;

    // Create info container
    const peerInfoContainer = document.createElement('div');

    // Add username and peer ID
    const nameElement = document.createElement('div');
    nameElement.className = 'peer-name';
    nameElement.textContent = peerInfo.username;

    const idElement = document.createElement('div');
    idElement.className = 'peer-id';
    idElement.textContent = peerInfo.peerId;
    idElement.style.fontSize = '0.8em';
    idElement.style.color = '#657786';

    // Add last seen info for offline peers
    const lastSeenElement = document.createElement('div');
    lastSeenElement.className = 'peer-last-seen';
    lastSeenElement.style.fontSize = '0.8em';
    lastSeenElement.style.color = '#657786';

    if (peerInfo.status === 'online') {
      lastSeenElement.textContent = 'Currently online';
    } else {
      lastSeenElement.textContent = `Last seen: ${formatLastSeen(peerInfo.lastSeen)}`;
    }

    // Add status text
    const statusElement = document.createElement('div');
    statusElement.className = 'peer-status';
    statusElement.textContent = peerInfo.status.charAt(0).toUpperCase() + peerInfo.status.slice(1);
    statusElement.style.fontWeight = 'bold';

    if (peerInfo.status === 'online') {
      statusElement.style.color = '#2ecc71';
    } else if (peerInfo.status === 'offline') {
      statusElement.style.color = '#e74c3c';
    } else if (peerInfo.status === 'error') {
      statusElement.style.color = '#f39c12';
    }

    // Add button container
    const buttonContainer = document.createElement('div');

    // Add appropriate buttons based on status
    if (connection) {
      // Disconnect button for connected peers
      const disconnectButton = document.createElement('button');
      disconnectButton.textContent = 'Disconnect';
      disconnectButton.className = 'danger-button';
      disconnectButton.style.marginRight = '5px';
      disconnectButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to disconnect from ${peerInfo.username || 'this peer'}?`)) {
          this.peerManager.disconnectPeer(connection);
        }
      });
      buttonContainer.appendChild(disconnectButton);
    } else {
      // Connect button for disconnected peers
      const connectButton = document.createElement('button');
      connectButton.textContent = 'Connect';
      connectButton.addEventListener('click', () => {
        this.peerManager.connectToPeer(peerInfo.peerId);
      });
      buttonContainer.appendChild(connectButton);

      // Remove button
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.className = 'danger-button';
      removeButton.style.marginLeft = '5px';
      removeButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to remove ${peerInfo.username || 'this peer'} from your saved peers?`)) {
          this.peerManager.removeOfflinePeer(peerInfo.peerId);
        }
      });
      buttonContainer.appendChild(removeButton);
    }

    // Assemble the peer element
    peerInfoContainer.appendChild(nameElement);
    peerInfoContainer.appendChild(idElement);
    peerInfoContainer.appendChild(statusElement);
    peerInfoContainer.appendChild(lastSeenElement);

    peerElement.appendChild(statusIndicator);
    peerElement.appendChild(peerInfoContainer);
    peerElement.appendChild(buttonContainer);

    return peerElement;
  }


  /**
   * Handle a status update event
   * @param {Event} event - The status update event
   */
  handleStatusUpdate(event) {
    const { message, showRetry, retryFn } = event.detail;

    if (showRetry && retryFn) {
      this.elements.statusElement.innerHTML = `${message} <button id="retry-now" class="small-button">Try Now</button>`;
      document.getElementById('retry-now').addEventListener('click', retryFn);
    } else {
      this.elements.statusElement.textContent = message;
    }
  }

  /**
   * Handle a connection quality update event
   * @param {Event} event - The connection quality update event
   */
  handleConnectionQualityUpdate(event) {
    const { quality } = event.detail;
    // Use ID selector instead of class
    this.elements.connectionQualityIndicator.className = quality;
  }

  /**
   * Format a timestamp for display
   * @param {number} timestamp - The timestamp to format
   * @returns {string} - The formatted timestamp
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
}
