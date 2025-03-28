# SpellCast - Decentralized P2P Messaging

SpellCast is a fully decentralized, peer-to-peer Twitter-like application that runs entirely in your web browser. Share messages (called "spells") directly with your connections without relying on any central servers. Your data stays with you!

![SpellCast Logo](https://example.com/spellcast-logo.png)

## Key Features

- **Fully Decentralized**: No central servers or databases - everything happens directly between peers
- **Private & Secure**: Your messages are only shared with the peers you connect to
- **Browser-Based**: Runs entirely in your web browser - no installation required
- **Persistent Storage**: Messages and connections are saved in your browser's storage
- **Media Support**: Share images along with your messages
- **Offline Capable**: Create messages offline and they'll be sent when you reconnect
- **QR Code Sharing**: Connect with peers easily by scanning QR codes

## Getting Started

### How to Run SpellCast

1. Clone this repository or download the files
   ```
   git clone https://github.com/yourusername/spellcast.git
   ```

2. Open the `index.html` file in a modern web browser
   - For best results, use Chrome, Firefox, or Edge
   - You can use a local server if you prefer:
     ```
     # Using Python
     python -m http.server
     
     # Using Node.js with http-server
     npx http-server
     ```

3. That's it! SpellCast runs entirely in your browser

### Creating Your Account

1. Click the "Create New Account" button
2. Enter a username that others will see
3. Click "Generate Your Credentials"
4. Save your peer ID securely - you'll need it to log in from other devices
5. Click "Continue to App"

### Connecting with Peers

There are several ways to connect with other SpellCast users:

#### Direct Connection

1. Go to the "Connect" tab
2. Enter the peer ID of the person you want to connect with
3. Click "Connect"

#### QR Code Sharing

1. Go to your "Profile" tab to display your QR code
2. Have another SpellCast user scan your code using their device's camera
3. Alternatively, scan their QR code using a QR code scanner app

#### Reconnecting

SpellCast automatically saves your connections and will try to reconnect to known peers when you restart the app.

### Casting Spells (Sending Messages)

1. In the "Feed" tab, type your message in the text area
2. (Optional) Click the camera icon to attach an image
3. Click "Cast" to send your message
4. Your message will be sent to all connected peers and displayed in your feed

### Managing Your Connections

1. Go to the "Connect" tab to see all your connections
2. Online peers will appear at the top
3. You can disconnect from a peer by clicking the "Disconnect" button
4. Remove saved peers by clicking "Remove"

### Profile Management

1. Go to the "Profile" tab
2. Here you can see your username and peer ID
3. Share your peer ID or QR code with others to connect
4. Use the "Delete All Messages" button to clear your local message history
5. Use the "Delete Account" button to completely reset your account

## For Developers

### Project Structure

SpellCast is built with vanilla JavaScript and uses several key libraries:

- **PeerJS**: Handles WebRTC connections for peer-to-peer communication
- **IndexedDB**: Stores messages, media, and connection data persistently
- **QR Code JS**: Generates QR codes for easy peer ID sharing

### Key Components

The application is structured into several manager classes:

- **SpellCastApp**: Main application controller
- **UserManager**: Handles user credentials and authentication
- **PeerManager**: Manages peer connections and communication
- **TweetManager**: Handles message creation, storage, and distribution
- **UIManager**: Controls the user interface and event handling
- **StorageManager**: Manages persistent storage with IndexedDB
- **MediaManager**: Processes and stores image attachments
- **RateLimiter**: Prevents spam and abuse

### P2P Message Distribution System

SpellCast uses a sophisticated message distribution system:

1. When a message is created, it's stored locally and broadcast to all connected peers
2. The system tracks which peers have received which messages
3. When new peers connect, only messages they haven't seen are sent
4. This ensures efficient distribution without flooding the network

```javascript
// Simplified example of the message distribution tracking
{
  tweetRecipients: {
    "message-123": ["peer1", "peer3"], // Peers that have this message
    "message-456": ["peer1", "peer2", "peer3"]
  },
  unsentTweets: {
    "peer1": [], // This peer has all messages
    "peer2": ["message-123"], // This peer needs message-123
    "peer3": []
  }
}
```

### Storage Architecture

SpellCast uses IndexedDB for persistent storage with a fallback to localStorage:

- **User credentials**: Username and peer ID
- **Messages**: All created and received messages
- **Media**: Images attached to messages (stored as base64 data)
- **Peers**: Known connections and their status
- **Distribution state**: Which peers have received which messages

### Media Handling

The `MediaManager` class handles all aspects of media processing:

1. Images are resized to reasonable dimensions
2. Thumbnails are generated for feed display
3. Full-size images are stored for viewing on click
4. Orphaned media (from deleted messages) is cleaned up periodically

### Connection Quality Monitoring

SpellCast actively monitors connection quality:

1. Regular pings are sent to connected peers
2. Response times are measured to determine connection quality
3. Failed connections trigger automatic reconnection attempts
4. Connection quality is displayed in the UI with simple indicators

### How to Contribute

We welcome contributions to SpellCast! Here's how you can help:

1. **Fork the repository**: Create your own copy of the project
2. **Make your changes**: Add features or fix bugs
3. **Test thoroughly**: Ensure your changes work as expected
4. **Submit a pull request**: Share your improvements with us

#### Development Setup

1. Clone the repository
   ```
   git clone https://github.com/yourusername/spellcast.git
   ```

2. Set up a local development server
   ```
   # Using Python
   python -m http.server
   
   # Using Node.js with http-server
   npx http-server
   ```

3. Open `http://localhost:8000` (or whatever port your server uses)

4. Make changes and refresh the browser to see them

#### Coding Guidelines

- Use clear, descriptive variable and function names
- Add comments for complex logic
- Maintain the existing code structure and patterns
- Write clean, modular code
- Test your changes across different browsers

## License

See the LICENSE file for details.

## Acknowledgments

- [PeerJS](https://peerjs.com/) for the WebRTC implementation
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) for QR code generation

---

*Cast spells, not tweets. Be decentralized.*