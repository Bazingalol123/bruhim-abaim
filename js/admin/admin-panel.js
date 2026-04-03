/**
 * Admin Panel JavaScript
 * Manages the admin panel for viewing uploaded wedding media (videos & images)
 */

// Google Drive API configuration
// Replace with your OAuth Client ID from Google Cloud Console
// See docs/google-drive-setup.md for setup instructions
const GOOGLE_DRIVE_CLIENT_ID = '1047795100077-auful7oeq5ut0o53sk3icmein8kd64s6.apps.googleusercontent.com'; // TODO: Replace with actual Client ID
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

import { storage, auth, db } from '../config/firebase-config.js';
import { requireAuth, signOutUser, onAuthStateChange } from '../auth/auth-manager.js';
import {
    ref,
    listAll,
    getDownloadURL,
    getMetadata
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import {
    collection,
    getDocs,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// DOM Elements
const userEmailElement = document.getElementById('userEmail');
const logoutButton = document.getElementById('logoutButton');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const videosGrid = document.getElementById('videosGrid');

// Stats elements
const statVideosElement = document.getElementById('stat-videos');
const statImagesElement = document.getElementById('stat-images');
const statGuestsElement = document.getElementById('stat-guests');
const statStorageElement = document.getElementById('stat-storage');

// Modal elements
const videoModal = document.getElementById('videoModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalVideo = document.getElementById('modalVideo');
const modalVideoSource = document.getElementById('modalVideoSource');
const modalGuestName = document.getElementById('modalGuestName');
const modalDate = document.getElementById('modalDate');
const modalDownload = document.getElementById('modalDownload');
const modalDownloadText = document.getElementById('modalDownloadText');
const modalVideoContainer = document.getElementById('modalVideoContainer');
const modalImageContainer = document.getElementById('modalImageContainer');
const modalImage = document.getElementById('modalImage');

// Application state
let mediaItems = [];
let currentUser = null;
let currentFilter = 'all';
let selectedItems = new Set(); // Track selected item indices
let googleAccessToken = null; // Google OAuth access token
let tokenClient = null; // Google Identity Services token client

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
            
            // Load media only if they haven't been loaded yet
            if (mediaItems.length === 0) {
                await loadMedia();
            }
        } else {
            console.log('❌ User signed out, redirecting...');
            window.location.href = 'admin-login.html';
        }
    });

    // Set up event listeners
    setupEventListeners();

    // Initialize QR code section
    initQRSection();

    // Initialize Google Drive integration
    initGoogleDrive();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Logout button
    logoutButton.addEventListener('click', handleLogout);

    // Modal close handlers
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !videoModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            handleFilterClick(btn);
        });
    });

    // Selection controls
    document.getElementById('selectAllBtn')?.addEventListener('click', selectAllVisible);
    document.getElementById('downloadZipBtn')?.addEventListener('click', downloadSelectedAsZip);
    document.getElementById('uploadDriveBtn')?.addEventListener('click', handleDriveUpload);
    document.getElementById('clearSelectionBtn')?.addEventListener('click', clearSelection);
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
 * Load all media from Firestore (videos and images)
 */
async function loadMedia() {
    try {
        console.log('📥 Loading media from Firestore...');
        
        // Show loading state
        showState('loading');

        // Query videoMetadata collection, ordered by timestamp (newest first)
        const mediaQuery = query(
            collection(db, 'videoMetadata'),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(mediaQuery);
        console.log(`Found ${querySnapshot.size} media items`);

        if (querySnapshot.empty) {
            showState('empty');
            return;
        }

        // Process each media document
        mediaItems = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Detect media type — backward compat: old docs without mediaType are videos
            const mediaType = data.mediaType || 'video';
            
            // Convert Firestore timestamp to Date
            const uploadDate = data.timestamp?.toDate() || data.uploadedAt?.toDate() || new Date();
            
            if (mediaType === 'image') {
                mediaItems.push({
                    id: doc.id,
                    mediaType: 'image',
                    name: `${data.guestName}.jpg`,
                    url: data.mediaUrl || data.imageUrl || data.videoUrl,
                    guestName: data.guestName || 'אורח',
                    uploadDate: uploadDate.toISOString(),
                    size: data.fileSize || 0,
                    contentType: 'image/jpeg',
                    width: data.width || 0,
                    height: data.height || 0,
                    deviceInfo: data.deviceInfo || {},
                    viewed: data.viewed || false,
                    starred: data.starred || false
                });
            } else {
                mediaItems.push({
                    id: doc.id,
                    mediaType: 'video',
                    name: `${data.guestName}.webm`,
                    url: data.mediaUrl || data.videoUrl,
                    guestName: data.guestName || 'אורח',
                    uploadDate: uploadDate.toISOString(),
                    size: data.fileSize || 0,
                    contentType: 'video/webm',
                    duration: data.duration || 0,
                    deviceInfo: data.deviceInfo || {},
                    viewed: data.viewed || false,
                    starred: data.starred || false
                });
            }
        });

        console.log(`✅ Successfully loaded ${mediaItems.length} media items`);

        // Update stats
        updateStats();

        // Display media
        displayMedia();

        // Show media grid
        showState('videos');

    } catch (error) {
        console.error('❌ Error loading media:', error);
        errorMessage.textContent = `שגיאה: ${error.message}`;
        showState('error');
    }
}

/**
 * Update statistics
 */
function updateStats() {
    // Video count
    const videoCount = mediaItems.filter(item => item.mediaType === 'video').length;
    statVideosElement.textContent = videoCount;

    // Image count
    const imageCount = mediaItems.filter(item => item.mediaType === 'image').length;
    statImagesElement.textContent = imageCount;

    // Unique guests (count unique guest names across all media)
    const uniqueGuests = new Set(mediaItems.map(item => item.guestName));
    statGuestsElement.textContent = uniqueGuests.size;

    // Total size (both images and videos)
    const totalBytes = mediaItems.reduce((sum, item) => sum + (item.size || 0), 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    statStorageElement.textContent = `${totalMB} MB`;
}

/**
 * Display media items in the grid
 */
function displayMedia() {
    videosGrid.innerHTML = '';

    mediaItems.forEach((item, index) => {
        const card = createMediaCard(item, index);
        videosGrid.appendChild(card);
    });
}

/**
 * Create a media card element (video or image)
 */
function createMediaCard(item, index) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.setAttribute('data-media-type', item.mediaType);
    card.setAttribute('data-index', index);

    // Format date
    const formattedDate = formatDate(item.uploadDate);
    const formattedTime = formatTime(item.uploadDate);

    // Format file size
    const sizeMB = (item.size / (1024 * 1024)).toFixed(1);

    if (item.mediaType === 'image') {
        card.innerHTML = `
            <div class="video-thumbnail">
                <div class="card-select-checkbox" data-index="${index}"></div>
                <img
                    class="media-thumbnail-image" 
                    src="${item.url}" 
                    alt="תמונה מאת ${escapeHtml(item.guestName)}"
                    loading="lazy"
                />
                <div class="video-overlay">
                    <button class="play-button" data-index="${index}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                    </button>
                </div>
                <span class="media-type-badge" aria-label="סוג: תמונה">📸</span>
            </div>
            <div class="video-info">
                <h3 class="video-guest-name">${escapeHtml(item.guestName)}</h3>
                <div class="video-meta">
                    <span class="video-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formattedDate} ${formattedTime}
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
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    צפו
                </button>
                <a href="${item.url}" download="${item.name}" class="btn-download-small">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    הורידו
                </a>
            </div>
        `;

        // Add event listeners for image card
        const playButton = card.querySelector('.play-button');
        const watchButton = card.querySelector('.btn-watch');
        const imgThumbnail = card.querySelector('.media-thumbnail-image');
        const selectCheckbox = card.querySelector('.card-select-checkbox');

        playButton.addEventListener('click', () => openModal(index));
        watchButton.addEventListener('click', () => openModal(index));
        imgThumbnail.addEventListener('click', () => openModal(index));
        imgThumbnail.style.cursor = 'pointer';

        selectCheckbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSelection(index);
        });

    } else {
        // Video card (existing behavior)
        const formattedDuration = formatDuration(item.duration);

        card.innerHTML = `
            <div class="video-thumbnail">
                <div class="card-select-checkbox" data-index="${index}"></div>
                <video class="video-preview" preload="metadata" muted>
                    <source src="${item.url}#t=0.5" type="${item.contentType}">
                </video>
                <div class="video-overlay">
                    <button class="play-button" data-index="${index}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                </div>
                ${item.duration > 0 ? `<div class="video-duration">🎥 ${formattedDuration}</div>` : ''}
                <span class="media-type-badge" aria-label="סוג: סרטון">🎥</span>
            </div>
            <div class="video-info">
                <h3 class="video-guest-name">${escapeHtml(item.guestName)}</h3>
                <div class="video-meta">
                    <span class="video-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formattedDate} ${formattedTime}
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
                <a href="${item.url}" download="${item.name}" class="btn-download-small">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    הורידו
                </a>
            </div>
        `;

        // Add event listeners for video card
        const playButton = card.querySelector('.play-button');
        const watchButton = card.querySelector('.btn-watch');
        const videoPreview = card.querySelector('.video-preview');
        const selectCheckbox = card.querySelector('.card-select-checkbox');

        playButton.addEventListener('click', () => openModal(index));
        watchButton.addEventListener('click', () => openModal(index));
        videoPreview.addEventListener('click', () => openModal(index));
        videoPreview.style.cursor = 'pointer';

        selectCheckbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSelection(index);
        });
    }

    return card;
}

/**
 * Open media in modal (handles both video and image)
 */
function openModal(index) {
    const item = mediaItems[index];
    
    // Set modal header content
    modalGuestName.textContent = item.guestName;
    modalDate.textContent = formatDate(item.uploadDate);
    
    // Set download link
    modalDownload.href = item.url;
    modalDownload.download = item.name;

    if (item.mediaType === 'image') {
        // Show image, hide video
        modalVideoContainer.classList.add('hidden');
        modalImageContainer.classList.remove('hidden');
        
        // Pause any playing video
        modalVideo.pause();
        modalVideo.currentTime = 0;
        
        // Set image source
        modalImage.src = item.url;
        modalImage.alt = `תמונה מאת ${item.guestName}`;
        
        // Update download button text
        modalDownloadText.textContent = 'הורידו תמונה';
    } else {
        // Show video, hide image
        modalVideoContainer.classList.remove('hidden');
        modalImageContainer.classList.add('hidden');
        
        // Clear image
        modalImage.src = '';
        
        // Set video source
        modalVideoSource.src = item.url;
        modalVideo.load();
        
        // Update download button text
        modalDownloadText.textContent = 'הורידו סרטון';
        
        // Auto-play video
        modalVideo.play().catch(error => {
            console.log('Auto-play prevented:', error);
        });
    }

    // Show modal
    videoModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * Close modal
 */
function closeModal() {
    // Pause and reset video
    modalVideo.pause();
    modalVideo.currentTime = 0;
    
    // Clear image
    modalImage.src = '';

    // Hide modal
    videoModal.classList.add('hidden');
    document.body.style.overflow = '';
}

/**
 * Handle filter button click
 */
function handleFilterClick(clickedBtn) {
    const filter = clickedBtn.getAttribute('data-filter');
    
    // Update active state on buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    clickedBtn.classList.add('active');
    clickedBtn.setAttribute('aria-selected', 'true');
    
    // Store current filter
    currentFilter = filter;
    
    // Filter cards by data-media-type attribute using CSS class toggling
    const cards = videosGrid.querySelectorAll('.video-card');
    cards.forEach(card => {
        const cardType = card.getAttribute('data-media-type');
        
        if (filter === 'all' || cardType === filter) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    // Update selection UI after filtering (so select-all button state is correct)
    updateSelectionUI();
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
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) {
        return '0:00';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

// ── Multi-Select & ZIP Download ──────────────────────────────────────

/**
 * Toggle selection of a media item
 */
function toggleSelection(index) {
    if (selectedItems.has(index)) {
        selectedItems.delete(index);
    } else {
        selectedItems.add(index);
    }
    updateSelectionUI();
}

/**
 * Update all selection-related UI
 */
function updateSelectionUI() {
    const selectionBar = document.getElementById('selectionBar');
    const selectionCount = document.getElementById('selectionCount');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    
    // Update card visual states
    document.querySelectorAll('.video-card').forEach(card => {
        const index = parseInt(card.dataset.index);
        if (selectedItems.has(index)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    const uploadDriveBtn = document.getElementById('uploadDriveBtn');

    // Show/hide selection bar
    if (selectedItems.size > 0) {
        selectionBar.classList.remove('hidden');
        selectionCount.textContent = `${selectedItems.size} נבחרו`;
        downloadZipBtn.disabled = false;
        if (uploadDriveBtn) uploadDriveBtn.disabled = false;
    } else {
        selectionBar.classList.add('hidden');
        downloadZipBtn.disabled = true;
        if (uploadDriveBtn) uploadDriveBtn.disabled = true;
    }
    
    // Update "select all" button text
    const visibleCards = document.querySelectorAll('.video-card:not(.hidden)');
    const allVisibleSelected = visibleCards.length > 0 && [...visibleCards].every(card => selectedItems.has(parseInt(card.dataset.index)));
    selectAllBtn.textContent = allVisibleSelected ? 'בטל בחירה' : 'בחר הכל';
}

/**
 * Select all visible (non-filtered) items
 */
function selectAllVisible() {
    const visibleCards = document.querySelectorAll('.video-card:not(.hidden)');
    const allVisibleSelected = visibleCards.length > 0 && [...visibleCards].every(card => selectedItems.has(parseInt(card.dataset.index)));
    
    if (allVisibleSelected) {
        // Deselect all visible
        visibleCards.forEach(card => {
            selectedItems.delete(parseInt(card.dataset.index));
        });
    } else {
        // Select all visible
        visibleCards.forEach(card => {
            selectedItems.add(parseInt(card.dataset.index));
        });
    }
    updateSelectionUI();
}

/**
 * Clear all selections
 */
function clearSelection() {
    selectedItems.clear();
    updateSelectionUI();
}

/**
 * Download selected items as ZIP
 */
async function downloadSelectedAsZip() {
    if (selectedItems.size === 0) return;
    
    // Create progress overlay
    const overlay = document.createElement('div');
    overlay.className = 'zip-progress-overlay';
    overlay.innerHTML = `
        <div class="zip-progress-card">
            <h3>📦 מכין קובץ ZIP...</h3>
            <div class="zip-progress-bar">
                <div class="zip-progress-fill" id="zipProgressFill"></div>
            </div>
            <p class="zip-progress-text" id="zipProgressText">מוריד 0 מתוך ${selectedItems.size}...</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const progressFill = document.getElementById('zipProgressFill');
    const progressText = document.getElementById('zipProgressText');
    
    try {
        const zip = new JSZip();
        const selectedArray = Array.from(selectedItems);
        let completed = 0;
        
        for (const index of selectedArray) {
            const item = mediaItems[index];
            if (!item || !item.url) continue;
            
            try {
                const response = await fetch(item.url);
                const blob = await response.blob();
                
                // Create a unique filename
                const extension = item.mediaType === 'image' ? 'jpg' : 'webm';
                const fileName = `${item.guestName || 'guest'}_${index}.${extension}`;
                
                zip.file(fileName, blob);
            } catch (fetchErr) {
                console.warn(`Failed to fetch item ${index}:`, fetchErr);
            }
            
            completed++;
            const percent = Math.round((completed / selectedArray.length) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `מוריד ${completed} מתוך ${selectedArray.length}...`;
        }
        
        progressText.textContent = 'יוצר קובץ ZIP...';
        
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            progressFill.style.width = `${Math.round(metadata.percent)}%`;
        });
        
        // Trigger download
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wedding-media-${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Clear selection after successful download
        clearSelection();
        
    } catch (err) {
        console.error('ZIP creation failed:', err);
        alert('שגיאה ביצירת קובץ ZIP. נסו שנית.');
    } finally {
        document.body.removeChild(overlay);
    }
}

// ── Google Drive Integration ─────────────────────────────────────────

/**
 * Initialize Google Identity Services token client
 */
function initGoogleDrive() {
    // Check if GIS library is loaded
    if (typeof google === 'undefined' || !google.accounts) {
        console.warn('Google Identity Services not loaded yet');
        // Retry after a short delay
        setTimeout(initGoogleDrive, 1000);
        return;
    }
    
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                console.error('Google OAuth error:', tokenResponse.error);
                return;
            }
            googleAccessToken = tokenResponse.access_token;
            // Proceed with upload after getting token
            uploadSelectedToDrive();
        },
    });
}

/**
 * Handle Drive upload button click
 */
function handleDriveUpload() {
    if (selectedItems.size === 0) return;
    
    if (GOOGLE_DRIVE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
        alert('Google Drive Client ID not configured.\nSee docs/google-drive-setup.md for setup instructions.');
        return;
    }
    
    if (!tokenClient) {
        alert('Google Identity Services not loaded. Please refresh the page.');
        return;
    }
    
    // If we already have a valid token, upload directly
    if (googleAccessToken) {
        uploadSelectedToDrive();
    } else {
        // Request access token - this will trigger the OAuth popup
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

/**
 * Create a folder in Google Drive (returns folder ID)
 */
async function createDriveFolder(folderName) {
    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
    };
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });
    
    if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.status}`);
    }
    
    const folder = await response.json();
    return folder.id;
}

/**
 * Upload a single file to Google Drive
 */
async function uploadFileToDrive(blob, fileName, folderId, mimeType) {
    const metadata = {
        name: fileName,
        parents: [folderId]
    };
    
    // Use multipart upload for files
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${googleAccessToken}`
        },
        body: form
    });
    
    if (!response.ok) {
        const errText = await response.text();
        // If unauthorized, clear token so next attempt re-authenticates
        if (response.status === 401) {
            googleAccessToken = null;
        }
        throw new Error(`Upload failed (${response.status}): ${errText}`);
    }
    
    return await response.json();
}

/**
 * Upload all selected items to Google Drive
 */
async function uploadSelectedToDrive() {
    if (selectedItems.size === 0) return;
    
    // Create progress overlay
    const overlay = document.createElement('div');
    overlay.className = 'zip-progress-overlay';
    overlay.innerHTML = `
        <div class="zip-progress-card">
            <h3>☁️ מעלה ל-Google Drive...</h3>
            <div class="zip-progress-bar">
                <div class="zip-progress-fill" id="driveProgressFill"></div>
            </div>
            <p class="zip-progress-text" id="driveProgressText">יוצר תיקייה...</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const progressFill = document.getElementById('driveProgressFill');
    const progressText = document.getElementById('driveProgressText');
    
    try {
        // Create a dated folder
        const dateStr = new Date().toISOString().slice(0, 10);
        const folderName = `Wedding Media ${dateStr}`;
        const folderId = await createDriveFolder(folderName);
        
        const selectedArray = Array.from(selectedItems);
        let completed = 0;
        let failed = 0;
        
        for (const index of selectedArray) {
            const item = mediaItems[index];
            if (!item || !item.url) continue;
            
            const extension = item.mediaType === 'image' ? 'jpg' : 'webm';
            const fileName = `${item.guestName || 'guest'}_${index}.${extension}`;
            const mimeType = item.mediaType === 'image' ? 'image/jpeg' : 'video/webm';
            
            progressText.textContent = `מעלה ${completed + 1} מתוך ${selectedArray.length}: ${fileName}`;
            
            try {
                const response = await fetch(item.url);
                const blob = await response.blob();
                await uploadFileToDrive(blob, fileName, folderId, mimeType);
            } catch (uploadErr) {
                console.warn(`Failed to upload ${fileName}:`, uploadErr);
                failed++;
                // If token expired, stop and re-auth
                if (!googleAccessToken) {
                    document.body.removeChild(overlay);
                    alert('ההרשאה פגה. אנא נסו שנית.');
                    return;
                }
            }
            
            completed++;
            const percent = Math.round((completed / selectedArray.length) * 100);
            progressFill.style.width = `${percent}%`;
        }
        
        // Show completion message
        if (failed === 0) {
            progressText.textContent = `✅ ${completed} קבצים הועלו בהצלחה!`;
        } else {
            progressText.textContent = `✅ ${completed - failed} הועלו, ❌ ${failed} נכשלו`;
        }
        progressFill.style.width = '100%';
        progressFill.style.background = failed === 0 ? 'var(--success)' : 'var(--error)';
        
        // Auto-close after 2 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            clearSelection();
        }, 2500);
        
    } catch (err) {
        console.error('Drive upload failed:', err);
        document.body.removeChild(overlay);
        
        if (err.message.includes('401')) {
            googleAccessToken = null;
            alert('ההרשאה פגה. אנא נסו שנית.');
        } else {
            alert('שגיאה בהעלאה ל-Google Drive. נסו שנית.');
        }
    }
}

// ── QR Code Section ──────────────────────────────────────────────────

/**
 * Initialize the QR code section — set default base URL and attach listeners
 */
function initQRSection() {
    const qrBaseUrlInput = document.getElementById('qrBaseUrl');
    const generateQrBtn = document.getElementById('generateQrBtn');
    const downloadPhotoQr = document.getElementById('downloadPhotoQr');
    const downloadVideoQr = document.getElementById('downloadVideoQr');

    if (!qrBaseUrlInput || !generateQrBtn) return;

    // Pre-fill base URL: derive from current location, pointing to index.html
    const origin = window.location.origin   ;
    console.log('Current origin:', origin);
    const pathname = window.location.pathname;
    console.log('Current pathname:', pathname); 
    // Replace admin-panel.html (or any trailing file) with index.html
    const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    qrBaseUrlInput.value = `${origin}${basePath}capture.html`;
    console.log(qrBaseUrlInput.value);

    // Generate QR codes on button click
    generateQrBtn.addEventListener('click', () => {
        generateQRCodes();
    });

    // Download handlers
    if (downloadPhotoQr) {
        downloadPhotoQr.addEventListener('click', () => {
            downloadQR('photoQrContainer', 'qr-photo.png');
        });
    }
    if (downloadVideoQr) {
        downloadVideoQr.addEventListener('click', () => {
            downloadQR('videoQrContainer', 'qr-video.png');
        });
    }

    // Auto-generate on load
    generateQRCodes();
}

/**
 * Generate QR codes for photo and video modes
 */
function generateQRCodes() {
    const qrBaseUrlInput = document.getElementById('qrBaseUrl');
    if (!qrBaseUrlInput) return;

    const baseUrl = qrBaseUrlInput.value.trim();
    if (!baseUrl) {
        alert('אנא הזינו כתובת בסיס תקינה');
        return;
    }

    if (typeof QRCode === 'undefined') {
        console.error('❌ QRCode library not loaded');
        return;
    }

    try {
        // Photo QR
        const photoUrl = `${baseUrl}?mode=photo`;
        const photoContainer = document.getElementById('photoQrContainer');
        const photoUrlDisplay = document.getElementById('photoQrUrl');
        if (photoContainer) {
            photoContainer.innerHTML = '';
            new QRCode(photoContainer, {
                text: photoUrl,
                width: 256,
                height: 256,
                colorDark: '#6b7b5e',
                colorLight: '#ffffff'
            });
        }
        if (photoUrlDisplay) {
            photoUrlDisplay.textContent = photoUrl;
        }

        // Video QR
        const videoUrl = `${baseUrl}?mode=video`;
        const videoContainer = document.getElementById('videoQrContainer');
        const videoUrlDisplay = document.getElementById('videoQrUrl');
        if (videoContainer) {
            videoContainer.innerHTML = '';
            new QRCode(videoContainer, {
                text: videoUrl,
                width: 256,
                height: 256,
                colorDark: '#6b7b5e',
                colorLight: '#ffffff'
            });
        }
        if (videoUrlDisplay) {
            videoUrlDisplay.textContent = videoUrl;
        }

        console.log('✅ QR codes generated successfully');
    } catch (error) {
        console.error('❌ Error generating QR codes:', error);
    }
}

/**
 * Download a QR code canvas as a PNG file
 * @param {string} canvasId - The ID of the canvas element
 * @param {string} filename - The filename for the downloaded PNG
 */
function downloadQR(containerId, filename) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // qrcodejs creates a <canvas> inside the container div
    const canvas = container.querySelector('canvas');
    if (!canvas) {
        console.error('❌ No canvas found inside QR container');
        return;
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
