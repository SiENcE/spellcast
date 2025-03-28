// Main entry point
import { UserManager } from './user-manager.js';
import { UIManager } from './ui-manager.js';
import { TweetManager } from './tweet-manager.js';
import { PeerManager } from './peer-manager.js';
import { StorageManager } from './storage-manager.js';
import { MediaManager } from './media-manager.js';

// Instantiate main application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new SpellCastApp();
  app.initialize();
});

class SpellCastApp {
  constructor() {
    this.storageManager = new StorageManager();
    this.userManager = new UserManager(this.storageManager);
    this.peerManager = new PeerManager(this.userManager, this.storageManager);
	this.mediaManager = new MediaManager(this.storageManager);
    this.tweetManager = new TweetManager(this.userManager, this.peerManager, this.storageManager, this.mediaManager);

    this.uiManager = new UIManager(
      this.userManager,
      this.peerManager,
      this.tweetManager,
      this.storageManager,
	  this.mediaManager
    );
  }

  async initialize() {
    // Migrate data from localStorage to IndexedDB
    await this.storageManager.migrateFromLegacyStorage();
    
    // Check for saved credentials
    const hasCredentials = await this.userManager.checkSavedCredentials();

    // Setup event listeners and UI
    this.uiManager.setupEventListeners();
    this.peerManager.enhanceConnectivity();

    // Show appropriate screen based on login status
    if (!hasCredentials) {
      this.uiManager.showIntroScreen();
    } else {
      // Auto-login with saved credentials
      try {
        // Attempt to login to the peer network with saved credentials
        await this.peerManager.loginToPeer();

        // Show the app UI
        this.uiManager.elements.appContainer.style.display = 'block';
        this.uiManager.elements.currentUserElement.textContent = this.userManager.username;

        // Update profile information
        this.uiManager.updateProfileInfo();
      } catch (error) {
        console.error('Auto-login error:', error);
        // If auto-login fails, show the intro screen
        this.uiManager.showIntroScreen();
        // Optionally, show an error message
        alert('Failed to auto-login: ' + error.message);
      }
    }

    // Load data from storage
    await this.tweetManager.loadTweets();
    await this.peerManager.loadPeers();
    await this.tweetManager.loadMessageDistributionState();

    // Set up periodic media cleanup
    this.setupMediaCleanupTask();
  }

  setupMediaCleanupTask() {
    // Run media cleanup once a day (86400000 ms)
    setInterval(() => {
      this.cleanupOrphanedMedia();
    }, 86400000);
    
    // Also run cleanup on startup (with a small delay)
    setTimeout(() => {
      this.cleanupOrphanedMedia();
    }, 30000); // 30 seconds after startup
  }

  /**
   * Clean up media files that are no longer referenced by any tweets
   * This prevents orphaned media from taking up storage space
   */
  async cleanupOrphanedMedia() {
    try {
      console.log('Starting orphaned media cleanup task...');
      
      // Get all tweets to find referenced media IDs
      const tweets = this.tweetManager.getAllTweets();
      
      // Extract all media IDs referenced in tweets
      const activeTweetMediaIds = tweets
        .filter(tweet => tweet.mediaId)
        .map(tweet => tweet.mediaId);
      
      console.log(`Found ${activeTweetMediaIds.length} active media references in tweets`);
      
      // Pass the active media IDs to the media manager for cleanup
      const deletedCount = await this.mediaManager.cleanupOrphanedMedia(activeTweetMediaIds);
      
      console.log(`Media cleanup complete. Removed ${deletedCount} orphaned media items`);
    } catch (error) {
      console.error('Error during media cleanup:', error);
    }
  }
}