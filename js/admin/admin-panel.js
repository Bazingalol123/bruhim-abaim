/**
 * Admin Panel JavaScript
 * Manages the admin panel for viewing uploaded wedding videos
 */

import { storage, auth } from '../config/firebase-config.js';
import { requireAuth, signOutUser, onAuthStateChange } from '../auth/auth-manager.js';
import { 
    ref, 
    listAll, 
    getDownloadURL, 
    getMetadata 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// DOM Elements
const userEmailElement = document.getElementById('userEmail');
const logoutButton = document.getElementById('logoutButton');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const videosGrid = document.getElementById('videosGrid');

// Stats elements
const totalVideosElement = document.getElementById('totalVideos');
const totalGuestsElement = document.getElementById('totalGuests');
const totalSizeElement = document.getElementById('totalSize');

// Modal elements
const videoModal = document.getElementById('videoModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalVideo = document.getElementById('modalVideo');
const modalVideoSource = document.getElementById('modalVideoSource');
const modalGuestName = document.getElementById('modalGuestName');
const modalDate = document.getElementById('modalDate');
const modalDownload = document.getElementById('modalDownload');

// Application state
let videos = [];
let currentUser = null;

/**
 * Initialize the admin panel
 */
async function init() {
    console.log('🚀 Initializing admin panel...');

    // Protect page - wait for auth initialization and redirect if not authenticated
    const isAuthenticated = await requireAuth();
    
    // If not authenticated, requireAuth will redirect - don't continue
    if (!isAuthenticated) {
        console.log('⚠️ Not authenticated, waiting for redirect...');
        return;
    }

    // Set up authentication state listener for future changes
    onAuthStateChange(async (user) => {
        if (user) {
            currentUser = user;
            console.log('✅ Authenticated as:', user.email);
            userEmailElement.textContent = user.email;
            
            // Load videos only if they haven't been loaded yet
            if (videos.length === 0) {
                await loadVideos();
            }
        } else {
            console.log('❌ User signed out, redirecting...');
            window.location.href = 'admin-login.html';
        }
    });

    // Set up event listeners
    setupEventListeners();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Logout button
    logoutButton.addEventListener('click', handleLogout);

    // Modal close handlers
    modalClose.addEventListener('click', closeVideoModal);
    modalOverlay.addEventListener('click', closeVideoModal);

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !videoModal.classList.contains('hidden')) {
            closeVideoModal();
        }
    });
}

/**
 * Handle logout
 */
async function handleLogout() {
    console.log('🚪 Logging out...');
    const result = await signOutUser();
    
    if (result.success) {
        console.log('✅ Logout successful');
        window.location.href = 'admin-login.html';
    } else {
        console.error('❌ Logout failed:', result.error);
        alert('שגיאה ביציאה מהמערכת. אנא נסו שוב.');
    }
}

/**
 * Load all videos from Firebase Storage
 */
async function loadVideos() {
    try {
        console.log('📥 Loading videos from Firebase Storage...');
        
        // Show loading state
        showState('loading');

        // Reference to wedding-videos folder
        const videosRef = ref(storage, 'wedding-videos');

        // List all files in the folder
        const result = await listAll(videosRef);
        console.log(`Found ${result.items.length} videos`);

        if (result.items.length === 0) {
            showState('empty');
            return;
        }

        // Process each video file
        const videoPromises = result.items.map(async (itemRef) => {
            try {
                // Get download URL
                const downloadURL = await getDownloadURL(itemRef);
                
                // Get metadata (includes size, upload time, etc.)
                const metadata = await getMetadata(itemRef);
                
                // Parse filename to extract guest name and timestamp
                const videoInfo = parseVideoFilename(itemRef.name);
                
                return {
                    name: itemRef.name,
                    url: downloadURL,
                    guestName: videoInfo.guestName,
                    timestamp: videoInfo.timestamp,
                    uploadDate: metadata.timeCreated,
                    size: metadata.size,
                    contentType: metadata.contentType
                };
            } catch (error) {
                console.error(`❌ Error processing video ${itemRef.name}:`, error);
                return null;
            }
        });

        // Wait for all videos to be processed
        const processedVideos = await Promise.all(videoPromises);
        
        // Filter out any null values (failed videos)
        videos = processedVideos.filter(video => video !== null);
        
        // Sort videos by upload date (newest first)
        videos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        console.log(`✅ Successfully loaded ${videos.length} videos`);

        // Update stats
        updateStats();

        // Display videos
        displayVideos();

        // Show videos grid
        showState('videos');

    } catch (error) {
        console.error('❌ Error loading videos:', error);
        errorMessage.textContent = `שגיאה: ${error.message}`;
        showState('error');
    }
}

/**
 * Parse video filename to extract guest name and timestamp
 * Expected format: {timestamp}_{guestName}.webm
 * Example: 1234567890_John_Doe.webm
 */
function parseVideoFilename(filename) {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.(webm|mp4|mov)$/i, '');
    
    // Split by underscore
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 2) {
        return {
            guestName: 'אורח',
            timestamp: Date.now()
        };
    }
    
    // First part is timestamp, rest is guest name
    const timestamp = parseInt(parts[0]) || Date.now();
    const guestName = parts.slice(1).join(' ');
    
    return {
        guestName: guestName || 'אורח',
        timestamp: timestamp
    };
}

/**
 * Update statistics
 */
function updateStats() {
    // Total videos
    totalVideosElement.textContent = videos.length;

    // Unique guests (count unique guest names)
    const uniqueGuests = new Set(videos.map(v => v.guestName));
    totalGuestsElement.textContent = uniqueGuests.size;

    // Total size
    const totalBytes = videos.reduce((sum, video) => sum + (video.size || 0), 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    totalSizeElement.textContent = `${totalMB} MB`;
}

/**
 * Display videos in the grid
 */
function displayVideos() {
    videosGrid.innerHTML = '';

    videos.forEach((video, index) => {
        const videoCard = createVideoCard(video, index);
        videosGrid.appendChild(videoCard);
    });
}

/**
 * Create a video card element
 */
function createVideoCard(video, index) {
    const card = document.createElement('div');
    card.className = 'video-card';

    // Format date
    const formattedDate = formatDate(video.uploadDate);
    const formattedTime = formatTime(video.uploadDate);

    // Format file size
    const sizeMB = (video.size / (1024 * 1024)).toFixed(1);

    card.innerHTML = `
        <div class="video-thumbnail">
            <video class="video-preview" preload="metadata">
                <source src="${video.url}#t=0.5" type="${video.contentType}">
            </video>
            <div class="video-overlay">
                <button class="play-button" data-index="${index}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
            </div>
            <div class="video-duration">${formattedTime}</div>
        </div>
        <div class="video-info">
            <h3 class="video-guest-name">${escapeHtml(video.guestName)}</h3>
            <div class="video-meta">
                <span class="video-date">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    ${formattedDate}
                </span>
                <span class="video-size">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    ${sizeMB} MB
                </span>
            </div>
        </div>
        <div class="video-actions">
            <button class="btn-watch" data-index="${index}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 7l-7 5 7 5V7z"></path>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                צפו
            </button>
            <a href="${video.url}" download="${video.name}" class="btn-download-small">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                הורידו
            </a>
        </div>
    `;

    // Add event listeners to buttons
    const playButton = card.querySelector('.play-button');
    const watchButton = card.querySelector('.btn-watch');

    playButton.addEventListener('click', () => openVideoModal(index));
    watchButton.addEventListener('click', () => openVideoModal(index));

    return card;
}

/**
 * Open video in modal
 */
function openVideoModal(index) {
    const video = videos[index];
    
    // Set modal content
    modalGuestName.textContent = video.guestName;
    modalDate.textContent = formatDate(video.uploadDate);
    modalVideoSource.src = video.url;
    modalDownload.href = video.url;
    modalDownload.download = video.name;

    // Reload video
    modalVideo.load();

    // Show modal
    videoModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Auto-play video
    modalVideo.play().catch(error => {
        console.log('Auto-play prevented:', error);
    });
}

/**
 * Close video modal
 */
function closeVideoModal() {
    // Pause and reset video
    modalVideo.pause();
    modalVideo.currentTime = 0;

    // Hide modal
    videoModal.classList.add('hidden');
    document.body.style.overflow = '';
}

/**
 * Show specific state (loading, empty, error, videos)
 */
function showState(state) {
    // Hide all states
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
    videosGrid.classList.add('hidden');

    // Show requested state
    switch (state) {
        case 'loading':
            loadingState.classList.remove('hidden');
            break;
        case 'empty':
            emptyState.classList.remove('hidden');
            break;
        case 'error':
            errorState.classList.remove('hidden');
            break;
        case 'videos':
            videosGrid.classList.remove('hidden');
            break;
    }
}

/**
 * Format date to Hebrew format
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Jerusalem'
    };
    
    try {
        return new Intl.DateTimeFormat('he-IL', options).format(date);
    } catch (error) {
        // Fallback to ISO date
        return date.toLocaleDateString('he-IL');
    }
}

/**
 * Format time
 */
function formatTime(dateString) {
    const date = new Date(dateString);
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jerusalem'
    };
    
    try {
        return new Intl.DateTimeFormat('he-IL', options).format(date);
    } catch (error) {
        return date.toLocaleTimeString('he-IL');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
