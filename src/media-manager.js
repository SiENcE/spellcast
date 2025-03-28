// Manages media attachments for SpellCast
// Handles image processing, storage, and retrieval

export class MediaManager {
  // Constants for validation and limits
  static MEDIA_TYPES = {
    IMAGE: 'image'
  };
  
  static ALLOWED_MIME_TYPES = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ];
  
  static MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  static MAX_IMAGE_WIDTH = 1200; // Max width in pixels
  static MAX_IMAGE_HEIGHT = 1200; // Max height in pixels
  static THUMBNAIL_SIZE = 300; // Thumbnail size in pixels
  static COMPRESSION_QUALITY = 0.7; // JPEG/WebP compression quality (0-1)
  
  constructor(storageManager) {
    this.storageManager = storageManager;
    
    // Storage constants
    this.MEDIA_STORE_NAME = 'media_store';
    this.DB_VERSION = 2; // Increment the DB version to add the new store
    
    // Initialize database
    this.dbPromise = this.initDatabase();
  }
  
  /**
   * Initialize the IndexedDB database with media store
   * @returns {Promise} Promise that resolves to the database
   */
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.storageManager.constructor.DB_NAME, this.DB_VERSION);
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        console.log('MediaManager: IndexedDB opened successfully');
        resolve(event.target.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create media store if it doesn't exist
        if (!db.objectStoreNames.contains(this.MEDIA_STORE_NAME)) {
          db.createObjectStore(this.MEDIA_STORE_NAME);
          console.log('Created media store:', this.MEDIA_STORE_NAME);
        }
      };
    });
  }
  
  /**
   * Get a transaction and store for a specific mode
   * @param {string} mode - 'readonly' or 'readwrite'
   * @returns {Promise<Object>} - Contains transaction and store
   */
  async getStore(mode) {
    const db = await this.dbPromise;
    const transaction = db.transaction(this.MEDIA_STORE_NAME, mode);
    const store = transaction.objectStore(this.MEDIA_STORE_NAME);
    
    return { transaction, store };
  }
  
  /**
   * Process and store an image file
   * @param {File} file - The image file to process
   * @returns {Promise<Object>} Media metadata including ID and thumbnail
   */
  async processAndStoreImage(file) {
    // Validate file
    if (!file || !MediaManager.ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Allowed types: JPEG, PNG, GIF, WebP');
    }
console.log('a');
    if (file.size > MediaManager.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size: ${MediaManager.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
console.log('b');
    try {
      // Generate a unique ID for the media
      const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
console.log('c');
      // Process the image (resize and create thumbnail)
      const { fullImage, thumbnail } = await this.processImage(file);
console.log('d');
      // Store the processed image
      await this.storeMedia(mediaId, {
        type: MediaManager.MEDIA_TYPES.IMAGE,
        mimeType: file.type,
        filename: file.name,
        size: fullImage.length,
        fullImage: fullImage,
        thumbnail: thumbnail,
        createdAt: Date.now()
      });
console.log('e');
      // Return metadata (without the full image data to save memory)
      return {
        id: mediaId,
        type: MediaManager.MEDIA_TYPES.IMAGE,
        mimeType: file.type,
        filename: file.name,
        size: fullImage.length,
        thumbnail: thumbnail,
        createdAt: Date.now()
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error(`Error processing image: ${error.message}`);
    }
  }
  
  /**
   * Process an image file (resize and create thumbnail)
   * @param {File} file - The image file to process
   * @returns {Promise<Object>} Object containing the processed image and thumbnail
   */
  async processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            // Resize full image if needed
            const fullImage = this.resizeImage(
              img, 
              MediaManager.MAX_IMAGE_WIDTH, 
              MediaManager.MAX_IMAGE_HEIGHT, 
              MediaManager.COMPRESSION_QUALITY
            );
            
            // Create thumbnail
            const thumbnail = this.resizeImage(
              img, 
              MediaManager.THUMBNAIL_SIZE, 
              MediaManager.THUMBNAIL_SIZE, 
              MediaManager.COMPRESSION_QUALITY
            );
            
            resolve({ fullImage, thumbnail });
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = event.target.result;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Resize an image to fit within specified dimensions
   * @param {HTMLImageElement} img - The image element
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @param {number} quality - Compression quality (0-1)
   * @returns {string} Base64 data URL of the resized image
   */
  resizeImage(img, maxWidth, maxHeight, quality) {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // Calculate new dimensions to maintain aspect ratio
    if (width > height) {
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round(width * maxHeight / height);
        height = maxHeight;
      }
    }
    
    // Set canvas dimensions and draw resized image
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    // Convert to base64 data URL (prefer original format but fallback to JPEG)
    const mimeType = img.src.startsWith('data:image/png') ? 'image/png' : 
                    (img.src.startsWith('data:image/gif') ? 'image/gif' : 
                    (img.src.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'));
                    
    return canvas.toDataURL(mimeType, quality);
  }
  
  /**
   * Store media in IndexedDB
   * @param {string} id - Unique ID for the media
   * @param {Object} mediaData - Media data to store
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async storeMedia(id, mediaData) {
    try {
      const { store, transaction } = await this.getStore('readwrite');
console.log('0');
      return new Promise((resolve, reject) => {
        const request = store.put(mediaData, id);
console.log('1');
        request.onsuccess = () => {
          console.log(`Successfully stored media with ID: ${id}`);
          resolve(true);
        };
console.log('2');
        request.onerror = (event) => {
          console.error(`Error storing media (${id}):`, event.target.error);
          reject(event.target.error);
        };
console.log('3');
        transaction.oncomplete = () => {
          resolve(true);
        };
console.log('4');
        transaction.onerror = (event) => {
          console.error(`Transaction error while storing media (${id}):`, event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error(`Error accessing IndexedDB to store media (${id}):`, error);
      return false;
    }
  }
  
  /**
   * Retrieve media from IndexedDB
   * @param {string} id - ID of the media to retrieve
   * @param {boolean} fullImage - Whether to include the full image data
   * @returns {Promise<Object>} - The media data
   */
  async getMedia(id, fullImage = true) {
    try {
      const { store } = await this.getStore('readonly');
      
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        
        request.onsuccess = () => {
          if (!request.result) {
            reject(new Error(`Media not found: ${id}`));
            return;
          }
          
          // If full image is not requested, return only metadata and thumbnail
          if (!fullImage) {
            const { fullImage, ...metadata } = request.result;
            resolve(metadata);
          } else {
            resolve(request.result);
          }
        };
        
        request.onerror = (event) => {
          console.error(`Error retrieving media (${id}):`, event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error(`Error accessing IndexedDB to retrieve media (${id}):`, error);
      throw error;
    }
  }
  
  /**
   * Delete media from IndexedDB
   * @param {string} id - ID of the media to delete
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async deleteMedia(id) {
    try {
      const { store, transaction } = await this.getStore('readwrite');
      
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log(`Successfully deleted media (${id})`);
          resolve(true);
        };
        
        request.onerror = (event) => {
          console.error(`Error deleting media (${id}):`, event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          resolve(true);
        };
      });
    } catch (error) {
      console.error(`Error accessing IndexedDB to delete media (${id}):`, error);
      return false;
    }
  }
  
  /**
   * Delete all media associated with a tweet
   * @param {string} tweetId - ID of the tweet
   * @param {Array} mediaIds - Array of media IDs to delete
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async deleteMediaForTweet(tweetId, mediaIds) {
    try {
      // Delete each media item
      for (const mediaId of mediaIds) {
        await this.deleteMedia(mediaId);
      }
      return true;
    } catch (error) {
      console.error(`Error deleting media for tweet (${tweetId}):`, error);
      return false;
    }
  }
  
  /**
   * Clean up orphaned media that is no longer referenced by any tweet
   * @param {Array} activeTweetMediaIds - Array of media IDs currently in use
   * @returns {Promise<number>} - Number of deleted media items
   */
  async cleanupOrphanedMedia(activeTweetMediaIds) {
    try {
      // Get all media IDs
      const allMediaIds = await this.getAllMediaIds();
      
      // Find orphaned media
      const orphanedMediaIds = allMediaIds.filter(id => !activeTweetMediaIds.includes(id));
      
      // Delete orphaned media
      let deletedCount = 0;
      for (const id of orphanedMediaIds) {
        const success = await this.deleteMedia(id);
        if (success) deletedCount++;
      }
      
      console.log(`Cleaned up ${deletedCount} orphaned media items`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up orphaned media:', error);
      return 0;
    }
  }
  
  /**
   * Get all media IDs
   * @returns {Promise<Array>} - Array of all media IDs
   */
  async getAllMediaIds() {
    try {
      const { store } = await this.getStore('readonly');
      
      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          console.error('Error getting all media IDs:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Error accessing IndexedDB to get all media IDs:', error);
      return [];
    }
  }
}
