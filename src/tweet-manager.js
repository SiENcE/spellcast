// Manages tweets and message distribution

import { StorageManager } from './storage-manager.js';
import { RateLimiter } from './rate-limiter.js';

export class TweetManager {
	constructor(userManager, peerManager, storageManager, mediaManager) {
		this.userManager = userManager;
		this.peerManager = peerManager;
		this.storageManager = storageManager;
		this.mediaManager = mediaManager;

		// Constants for validation and limits
		this.MAX_TWEET_LENGTH = 1000; // Maximum length of tweet content in characters
		this.MAX_TWEETS_STORAGE = 1000; // Maximum number of tweets to store locally
		this.MAX_MEDIA_PER_TWEET = 1; // Start with just one attachment per message
		this.VALID_TWEET_PROPS = [
		  'id', 'username', 'content', 'timestamp', 'mediaId', 'mediaThumbnail', 'mediaType'
		]; // Updated valid properties

		// Add rate limiter instance
		this.rateLimiter = new RateLimiter();

		// Rate limiting constants
		this.MESSAGE_MAX_COUNT = 10;     // Maximum messages
		this.MESSAGE_TIME_WINDOW_MS = 60000; // 1 minute window

		// State
		this.tweets = [];
		this.tweetRecipients = {}; // Maps tweet IDs to arrays of peer IDs who have received it
		this.unsentTweets = {};    // Maps peer IDs to arrays of tweet IDs that need to be sent

		// Add event callbacks
		this.onTweetsUpdated = null; // Add this callback for UI updates

		// Register as listener for peer events
		this.peerManager.registerMessageHandler('tweet', this.handleTweetMessage.bind(this));
		this.peerManager.registerMessageHandler('tweet_ack', this.handleTweetAckMessage.bind(this));
		this.peerManager.registerMessageHandler('all_tweets', this.handleAllTweetsMessage.bind(this));
		this.peerManager.registerMessageHandler('bulk_tweet_ack', this.handleBulkTweetAckMessage.bind(this));

		// Bind methods
		this.loadTweets = this.loadTweets.bind(this);
		this.loadMessageDistributionState = this.loadMessageDistributionState.bind(this);
		this.saveTweets = this.saveTweets.bind(this);
		this.saveMessageDistributionState = this.saveMessageDistributionState.bind(this);
		this.createTweet = this.createTweet.bind(this);
		this.addTweet = this.addTweet.bind(this);
		this.deleteTweet = this.deleteTweet.bind(this);
		this.sendSelectiveTweets = this.sendSelectiveTweets.bind(this);
		this.broadcastTweet = this.broadcastTweet.bind(this);
		this.validateTweet = this.validateTweet.bind(this);
		this.generateUniqueId = this.generateUniqueId.bind(this);

		// On new peer connection, send missing tweets
		this.peerManager.onPeerConnected((conn) => {
			// Check if this is a new connection or reconnection
			const peerId = conn.peer;

			// Create an unsent tweets entry for this peer if it doesn't exist
			if (!this.unsentTweets[peerId]) {
				this.unsentTweets[peerId] = [];
			}

			// Find any tweets this peer hasn't received yet
			this.tweets.forEach(tweet => {
				if (!this.tweetRecipients[tweet.id] || !this.tweetRecipients[tweet.id].includes(peerId)) {
					if (!this.unsentTweets[peerId].includes(tweet.id)) {
						this.unsentTweets[peerId].push(tweet.id);
					}
				}
			});

			// Wait a bit for handshake to complete, then send unsent tweets
			setTimeout(() => this.sendSelectiveTweets(conn), 1000);
		});
	}

	// In loadTweets()
	async loadTweets() {
	  const savedTweets = await this.storageManager.loadFromStorage(StorageManager.KEYS.TWEETS);
	  if (savedTweets) {
		// Apply size limit if needed
		if (savedTweets.length > this.MAX_TWEETS_STORAGE) {
		  console.log(`Limiting loaded tweets to ${this.MAX_TWEETS_STORAGE} (had ${savedTweets.length})`);
		  this.tweets = savedTweets.slice(0, this.MAX_TWEETS_STORAGE);
		} else {
		  this.tweets = savedTweets;
		}
		this.sortTweets();
		// Call the callback if it exists
		if (typeof this.onTweetsUpdated === 'function') {
		  this.onTweetsUpdated();
		}
	  }
	}

	// In loadMessageDistributionState()
	async loadMessageDistributionState() {
	  const savedRecipients = await this.storageManager.loadFromStorage(StorageManager.KEYS.TWEET_RECIPIENTS);
	  const savedUnsent = await this.storageManager.loadFromStorage(StorageManager.KEYS.UNSENT_TWEETS);
	  
	  if (savedRecipients) {
		this.tweetRecipients = savedRecipients;
	  }
	  
	  if (savedUnsent) {
		this.unsentTweets = savedUnsent;
	  }
	}

	// In saveTweets()
	async saveTweets() {
	  // Apply limit before saving to prevent storage overflow
	  if (this.tweets.length > this.MAX_TWEETS_STORAGE) {
		console.log(`Limiting tweets to ${this.MAX_TWEETS_STORAGE} before saving`);
		this.tweets = this.tweets.slice(0, this.MAX_TWEETS_STORAGE);
	  }
	  
	  await this.storageManager.saveToStorage(StorageManager.KEYS.TWEETS, this.tweets);
	  await this.saveMessageDistributionState();
	}

	// In saveMessageDistributionState()
	async saveMessageDistributionState() {
	  await this.storageManager.saveToStorage(StorageManager.KEYS.TWEET_RECIPIENTS, this.tweetRecipients);
	  await this.storageManager.saveToStorage(StorageManager.KEYS.UNSENT_TWEETS, this.unsentTweets);
	}

	/**
	 * Sort tweets by timestamp (newest first)
	 */
	sortTweets() {
		this.tweets.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Create a new tweet
	 * @param {string} content - Tweet content
	 * @mediaId {string} content - Media file
	 * @returns {string} - Tweet ID
	 */
	  async createTweet(content, mediaFile = null) {

		if (!content && !mediaFile) {
		  throw new Error('Tweet must have content or media');
		}

		// Check content length
		if (content && content.length > this.MAX_TWEET_LENGTH) {
		  throw new Error(`Tweet content exceeds maximum length of ${this.MAX_TWEET_LENGTH} characters`);
		}

		// Process media if provided
		let mediaId = null;
		let mediaThumbnail = null;
		let mediaType = null;
console.log('JA 2');
		if (mediaFile) {
		  try {
			const mediaData = await this.mediaManager.processAndStoreImage(mediaFile);
			mediaId = mediaData.id;
			mediaThumbnail = mediaData.thumbnail;
			mediaType = mediaData.type;
		  } catch (error) {
			console.error('Error processing media:', error);
			throw new Error(`Failed to process media: ${error.message}`);
		  }
		}
console.log('NEIN 1');
		// Rate limiting check (existing code)
		const isAllowed = this.rateLimiter.isAllowed(
		  'message',
		  this.userManager.peerId,
		  this.MESSAGE_MAX_COUNT,
		  this.MESSAGE_TIME_WINDOW_MS
		);

		if (!isAllowed) {
		  const timeUntil = this.rateLimiter.getTimeUntilAllowed('message', this.userManager.peerId);
		  const secondsUntil = Math.ceil(timeUntil / 1000);
		  throw new Error(`Message rate limit exceeded. Please wait ${secondsUntil} seconds before sending more messages.`);
		}

		const { username } = this.userManager.getUserInfo();
		const timestamp = Date.now();
		const connectedPeerIds = this.peerManager.getConnectedPeerIds();
		const tweetId = this.generateUniqueId(username, content, timestamp);

		// Add tweet with media information
		this.addTweet(username, content, timestamp, connectedPeerIds, tweetId, mediaId, mediaThumbnail, mediaType);

		// Broadcast to connected peers
		this.broadcastTweet(content, timestamp, tweetId, mediaId, mediaThumbnail, mediaType);

		// Notify listeners
		if (typeof this.onTweetsUpdated === 'function') {
		  this.onTweetsUpdated();
		}

		return tweetId;
	  }

	/**
	 * Add a tweet to the database
	 * @param {string} username - Author username
	 * @param {string} content - Tweet content
	 * @param {number} timestamp - Creation timestamp
	 * @param {Array} recipients - Initial recipients
	 * @param {string} [id] - Optional tweet ID, will be generated if not provided
	 * @param {string} [mediaId]
	 * @param {string} [mediaThumbnail]
	 * @param {string} [mediaType]
	 * @returns {string} - Tweet ID
	 */
	  addTweet(username, content, timestamp, recipients = null, id = null, mediaId = null, mediaThumbnail = null, mediaType = null) {
		const tweetId = id || this.generateUniqueId(username, content, timestamp);

		// Check if we already have this tweet
		const existingTweet = this.tweets.find(t => t.id === tweetId);
		if (existingTweet) {
		  return tweetId;
		}

		// Create new tweet object with media info
		const tweet = { 
		  username, 
		  content, 
		  timestamp, 
		  id: tweetId 
		};

		if (mediaId) {
		  tweet.mediaId = mediaId;
		  tweet.mediaThumbnail = mediaThumbnail;
		  tweet.mediaType = mediaType;
		}

		// Validate tweet before adding
		if (!this.validateTweet(tweet)) {
			console.error('Invalid tweet:', tweet);
			throw new Error('Invalid tweet data');
		}

		this.tweets.push(tweet);

		// Track recipients for this tweet
		if (!this.tweetRecipients[tweetId]) {
			this.tweetRecipients[tweetId] = [];
		}

		// If specific recipients were provided, use those
		if (recipients && Array.isArray(recipients)) {
			this.tweetRecipients[tweetId] = [...recipients];
		}

		// Sort tweets by timestamp
		this.sortTweets();

		// Ensure we're not exceeding the maximum number of tweets
		if (this.tweets.length > this.MAX_TWEETS_STORAGE) {
			// Remove oldest tweets that exceed the limit
			const excess = this.tweets.length - this.MAX_TWEETS_STORAGE;
			const removedTweets = this.tweets.splice(this.MAX_TWEETS_STORAGE, excess);

			// Clean up references to removed tweets
			removedTweets.forEach(removedTweet => {
				delete this.tweetRecipients[removedTweet.id];

				// Remove from unsent tweets lists
				Object.keys(this.unsentTweets).forEach(peerId => {
					this.unsentTweets[peerId] = this.unsentTweets[peerId].filter(id => id !== removedTweet.id);
				});
			});
		}

		// Save to storage
		this.saveTweets();

		// Notify listeners
		if (typeof this.onTweetsUpdated === 'function') {
			this.onTweetsUpdated();
		}

		return tweetId;
	}

	/**
	 * Delete a tweet by ID
	 * @param {string} tweetId - Tweet ID to delete
	 * @returns {boolean} - Success
	 */
	  async deleteTweet(tweetId) {
		const initialLength = this.tweets.length;
		
		// Find the tweet to delete
		const tweetToDelete = this.tweets.find(tweet => tweet.id === tweetId);
		
		// Check if the tweet has media
		if (tweetToDelete && tweetToDelete.mediaId) {
		  try {
			// Delete the media
			await this.mediaManager.deleteMedia(tweetToDelete.mediaId);
		  } catch (error) {
			console.error(`Error deleting media for tweet ${tweetId}:`, error);
			// Continue with tweet deletion even if media deletion fails
		  }
		}
		
		// Remove the tweet
		this.tweets = this.tweets.filter(tweet => tweet.id !== tweetId);
		
		if (this.tweets.length !== initialLength) {
		  // Successfully removed a tweet
		  this.saveTweets();
		  return true;
		}
		
		return false;
	  }

	/**
	 * Get Media for Tweet
	 * @param {string} tweetId - Tweet ID to get Media for
	 * @returns {media} - Media File
	 */
	  async getMediaForTweet(tweetId) {
		const tweet = this.tweets.find(t => t.id === tweetId);
		if (!tweet || !tweet.mediaId) {
		  return null;
		}

		try {
		  return await this.mediaManager.getMedia(tweet.mediaId);
		} catch (error) {
		  console.error(`Error fetching media for tweet ${tweetId}:`, error);
		  return null;
		}
	  }

	/**
	 * Delete all tweets from the local database
	 * @returns {number} - Number of tweets deleted
	 */
	  async deleteAllTweets() {
		// Store media IDs for cleanup
		const mediaIds = this.tweets
		  .filter(tweet => tweet.mediaId)
		  .map(tweet => tweet.mediaId);
		
		const deletedCount = this.tweets.length;
		
		// Clear the tweets array
		this.tweets = [];
		
		// Clear distribution tracking
		this.tweetRecipients = {};
		this.unsentTweets = {};
		
		// Delete associated media
		if (mediaIds.length > 0) {
		  try {
			for (const mediaId of mediaIds) {
			  await this.mediaManager.deleteMedia(mediaId);
			}
		  } catch (error) {
			console.error('Error deleting media during tweet purge:', error);
			// Continue even if media deletion fails
		  }
		}
		
		// Save the empty state
		this.saveTweets();
		this.saveMessageDistributionState();
		
		// Notify listeners
		if (typeof this.onTweetsUpdated === 'function') {
		  this.onTweetsUpdated();
		}
		
		return deletedCount;
	  }

	/**
	 * Broadcast a tweet to all connected peers
	 * @param {string} content - Tweet content
	 * @param {number} timestamp - Creation timestamp
	 * @param {string} tweetId - Tweet ID
	 * @param {string} mediaId
	 * @param {string} mediaThumbnail
	 * @param {string} mediaType
	 */
	  broadcastTweet(content, timestamp, tweetId, mediaId = null, mediaThumbnail = null, mediaType = null) {
		const { username } = this.userManager.getUserInfo();

		const tweetData = {
		  type: 'tweet',
		  username: username,
		  content: content,
		  timestamp: timestamp,
		  id: tweetId
		};

		// Add media data if present
		if (mediaId) {
		  tweetData.mediaId = mediaId;
		  tweetData.mediaThumbnail = mediaThumbnail;
		  tweetData.mediaType = mediaType;
		}

		// Send to all currently connected peers
		const connections = this.peerManager.getAllConnections();
		connections.forEach(conn => {
			try {
				conn.send(tweetData);

				// Mark as sent to this peer
				if (this.tweetRecipients[tweetId] && !this.tweetRecipients[tweetId].includes(conn.peer)) {
					this.tweetRecipients[tweetId].push(conn.peer);

					// Remove from unsent list if present
					if (this.unsentTweets[conn.peer]) {
						this.unsentTweets[conn.peer] = this.unsentTweets[conn.peer].filter(id => id !== tweetId);
					}
				}
			} catch (error) {
				console.error(`Failed to send tweet to peer ${conn.peer}:`, error);

				// Add to unsent tweets for this peer
				if (!this.unsentTweets[conn.peer]) {
					this.unsentTweets[conn.peer] = [];
				}
				if (!this.unsentTweets[conn.peer].includes(tweetId)) {
					this.unsentTweets[conn.peer].push(tweetId);
				}
			}
		});

		// Save the updated recipient and unsent tweet information
		this.saveMessageDistributionState();
	}

	/**
	 * Validate a tweet object
	 * @param {Object} tweet - The tweet to validate
	 * @returns {boolean} - Whether the tweet is valid
	 */
	  validateTweet(tweet) {
		// Existing validation
		if (!tweet || typeof tweet !== 'object') return false;
		
		// Tweet must have content, unless it has media
		if (!tweet.content && !tweet.mediaId) return false;
		
		// Check required properties
		if (!tweet.username || !tweet.timestamp) return false;

		// Validate types
		if (typeof tweet.username !== 'string' || 
			(tweet.content && typeof tweet.content !== 'string') ||
			typeof tweet.timestamp !== 'number') return false;

		// Check content length if present
		if (tweet.content && (tweet.content.length === 0 || tweet.content.length > this.MAX_TWEET_LENGTH)) return false;

		// Check media properties if mediaId is present
		if (tweet.mediaId) {
		  if (typeof tweet.mediaId !== 'string' || 
			  typeof tweet.mediaThumbnail !== 'string' ||
			  typeof tweet.mediaType !== 'string') {
			return false;
		  }
		}

		// Check for unexpected properties
		const tweetProps = Object.keys(tweet);
		for (const prop of tweetProps) {
		  if (!this.VALID_TWEET_PROPS.includes(prop)) return false;
		}

		// Validate timestamp is not in the future
		const now = Date.now();
		if (tweet.timestamp > now + 60000) return false; // Allow 1 minute clock skew

		return true;
	  }

	/**
	 * Generate a unique ID for a tweet using cryptographic hash
	 * @param {string} username - Author username
	 * @param {string} content - Tweet content
	 * @param {number} timestamp - Creation timestamp
	 * @returns {string} - Unique tweet ID
	 */
	generateUniqueId(username, content, timestamp) {
		// Create a string to hash that includes all relevant data
		const dataToHash = `${username}-${timestamp}-${content}-${this.userManager.peerId}`;

		// Generate a SHA-256 like hash (simplified for browser compatibility)
		let hash = 0;
		for (let i = 0; i < dataToHash.length; i++) {
			const char = dataToHash.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}

		// Create a hex version of the hash and use it as the ID
		const hashHex = (hash >>> 0).toString(16);
		return `${username}-${timestamp}-${hashHex}`;
	}

	/**
	 * Send tweets that a peer hasn't received yet
	 * @param {Object} conn - PeerJS connection
	 */
	sendSelectiveTweets(conn) {
		// Get peer ID
		const peerId = conn.peer;

		// Determine which tweets this peer hasn't received yet
		let unsentTweetIds = [];

		// Check the unsent tweets list for this peer
		if (this.unsentTweets[peerId] && this.unsentTweets[peerId].length > 0) {
			unsentTweetIds = [...this.unsentTweets[peerId]];
		}

		// Also check all tweets to see if this peer is in their recipients list
		this.tweets.forEach(tweet => {
			if (!this.tweetRecipients[tweet.id] || !this.tweetRecipients[tweet.id].includes(peerId)) {
				if (!unsentTweetIds.includes(tweet.id)) {
					unsentTweetIds.push(tweet.id);
				}
			}
		});

		if (unsentTweetIds.length === 0) {
			console.log(`No unsent tweets for peer ${peerId}`);
			return;
		}

		console.log(`Sending ${unsentTweetIds.length} unsent tweets to peer ${peerId}`);

		// Prepare the tweets to send
		const tweetsToSend = this.tweets.filter(tweet => unsentTweetIds.includes(tweet.id));

		// Split into smaller batches if there are many tweets to avoid overwhelming the connection
		const BATCH_SIZE = 20;
		const batches = [];

		for (let i = 0; i < tweetsToSend.length; i += BATCH_SIZE) {
			batches.push(tweetsToSend.slice(i, i + BATCH_SIZE));
		}

		// Send tweets in batches with small delays between batches
		batches.forEach((batch, index) => {
			setTimeout(() => {
				try {
					const batchData = {
						type: 'all_tweets',
						tweets: batch
					};

					conn.send(batchData);

					// Mark these tweets as sent to this peer
					batch.forEach(tweet => {
						if (!this.tweetRecipients[tweet.id]) {
							this.tweetRecipients[tweet.id] = [];
						}
						if (!this.tweetRecipients[tweet.id].includes(peerId)) {
							this.tweetRecipients[tweet.id].push(peerId);
						}

						// Remove from unsent list
						if (this.unsentTweets[peerId]) {
							this.unsentTweets[peerId] = this.unsentTweets[peerId].filter(id => id !== tweet.id);
						}
					});

					// Save updated state after each batch
					this.saveMessageDistributionState();

					console.log(`Sent batch ${index + 1}/${batches.length} (${batch.length} tweets) to peer ${peerId}`);
				} catch (error) {
					console.error(`Failed to send unsent tweets batch to peer ${peerId}:`, error);

					// If sending fails, make sure these tweets stay in the unsent list
					batch.forEach(tweet => {
						if (!this.unsentTweets[peerId]) {
							this.unsentTweets[peerId] = [];
						}
						if (!this.unsentTweets[peerId].includes(tweet.id)) {
							this.unsentTweets[peerId].push(tweet.id);
						}
					});

					this.saveMessageDistributionState();
				}
			}, index * 500); // 500ms delay between batches
		});
	}

	/**
	 * Get all tweets
	 * @returns {Array} - All tweets
	 */
	getAllTweets() {
		return [...this.tweets];
	}

	/**
	 * Handle tweet message from a peer
	 * @param {Object} data - Message data
	 * @param {Object} conn - PeerJS connection
	 */
	handleTweetMessage(data, conn) {
		try {
			// Validate the tweet data
			const tweetData = {
				username: data.username,
				content: data.content,
				timestamp: data.timestamp,
				id: data.id
			};

			if (!this.validateTweet(tweetData)) {
				console.error('Received invalid tweet from peer', conn.peer, data);
				return;
			}

			// If the tweet has an ID, use it, otherwise generate one
			const tweetId = data.id || this.generateUniqueId(data.username, data.content, data.timestamp);

			// Add tweet to our database
			this.addTweet(data.username, data.content, data.timestamp, null, tweetId);

			// Mark as received from this peer
			if (!this.tweetRecipients[tweetId]) {
				this.tweetRecipients[tweetId] = [];
			}
			if (!this.tweetRecipients[tweetId].includes(conn.peer)) {
				this.tweetRecipients[tweetId].push(conn.peer);
			}

			// Send an acknowledgment back
			conn.send({
				type: 'tweet_ack',
				id: tweetId
			});

			this.saveMessageDistributionState();

			// Notify listeners
			if (typeof this.onTweetsUpdated === 'function') {
				this.onTweetsUpdated();
			}
		} catch (error) {
			console.error('Error handling tweet message:', error);
		}
	}

	/**
	 * Handle tweet acknowledgment message from a peer
	 * @param {Object} data - Message data
	 * @param {Object} conn - PeerJS connection
	 */
	handleTweetAckMessage(data, conn) {
		// Handle tweet acknowledgment
		if (data.id && this.tweetRecipients[data.id] && !this.tweetRecipients[data.id].includes(conn.peer)) {
			this.tweetRecipients[data.id].push(conn.peer);

			// If this peer had this tweet in their unsent list, remove it
			if (this.unsentTweets[conn.peer]) {
				this.unsentTweets[conn.peer] = this.unsentTweets[conn.peer].filter(id => id !== data.id);
			}

			this.saveMessageDistributionState();
		}
	}

	/**
	 * Handle all_tweets message from a peer
	 * @param {Object} data - Message data
	 * @param {Object} conn - PeerJS connection
	 */
	handleAllTweetsMessage(data, conn) {
		try {
			// Validate the tweets array
			if (!Array.isArray(data.tweets)) {
				console.error('Received invalid tweets array from peer', conn.peer);
				return;
			}

			// Track valid tweets
			const validTweetIds = [];

			// Process the received tweets
			data.tweets.forEach(tweet => {
				try {
					// Validate each tweet
					if (!this.validateTweet(tweet)) {
						console.error('Skipping invalid tweet in bulk message:', tweet);
						return;
					}

					// Use the tweet's ID if provided, otherwise generate one
					const tweetId = tweet.id || this.generateUniqueId(tweet.username, tweet.content, tweet.timestamp);

					// Add the tweet
					this.addTweet(tweet.username, tweet.content, tweet.timestamp, null, tweetId);

					// Mark as received from this peer
					if (!this.tweetRecipients[tweetId]) {
						this.tweetRecipients[tweetId] = [];
					}
					if (!this.tweetRecipients[tweetId].includes(conn.peer)) {
						this.tweetRecipients[tweetId].push(conn.peer);
					}

					validTweetIds.push(tweetId);
				} catch (error) {
					console.error('Error processing individual tweet in bulk message:', error);
				}
			});

			// Send acknowledgment for all valid received tweets
			if (validTweetIds.length > 0) {
				conn.send({
					type: 'bulk_tweet_ack',
					ids: validTweetIds
				});
			}

			this.saveMessageDistributionState();

			// Notify listeners
			if (typeof this.onTweetsUpdated === 'function') {
				this.onTweetsUpdated();
			}
		} catch (error) {
			console.error('Error handling bulk tweet message:', error);
		}
	}

	/**
	 * Handle bulk_tweet_ack message from a peer
	 * @param {Object} data - Message data
	 * @param {Object} conn - PeerJS connection
	 */
	handleBulkTweetAckMessage(data, conn) {
		// Handle bulk acknowledgment of tweets
		if (data.ids && Array.isArray(data.ids)) {
			data.ids.forEach(tweetId => {
				if (this.tweetRecipients[tweetId] && !this.tweetRecipients[tweetId].includes(conn.peer)) {
					this.tweetRecipients[tweetId].push(conn.peer);
				}

				// If this peer had this tweet in their unsent list, remove it
				if (this.unsentTweets[conn.peer]) {
					this.unsentTweets[conn.peer] = this.unsentTweets[conn.peer].filter(id => id !== tweetId);
				}
			});

			this.saveMessageDistributionState();
		}
	}
}
