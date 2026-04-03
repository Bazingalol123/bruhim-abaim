/**
 * Video UI Manager
 * Handles UI state management and user interactions for both video and image uploads
 */

import VideoRecorder from './video-recorder.js';
import VideoUploader from './video-uploader.js';
import {
    validateGuestName,
    getErrorMessage,
    checkBrowserSupport,
    downloadVideo,
    generateFilename,
    generateImageFilename
} from './video-utils.js';

class VideoUI {
    constructor() {
        this.recorder = new VideoRecorder();
        this.uploader = new VideoUploader();
        this.currentStep = 'name';
        this.guestName = '';
        this.recordedBlob = null;
        this.isUploading = false;
        this.currentMediaSource = null; // 'camera' or 'gallery'

        // Image-specific state
        this.currentMediaType = null; // 'video' | 'image'
        this.currentImageData = null; // { blob, width, height, originalSize, compressedSize }

        // Direct mode state (QR code flow)
        this.directMode = null; // 'photo' or 'video'
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        if (mode === 'photo' || mode === 'video') {
            this.directMode = mode;
        }

        // Initialize DOM elements and event listeners FIRST so that
        // showError / buttons always work regardless of browser-support outcome.
        this.initializeElements();
        this.attachEventListeners();

        // Browser support check — non-blocking warning.
        // The app uses <input type="file" capture> which does NOT require
        // getUserMedia or MediaRecorder, so we only log a warning instead of
        // blocking the entire UI.
        const support = checkBrowserSupport();
        if (!support.supported) {
            console.warn('⚠️ Browser does not support getUserMedia/MediaRecorder. Native file-input capture will still work.');
        }
        
        // Check Firebase configuration
        if (!this.uploader.isConfigured()) {
            console.warn('⚠️ Firebase not configured. Upload functionality will be disabled.');
            console.warn('To enable uploads, configure js/config/firebase-config.js');
        }

        // Activate direct mode if URL parameter is set
        if (this.directMode) {
            this.activateDirectMode();
        }
    }

    /**
     * Activate direct mode — scroll to section, hide media buttons, show continue button
     */
    activateDirectMode() {
        console.log(`🔗 Direct mode activated: ${this.directMode}`);

        // Scroll to recording section
        const section = document.getElementById('videoRecordingSection');
        if (section) {
            // Use setTimeout to ensure the page has rendered
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }

        // Hide the media buttons container
        const mediaButtonsContainer = document.querySelector('.media-buttons-container');
        if (mediaButtonsContainer) {
            mediaButtonsContainer.style.display = 'none';
        }

        // Show the direct mode continue button
        if (this.directModeContinueBtn) {
            this.directModeContinueBtn.style.display = 'flex';
            // Update icon based on mode
            const icon = this.directModeContinueBtn.querySelector('.btn-icon');
            if (icon) {
                icon.textContent = this.directMode === 'photo' ? '📸' : '🎥';
            }
        }

        // Focus on name input
        if (this.guestNameInput) {
            setTimeout(() => {
                this.guestNameInput.focus();
            }, 500);
        }
    }

    /**
     * Handle direct mode continue — validate name and trigger camera
     */
    handleDirectModeContinue() {
        this.guestName = this.guestNameInput.value.trim();

        if (!validateGuestName(this.guestName)) {
            return;
        }

        this.currentMediaSource = 'camera';

        // CRITICAL: trigger file input .click() synchronously in the user gesture handler
        // (required for iOS Safari — do NOT use async/await before .click())
        if (this.directMode === 'photo') {
            this.imageFileInput.click();
        } else if (this.directMode === 'video') {
            this.videoFileInput.click();
        }
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Steps
        this.steps = {
            name: document.getElementById('nameInputStep'),
            review: document.getElementById('reviewStep'),
            success: document.getElementById('successStep'),
            error: document.getElementById('errorStep')
        };

        // Section header
        this.sectionHeader = document.querySelector('.video-section-header');

        // Name input step
        this.guestNameInput = document.getElementById('guestNameInput');
        this.startRecordingBtn = document.getElementById('startRecordingBtn');
        this.videoFileInput = document.getElementById('videoFileInput');

        // Image input elements
        this.imageFileInput = document.getElementById('imageFileInput');
        this.startImageBtn = document.getElementById('startImageBtn');

        // Gallery input elements
        this.videoGalleryInput = document.getElementById('videoGalleryInput');
        this.imageGalleryInput = document.getElementById('imageGalleryInput');
        this.galleryImageBtn = document.getElementById('galleryImageBtn');
        this.galleryVideoBtn = document.getElementById('galleryVideoBtn');

        // Review step
        this.videoPlayback = document.getElementById('videoPlayback');
        this.imagePreview = document.getElementById('imagePreview');
        this.uploadVideoBtn = document.getElementById('uploadVideoBtn');
        this.downloadVideoBtn = document.getElementById('downloadVideoBtn');
        this.retakeVideoBtn = document.getElementById('retakeVideoBtn');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.progressStatus = null; // Will be created dynamically

        // Success step
        this.recordAnotherBtn = document.getElementById('recordAnotherBtn');
        this.successText = document.getElementById('successText');

        // Error step
        this.errorMessage = document.getElementById('errorMessage');
        this.tryAgainBtn = document.getElementById('tryAgainBtn');

        // Direct mode continue button
        this.directModeContinueBtn = document.getElementById('directModeContinueBtn');
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        // Name input validation
        this.guestNameInput.addEventListener('input', () => {
            this.handleNameInput();
        });

        this.guestNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && validateGuestName(this.guestNameInput.value)) {
                // In direct mode, use the direct mode continue flow
                if (this.directMode) {
                    this.handleDirectModeContinue();
                } else {
                    this.handleStartRecording();
                }
            }
        });

        // Direct mode continue button
        if (this.directModeContinueBtn) {
            this.directModeContinueBtn.addEventListener('click', () => {
                this.handleDirectModeContinue();
            });
        }

        // Start recording button - trigger video file input
        this.startRecordingBtn.addEventListener('click', () => {
            this.handleStartRecording();
        });

        // File input change - handle video selection
        this.videoFileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });

        // Image button - trigger image file input
        if (this.startImageBtn) {
            this.startImageBtn.addEventListener('click', () => {
                this.handleStartImageCapture();
            });
        }

        // Image file input change - handle image selection
        if (this.imageFileInput) {
            this.imageFileInput.addEventListener('change', (e) => {
                this.handleImageFileSelection(e);
            });
        }

        // Gallery buttons
        if (this.galleryImageBtn) {
            this.galleryImageBtn.addEventListener('click', () => this.handleGalleryImageSelect());
        }
        if (this.galleryVideoBtn) {
            this.galleryVideoBtn.addEventListener('click', () => this.handleGalleryVideoSelect());
        }

        // Gallery file inputs
        if (this.imageGalleryInput) {
            this.imageGalleryInput.addEventListener('change', (e) => this.handleImageFileSelection(e));
        }
        if (this.videoGalleryInput) {
            this.videoGalleryInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }

        // Upload video button (optional - only if upload UI exists)
        if (this.uploadVideoBtn) {
            this.uploadVideoBtn.addEventListener('click', () => {
                this.handleUpload();
            });
        }

        // Download video button (optional, for offline save)
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }

        // Retake video button
        if (this.retakeVideoBtn) {
            this.retakeVideoBtn.addEventListener('click', () => {
                this.handleRetake();
            });
        }

        // Record another button
        if (this.recordAnotherBtn) {
            this.recordAnotherBtn.addEventListener('click', () => {
                this.reset();
            });
        }

        // Try again button
        if (this.tryAgainBtn) {
            this.tryAgainBtn.addEventListener('click', () => {
                this.reset();
            });
        }
    }

    /**
     * Handle name input validation — enables/disables both media buttons
     */
    handleNameInput() {
        const name = this.guestNameInput.value;
        const isValid = validateGuestName(name);
        this.startRecordingBtn.disabled = !isValid;
        if (this.startImageBtn) {
            this.startImageBtn.disabled = !isValid;
        }
        if (this.galleryImageBtn) {
            this.galleryImageBtn.disabled = !isValid;
        }
        if (this.galleryVideoBtn) {
            this.galleryVideoBtn.disabled = !isValid;
        }
        // Direct mode continue button
        if (this.directModeContinueBtn) {
            this.directModeContinueBtn.disabled = !isValid;
        }
    }

    /**
     * Handle start recording flow - trigger native camera (video)
     */
    handleStartRecording() {
        this.guestName = this.guestNameInput.value.trim();
        this.currentMediaSource = 'camera';
        
        if (!validateGuestName(this.guestName)) {
            return;
        }

        // Trigger the file input which will open native camera
        console.log('📹 Opening native camera...');
        this.videoFileInput.click();
    }

    /**
     * Handle start image capture — trigger native camera/gallery (image)
     */
    handleStartImageCapture() {
        this.guestName = this.guestNameInput.value.trim();
        this.currentMediaSource = 'camera';

        if (!validateGuestName(this.guestName)) {
            return;
        }

        console.log('📸 Opening image picker...');
        this.imageFileInput.click();
    }

    /**
     * Handle gallery image selection — trigger gallery file picker (image)
     */
    handleGalleryImageSelect() {
        if (!this.validateNameInput()) return;
        this.currentMediaSource = 'gallery';
        this.imageGalleryInput.value = '';
        this.imageGalleryInput.click();
    }

    /**
     * Handle gallery video selection — trigger gallery file picker (video)
     */
    handleGalleryVideoSelect() {
        if (!this.validateNameInput()) return;
        this.currentMediaSource = 'gallery';
        this.videoGalleryInput.value = '';
        this.videoGalleryInput.click();
    }

    /**
     * Validate name input and set guestName — helper for gallery handlers
     * @returns {boolean} true if valid
     */
    validateNameInput() {
        this.guestName = this.guestNameInput.value.trim();
        return validateGuestName(this.guestName);
    }

    /**
     * Handle file selection from native camera (video)
     * @param {Event} event - File input change event
     */
    async handleFileSelection(event) {
        const file = event.target.files[0];
        
        if (!file) {
            console.log('No file selected');
            return;
        }

        try {
            console.log('📹 Processing selected video file...');
            
            // Process the video file
            const blob = await this.recorder.handleFileSelection(file);
            this.recordedBlob = blob;
            
            console.log('✅ Video file processed, blob size:', blob.size);

            // Show review step with the video
            this.showReview();
        } catch (error) {
            console.error('❌ Error processing video file:', error);
            this.showError(getErrorMessage(error));
        } finally {
            // Reset file input so the same file can be selected again
            event.target.value = '';
        }
    }

    /**
     * Handle image file selection from native camera/gallery
     * @param {Event} event - File input change event
     */
    async handleImageFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.currentMediaType = 'image';
            console.log('📸 Processing selected image file...');

            // Use VideoRecorder's handleImageSelection (Phase 5a)
            const imageData = await this.recorder.handleImageSelection(file);
            this.currentImageData = imageData;

            console.log('✅ Image processed, blob size:', imageData.blob.size);
            this.showImageReview(imageData);
        } catch (error) {
            console.error('❌ Error processing image file:', error);
            this.currentMediaType = null;
            this.showError(getErrorMessage(error));
        }

        // Reset file input for re-selection
        event.target.value = '';
    }

    /**
     * Show image review step
     * @param {Object} imageData - { blob, width, height, originalSize, compressedSize }
     */
    showImageReview(imageData) {
        this.currentMediaType = 'image';

        // Hide video preview, show image preview
        if (this.videoPlayback) {
            this.videoPlayback.classList.add('hidden');
            this.videoPlayback.pause();
        }
        if (this.imagePreview) {
            this.imagePreview.classList.remove('hidden');
            this.imagePreview.src = URL.createObjectURL(imageData.blob);
        }

        // Update button text for image context
        if (this.uploadVideoBtn) {
            this.uploadVideoBtn.textContent = 'העלו את התמונה 💚';
        }
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.textContent = 'הורידו את התמונה 💚';
        }
        if (this.retakeVideoBtn) {
            this.retakeVideoBtn.textContent = 'צלמו שוב 📸';
        }

        this.showStep('review');
    }

    /**
     * Handle upload media to Firebase (video or image)
     */
    async handleUpload() {
        // Check what media type we're uploading
        if (this.currentMediaType === 'image') {
            await this.handleImageUpload();
        } else {
            await this.handleVideoUpload();
        }
    }

    /**
     * Handle upload video to Firebase
     */
    async handleVideoUpload() {
        if (!this.recordedBlob) {
            console.error('No recorded video available');
            return;
        }

        // Check if Firebase is configured
        if (!this.uploader.isConfigured()) {
            this.showError('Firebase לא מוגדר. אנא הגדירו את firebase-config.js כדי להפעיל העלאת וידאו.\n\nלעת עתה, תוכלו להוריד את הוידאו למכשיר שלכם.');
            return;
        }

        try {
            this.isUploading = true;
            
            // Disable buttons during upload
            this.uploadVideoBtn.disabled = true;
            this.retakeVideoBtn.disabled = true;
            if (this.downloadVideoBtn) {
                this.downloadVideoBtn.disabled = true;
            }

            // Show progress bar with initial status
            this.uploadProgress.style.display = 'block';
            this.uploadProgress.classList.remove('hidden');
            this.updateProgress(0, 'מתחיל העלאה...');

            // Prepare metadata
            const metadata = {
                guestName: this.guestName,
                duration: this.recorder.getDuration()
            };

            // Upload video
            console.log('🚀 Starting video upload...');
            const result = await this.uploader.uploadVideo(
                this.recordedBlob,
                metadata,
                (progress) => {
                    let status = 'מעלה את הוידאו...';
                    if (progress < 25) {
                        status = 'מתחיל העלאה...';
                    } else if (progress < 50) {
                        status = 'מעלה את הוידאו...';
                    } else if (progress < 75) {
                        status = 'כמעט מסיימים...';
                    } else if (progress < 100) {
                        status = 'משלים העלאה...';
                    } else if (progress >= 100) {
                        status = 'שומר פרטים...';
                    }
                    this.updateProgress(progress, status);
                }
            );

            console.log('✅ Upload result:', result);
            
            // Check if upload was fully successful or partial
            if (result.partialSuccess) {
                // Storage succeeded but Firestore failed
                console.warn('⚠️ Partial success - video uploaded but metadata not saved');
                this.updateProgress(100, 'הוידאו הועלה בהצלחה! ✅');
                
                // Wait a moment before showing success
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Show success with a note
                this.showSuccess(true);
            } else {
                // Full success
                this.updateProgress(100, 'העלאה הושלמה! 🎉');
                
                // Wait a moment before showing success
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Show success
                this.showSuccess();
            }
        } catch (error) {
            console.error('❌ Upload error:', error);
            
            // Show error message
            const errorMessage = error.message || 'שגיאה בהעלאת הוידאו. אנא בדקו את החיבור לאינטרנט ונסו שוב.';
            this.showError(errorMessage);
        } finally {
            this.isUploading = false;
            
            // Re-enable buttons
            this.uploadVideoBtn.disabled = false;
            this.retakeVideoBtn.disabled = false;
            if (this.downloadVideoBtn) {
                this.downloadVideoBtn.disabled = false;
            }
        }
    }

    /**
     * Handle upload image to Firebase
     */
    async handleImageUpload() {
        if (!this.currentImageData || !this.currentImageData.blob) {
            console.error('No image data available');
            return;
        }

        // Check if Firebase is configured
        if (!this.uploader.isConfigured()) {
            this.showError('Firebase לא מוגדר. אנא הגדירו את firebase-config.js כדי להפעיל העלאת תמונות.\n\nלעת עתה, תוכלו להוריד את התמונה למכשיר שלכם.');
            return;
        }

        try {
            this.isUploading = true;

            // Disable buttons during upload
            this.uploadVideoBtn.disabled = true;
            this.retakeVideoBtn.disabled = true;
            if (this.downloadVideoBtn) {
                this.downloadVideoBtn.disabled = true;
            }

            // Show progress bar with initial status
            this.uploadProgress.style.display = 'block';
            this.uploadProgress.classList.remove('hidden');
            this.updateProgress(0, 'מעבד את התמונה...');

            // Prepare metadata
            const metadata = {
                guestName: this.guestName,
                width: this.currentImageData.width,
                height: this.currentImageData.height,
                originalFileSize: this.currentImageData.originalSize
            };

            // Upload image
            console.log('🚀 Starting image upload...');
            const result = await this.uploader.uploadImage(
                this.currentImageData.blob,
                metadata,
                (progress) => {
                    let status = 'מעלה את התמונה...';
                    if (progress < 25) {
                        status = 'מעבד את התמונה...';
                    } else if (progress < 50) {
                        status = 'מעלה את התמונה...';
                    } else if (progress < 75) {
                        status = 'כמעט שם...';
                    } else if (progress < 100) {
                        status = 'משלים העלאה...';
                    } else if (progress >= 100) {
                        status = 'שומר פרטים...';
                    }
                    this.updateProgress(progress, status);
                }
            );

            console.log('✅ Image upload result:', result);

            if (result.partialSuccess) {
                console.warn('⚠️ Partial success - image uploaded but metadata not saved');
                this.updateProgress(100, 'התמונה הועלתה בהצלחה! ✅');
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.showSuccess(true);
            } else {
                this.updateProgress(100, 'העלאה הושלמה! 🎉');
                await new Promise(resolve => setTimeout(resolve, 800));
                this.showSuccess();
            }
        } catch (error) {
            console.error('❌ Image upload error:', error);
            const errorMsg = error.message || 'שגיאה בהעלאת התמונה. אנא בדקו את החיבור לאינטרנט ונסו שוב.';
            this.showError(errorMsg);
        } finally {
            this.isUploading = false;

            // Re-enable buttons
            this.uploadVideoBtn.disabled = false;
            this.retakeVideoBtn.disabled = false;
            if (this.downloadVideoBtn) {
                this.downloadVideoBtn.disabled = false;
            }
        }
    }

    /**
     * Handle download (video or image)
     */
    handleDownload() {
        if (this.currentMediaType === 'image') {
            this.handleImageDownload();
        } else {
            this.handleVideoDownload();
        }
    }

    /**
     * Handle download video (offline save)
     */
    handleVideoDownload() {
        if (!this.recordedBlob) {
            console.error('No recorded video available');
            return;
        }

        try {
            const filename = generateFilename(this.guestName);
            downloadVideo(this.recordedBlob, filename);
            console.log('✅ Video downloaded successfully');
        } catch (error) {
            console.error('Error downloading video:', error);
            this.showError('שגיאה בהורדת הוידאו. אנא נסו שוב.');
        }
    }

    /**
     * Handle download image (offline save)
     */
    handleImageDownload() {
        if (!this.currentImageData || !this.currentImageData.blob) {
            console.error('No image data available');
            return;
        }

        try {
            const filename = generateImageFilename(this.guestName);
            // Reuse the downloadVideo utility — it works for any blob
            downloadVideo(this.currentImageData.blob, filename);
            console.log('✅ Image downloaded successfully');
        } catch (error) {
            console.error('Error downloading image:', error);
            this.showError('שגיאה בהורדת התמונה. אנא נסו שוב.');
        }
    }

    /**
     * Handle retake — go back to name step (or re-trigger camera in direct mode)
     */
    handleRetake() {
        // Clean up image blob URL to prevent memory leaks
        if (this.imagePreview && this.imagePreview.src) {
            URL.revokeObjectURL(this.imagePreview.src);
            this.imagePreview.src = '';
        }

        // Reset media-specific state
        this.currentMediaType = null;
        this.currentImageData = null;
        this.recordedBlob = null;
        this.currentMediaSource = null;

        // In direct mode, go back to name step but keep direct mode UI
        if (this.directMode) {
            this.showStep('name');
            // Re-activate direct mode UI (hide media buttons, show continue)
            this.activateDirectMode();
            return;
        }

        this.showStep('name');
    }

    /**
     * Show review step with video playback
     */
    showReview() {
        this.currentMediaType = 'video';

        // Show video preview, hide image preview
        if (this.videoPlayback) {
            this.videoPlayback.classList.remove('hidden');
        }
        if (this.imagePreview) {
            // Clean up any previous image blob URL
            if (this.imagePreview.src) {
                URL.revokeObjectURL(this.imagePreview.src);
            }
            this.imagePreview.classList.add('hidden');
            this.imagePreview.src = '';
        }

        // Update button text for video context
        if (this.uploadVideoBtn) {
            this.uploadVideoBtn.textContent = 'העלו את הסרטון 💚';
        }
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.textContent = 'הורידו את הסרטון 💚';
        }
        if (this.retakeVideoBtn) {
            this.retakeVideoBtn.textContent = 'צלמו שוב 🎥';
        }

        this.showStep('review');

        if (this.recordedBlob) {
            const url = URL.createObjectURL(this.recordedBlob);
            this.videoPlayback.src = url;
            
            // Clean up old object URL when video loads
            this.videoPlayback.onloadedmetadata = () => {
                // Revoke old URL after some time
                setTimeout(() => {
                    if (this.videoPlayback.src !== url) {
                        URL.revokeObjectURL(url);
                    }
                }, 1000);
            };
        }
    }

    /**
     * Update upload progress bar and text
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} status - Status message to display
     */
    updateProgress(progress, status = '') {
        const progressPercent = Math.round(progress);
        
        if (this.progressBar) {
            this.progressBar.style.width = `${progressPercent}%`;
        }
        
        if (this.progressText) {
            this.progressText.textContent = `${progressPercent}%`;
        }
        
        // Create or update status element
        if (!this.progressStatus) {
            this.progressStatus = document.createElement('span');
            this.progressStatus.className = 'progress-status';
            this.uploadProgress.appendChild(this.progressStatus);
        }
        
        if (this.progressStatus && status) {
            this.progressStatus.textContent = status;
        }
    }

    /**
     * Show success message — media-type-aware
     * @param {boolean} partialSuccess - Whether it was a partial success (storage only)
     */
    showSuccess(partialSuccess = false) {
        if (partialSuccess) {
            console.log('ℹ️ Showing success with partial upload note');
        }

        // Update success text based on media type
        if (this.successText) {
            if (this.currentMediaType === 'image') {
                this.successText.textContent = 'התמונה שלכם נשלחה בהצלחה 💚';
            } else {
                this.successText.textContent = 'הסרטון שלכם נשלח בהצלחה 💚';
            }
        }

        this.showStep('success');
        
        // Hide section header when showing success
        if (this.sectionHeader) {
            this.sectionHeader.classList.add('hidden');
        }
        
        // Hide upload progress
        if (this.uploadProgress) {
            setTimeout(() => {
                this.uploadProgress.classList.add('hidden');
            }, 500);
        }
    }

    /**
     * Navigate to specific step
     * @param {string} step - Step name (name, review, success, error)
     */
    showStep(step) {
        // Hide all steps
        Object.values(this.steps).forEach(stepEl => {
            if (stepEl) {
                stepEl.classList.add('hidden');
            }
        });

        // Show requested step
        if (this.steps[step]) {
            this.steps[step].classList.remove('hidden');
            this.currentStep = step;
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.errorMessage.textContent = message;
        this.showStep('error');
        this.recorder.cleanup();
    }

    /**
     * Reset to initial state
     */
    reset() {
        // Cancel any ongoing upload
        if (this.isUploading) {
            this.uploader.cancelUpload();
        }

        // Clean up recorder
        this.recorder.cleanup();

        // Clean up image blob URL
        if (this.imagePreview && this.imagePreview.src) {
            URL.revokeObjectURL(this.imagePreview.src);
            this.imagePreview.src = '';
            this.imagePreview.classList.add('hidden');
        }

        // Reset state
        this.currentStep = 'name';
        this.guestName = '';
        this.recordedBlob = null;
        this.isUploading = false;
        this.currentMediaType = null;
        this.currentImageData = null;
        this.currentMediaSource = null;

        // Reset gallery file inputs
        if (this.videoGalleryInput) this.videoGalleryInput.value = '';
        if (this.imageGalleryInput) this.imageGalleryInput.value = '';

        // Reset form
        this.guestNameInput.value = '';
        this.startRecordingBtn.disabled = true;
        if (this.startImageBtn) {
            this.startImageBtn.disabled = true;
        }
        if (this.galleryImageBtn) {
            this.galleryImageBtn.disabled = true;
        }
        if (this.galleryVideoBtn) {
            this.galleryVideoBtn.disabled = true;
        }
        if (this.directModeContinueBtn) {
            this.directModeContinueBtn.disabled = true;
        }

        // Hide progress bar
        if (this.uploadProgress) {
            this.uploadProgress.classList.add('hidden');
        }

        // Show section header again
        if (this.sectionHeader) {
            this.sectionHeader.classList.remove('hidden');
        }

        // Clean up video sources
        if (this.videoPlayback) {
            if (this.videoPlayback.src) {
                URL.revokeObjectURL(this.videoPlayback.src);
                this.videoPlayback.src = '';
            }
            this.videoPlayback.classList.remove('hidden');
        }

        // Show name input step
        this.showStep('name');

        // Re-activate direct mode if applicable
        if (this.directMode) {
            this.activateDirectMode();
        }
    }
}

export default VideoUI;
