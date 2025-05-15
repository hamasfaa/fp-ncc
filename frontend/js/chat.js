// Configuration
const API_URL = 'http://localhost:8000'; // Update this to match your backend URL

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const onlineCount = document.getElementById('online-count');
const totalMembers = document.getElementById('total-members');
const messageTemplate = document.getElementById('message-template');

// Global state
let ws = null;
let globalChatId = null;
let currentUser = null;

// Check if user is logged in, redirect if not
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user) {
        // Redirect to login page
        window.location.href = 'index.html';
        return false;
    }

    currentUser = user;
    userName.textContent = user.username;
    return true;
}

// Fetch global chat details
async function getGlobalChat() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/chats/global`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch global chat');
        }

        const data = await response.json();
        globalChatId = data.globalChat.id;

        // Now fetch chat messages
        await getGlobalChatMessages();

        // And fetch stats
        await getGlobalChatStats();

        return data.globalChat;
    } catch (error) {
        console.error('Error fetching global chat:', error);
        showError('Failed to load global chat. Please try refreshing the page.');
    }
}

// Fetch global chat statistics
async function getGlobalChatStats() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/chats/global/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch chat stats');
        }

        const data = await response.json();
        onlineCount.textContent = `${data.stats.activeMembers} online`;
        totalMembers.textContent = `${data.stats.totalMembers} members`;
    } catch (error) {
        console.error('Error fetching chat stats:', error);
    }
}

// Fetch global chat messages
async function getGlobalChatMessages() {
    try {
        if (!globalChatId) return;

        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/chats/${globalChatId}/messages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch chat messages');
        }

        const data = await response.json();

        // Remove loading indicator
        const loadingEl = document.querySelector('.message-loading');
        if (loadingEl) loadingEl.remove();

        // Display messages in reverse chronological order (newest last)
        data.messages.reverse().forEach(message => {
            displayMessage(message);
        });

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error fetching messages:', error);
        showError('Failed to load messages. Please try refreshing the page.');
    }
}

// Connect to WebSocket
function connectWebSocket() {
    const token = localStorage.getItem('authToken');

    if (!token) {
        showError("Authentication token missing. Please log in again.");
        setTimeout(() => {
            logout();
        }, 3000);
        return;
    }

    // Close existing connection if any
    if (ws) {
        ws.close();
        ws = null;
    }

    console.log("Connecting to WebSocket...");

    try {
        ws = new WebSocket(`ws://${API_URL.replace(/^http(s)?:\/\//, '')}/ws?token=${token}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            // Clear any reconnection timers
            if (window.wsReconnectTimer) {
                clearTimeout(window.wsReconnectTimer);
                window.wsReconnectTimer = null;
            }

            // Start a ping interval to keep connection alive
            startPingInterval();
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Received WebSocket message:", data);

                if (data.type === 'text') {
                    // Check if the message is for the global chat
                    if (data.conversation_id === globalChatId) {
                        // Add the message to the UI
                        displayMessage(data.data);

                        // Scroll to bottom
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                } else if (data.type === 'user_status') {
                    // Update the online count
                    getGlobalChatStats();
                } else if (data.type === 'connection_established') {
                    console.log("WebSocket connection established, user ID:", data.userId);
                } else if (data.type === 'error') {
                    console.error("WebSocket error message:", data.error);
                    showError(data.error || "Error from server");
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        ws.onerror = (event) => {
            console.error('WebSocket error:', event);
            showError("WebSocket connection error. Attempting to reconnect...");
        };

        ws.onclose = (event) => {
            console.log('WebSocket connection closed', event);

            // Stop ping interval
            if (window.wsPingInterval) {
                clearInterval(window.wsPingInterval);
                window.wsPingInterval = null;
            }

            // Try to reconnect after a delay
            if (!window.wsReconnectTimer) {
                window.wsReconnectTimer = setTimeout(() => {
                    if (document.visibilityState !== 'hidden') {
                        console.log("Attempting to reconnect WebSocket...");
                        connectWebSocket();
                    }
                }, 3000);
            }
        };
    } catch (error) {
        console.error("Error creating WebSocket connection:", error);
        showError("Failed to connect. Will retry in a few seconds...");

        // Try to reconnect after a delay
        if (!window.wsReconnectTimer) {
            window.wsReconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, 5000);
        }
    }
}

function startPingInterval() {
    if (window.wsPingInterval) {
        clearInterval(window.wsPingInterval);
    }

    window.wsPingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "ping",
                timestamp: Date.now()
            }));
        }
    }, 30000); // Send ping every 30 seconds
}

// Display a message in the chat
function displayMessage(message) {
    // Clone the message template
    const messageNode = document.importNode(messageTemplate.content, true);
    const messageEl = messageNode.querySelector('.message');

    // Set message content
    const usernameEl = messageEl.querySelector('.username');
    const timestampEl = messageEl.querySelector('.timestamp');
    const contentEl = messageEl.querySelector('.message-content');

    console.log("Displaying message:", message);

    // Set the sender's username dynamically
    if (message.sender?.username) {
        usernameEl.textContent = message.sender.username;
    } else {
        usernameEl.textContent = 'User'; // Fallback if sender's metadata is missing
    }

    // Format timestamp
    const date = new Date(message.created_at);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    timestampEl.textContent = formattedDate;

    // Set message content
    contentEl.textContent = message.content;

    // Add special class if it's the current user's message
    if (currentUser && message.sender_id === currentUser.id) {
        messageEl.classList.add('own-message');
    }

    // Add the message to the chat
    chatMessages.appendChild(messageNode);

    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a chat message
async function sendMessage(content) {
    if (!globalChatId || !content.trim()) return;

    const token = localStorage.getItem('authToken');

    // Create an optimistic message object
    const optimisticMessage = {
        sender_id: currentUser.id,
        sender: { username: currentUser.username }, // Include sender details
        content: content, // The message content
        created_at: new Date().toISOString(), // Set the current timestamp
    };

    // Immediately display the message in the chat UI
    displayMessage(optimisticMessage);

    try {
        // Send the message to the server
        const response = await fetch(`${API_URL}/chats/${globalChatId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        // The server will broadcast the message back to all clients, including the sender
    } catch (error) {
        console.error('Error sending message:', error);

        // If sending fails, show an error message in the chat
        showError('Failed to send message. Please try again.');
    }
}

// Show an error message in the chat
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    chatMessages.appendChild(errorDiv);

    // Remove the error after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Handle form submission to send message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    sendMessage(message);
    messageInput.value = '';
});

// Handle logout button click
logoutBtn.addEventListener('click', async () => {
    try {
        const token = localStorage.getItem('authToken');

        // Close WebSocket connection
        if (ws) {
            ws.close();
        }

        // Call logout endpoint
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear local storage and redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
});

// Initialize
(async function init() {
    try {
        // Check if user is logged in
        if (!checkAuthStatus()) return;

        console.log("Fetching global chat...");
        // Get global chat
        await getGlobalChat();

        if (!globalChatId) {
            showError("Failed to load global chat. Please refresh the page.");
            return;
        }

        console.log("Global chat ID:", globalChatId);

        // Connect to WebSocket
        connectWebSocket();
    } catch (error) {
        console.error("Initialization error:", error);
        showError("Failed to initialize chat. Please refresh and try again.");
    }
})();