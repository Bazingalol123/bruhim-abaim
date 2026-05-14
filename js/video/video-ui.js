/**
 * Video UI Manager
 * Handles UI state management and user interactions for both video and image uploads
 */

import VideoRecorder from './video-recorder.js';
import VideoUploader from './video-uploader.js';
import {
    getErrorMessage,
    checkBrowserSupport,
    downloadVideo,
    generateFilename,
    generateImageFilename
} from './video-utils.js';

const STORAGE_KEY_GUEST_NAME = 'wedding_guest_name_v1';

class VideoUI {
    constructor() {
        this.recorder = new VideoRecorder();
        this.uploader = new VideoUploader();
        this.currentStep = 'media';
        this.guestName = '';
        this.recordedBlob = null;
        this.isUploading = false;
        this.currentMediaSource = null;

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

        // Initialize DOM elements FIRST so that showError / buttons always work.
        this.initializeElements();

        // Restore saved guest name from localStorage (Change 3)
        try {
            const savedName = localStorage.getItem(STORAGE_KEY_GUEST_NAME);
            if (savedName && this.guestNameInput) {
                this.guestNameInput.value = savedName;
                this.guestName = savedName;
                if (this.changeNameBtn) {
                    this.changeNameBtn.style.display = 'inline-block';
                    this.changeNameBtn.textContent = `לא ${savedName}? לחצו כאן לשינוי`;
                }
            }
        } catch (e) {
            console.warn('localStorage unavailable, name will not persist:', e);
        }

        this.attachEventListeners();

        // Browser support check — non-blocking warning.
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
     * Activate direct mode — scroll to section, hide regular button, show one-tap continue button
     */
    activateDirectMode() {
        console.log(`🔗 Direct mode activated: ${this.directMode}`);

        const section = document.getElementById('videoRecordingSection');
        if (section) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }

        // Hide regular media button, show continue button
        if (this.startMediaBtn) {
            this.startMediaBtn.style.display = 'none';
        }

        if (this.directModeContinueBtn) {
            this.directModeContinueBtn.style.display = 'flex';
            this.directModeContinueBtn.disabled = false;
            const icon = this.directModeContinueBtn.querySelector('.btn-icon');
            if (icon) {
                icon.textContent = this.directMode === 'photo' ? '📸' : '🎥';
            }
            const text = this.directModeContinueBtn.querySelector('.btn-text');
            if (text) {
                text.textContent = 'התחילו';
            }
        }
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Steps
        this.steps = {
            media: document.getElementById('mediaInputStep'),
            review: document.getElementById('reviewStep'),
            success: document.getElementById('successStep'),
            error: document.getElementById('errorStep')
        };

        // Section header
        this.sectionHeader = document.querySelector('.video-section-header');

        // Media input step
        this.startMediaBtn = document.getElementById('startMediaBtn');
        this.mediaFileInput = document.getElementById('mediaFileInput');

        // Guest name input (now on review screen)
        this.guestNameInput = document.getElementById('guestNameInput');
        this.changeNameBtn = document.getElementById('changeNameBtn');

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
        this.reviewInlineError = document.getElementById('reviewInlineError');
        this.reviewInlineErrorText = document.getElementById('reviewInlineErrorText');

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
        // Single media button — trigger native picker
        // CRITICAL: synchronous .click() inside user gesture for iOS Safari
        if (this.startMediaBtn) {
            this.startMediaBtn.addEventListener('click', () => {
                this.mediaFileInput.click();
            });
        }

        // Handle media file selection (image OR video)
        if (this.mediaFileInput) {
            this.mediaFileInput.addEventListener('change', (event) => {
                this.handleMediaFileSelected(event);
            });
        }

        // Direct mode continue button — one tap triggers picker (satisfies iOS gesture requirement)
        if (this.directModeContinueBtn) {
            this.directModeContinueBtn.addEventListener('click', () => {
                this.mediaFileInput.click();
            });
        }

        // Change name button — clears field and removes persisted name
        if (this.changeNameBtn) {
            this.changeNameBtn.addEventListener('click', () => {
                this.guestNameInput.value = '';
                this.guestNameInput.focus();
                this.changeNameBtn.style.display = 'none';
                try { localStorage.removeItem(STORAGE_KEY_GUEST_NAME); } catch (e) {}
            });
        }

        // Upload button
        if (this.uploadVideoBtn) {
            this.uploadVideoBtn.addEventListener('click', () => {
                this.handleUpload();
            });
        }

        // Download button
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }

        // Retake button
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
     * Detect image vs video from a picked file and dispatch to appropriate handler
     */
    handleMediaFileSelected(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const mimeType = file.type || '';
        let isVideo = mimeType.startsWith('video/');
        let isImage = mimeType.startsWith('image/');

        // Fallback: some Android browsers / Files picker may omit MIME type
        if (!isVideo && !isImage) {
            const name = (file.name || '').toLowerCase();
            const videoExts = ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.avi', '.mkv'];
            const imageExts = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.gif'];
            isVideo = videoExts.some(ext => name.endsWith(ext));
            isImage = imageExts.some(ext => name.endsWith(ext));
        }

        if (isVideo) {
            this.handleFileSelection({ target: { files: [file], value: '' } });
        } else if (isImage) {
            this.handleImageFileSelection({ target: { files: [file], value: '' } });
        } else {
            this.showError('סוג הקובץ לא נתמך. אנא בחרו תמונה או סרטון.');
        }

        // Reset so the same file can be picked again
        event.target.value = '';
    }

    /**
     * Handle file selection — video
     * @param {Event} event - File input change event (real or synthetic)
     */
    async handleFileSelection(event) {
        const file = event.target.files[0];

        if (!file) {
            console.log('No file selected');
            return;
        }

        try {
            console.log('📹 Processing selected video file...');
            const blob = await this.recorder.handleFileSelection(file);
            this.recordedBlob = blob;
            console.log('✅ Video file processed, blob size:', blob.size);
            this.showReview();
        } catch (error) {
            console.error('❌ Error processing video file:', error);
            this.showError(getErrorMessage(error));
        } finally {
            event.target.value = '';
        }
    }

    /**
     * Handle image file selection
     * @param {Event} event - File input change event (real or synthetic)
     */
    async handleImageFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.currentMediaType = 'image';
            console.log('📸 Processing selected image file...');
            const imageData = await this.recorder.handleImageSelection(file);
            this.currentImageData = imageData;
            console.log('✅ Image processed, blob size:', imageData.blob.size);
            this.showImageReview(imageData);
        } catch (error) {
            console.error('❌ Error processing image file:', error);
            this.currentMediaType = null;
            this.showError(getErrorMessage(error));
        }

        event.target.value = '';
    }

    /**
     * Show image review step
     * @param {Object} imageData - { blob, width, height, originalSize, compressedSize }
     */
    showImageReview(imageData) {
        this.currentMediaType = 'image';

        if (this.videoPlayback) {
            this.videoPlayback.classList.add('hidden');
            this.videoPlayback.pause();
        }
        if (this.imagePreview) {
            this.imagePreview.classList.remove('hidden');
            this.imagePreview.src = URL.createObjectURL(imageData.blob);
        }

        if (this.uploadVideoBtn) {
            this.uploadVideoBtn.textContent = 'העלו את התמונה 💚';
        }
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.textContent = '💾 שמרו אצלכם';
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

        if (!this.uploader.isConfigured()) {
            this.showError('Firebase לא מוגדר. אנא הגדירו את firebase-config.js כדי להפעיל העלאת וידאו.\n\nלעת עתה, תוכלו להוריד את הוידאו למכשיר שלכם.');
            return;
        }

        // Read name at moment of upload (not at page load)
        const rawName = this.guestNameInput.value.trim();
        this.guestName = rawName || 'אורח/ת אנונימי/ת';

        this.hideReviewError();

        try {
            this.isUploading = true;

            this.uploadVideoBtn.disabled = true;
            this.retakeVideoBtn.disabled = true;
            if (this.downloadVideoBtn) {
                this.downloadVideoBtn.disabled = true;
            }

            this.uploadProgress.style.display = 'block';
            this.uploadProgress.classList.remove('hidden');
            this.updateProgress(0, 'מתחיל העלאה...');

            const metadata = {
                guestName: this.guestName,
                duration: this.recorder.getDuration()
            };

            console.log('🚀 Starting video upload...');
            const result = await this.uploader.uploadWithRetry(
                () => this.uploader.uploadVideo(
                    this.recordedBlob,
                    metadata,
                    (progress) => {
                        let status = 'מעלה את הוידאו...';
                        if (progress < 25) status = 'מתחיל העלאה...';
                        else if (progress < 50) status = 'מעלה את הוידאו...';
                        else if (progress < 75) status = 'כמעט מסיימים...';
                        else if (progress < 100) status = 'משלים העלאה...';
                        else status = 'שומר פרטים...';
                        this.updateProgress(progress, status);
                    }
                )
            );

            console.log('✅ Upload result:', result);

            // Persist name after confirmed upload
            try {
                if (rawName) {
                    localStorage.setItem(STORAGE_KEY_GUEST_NAME, rawName);
                    if (this.changeNameBtn) {
                        this.changeNameBtn.style.display = 'inline-block';
                        this.changeNameBtn.textContent = `לא ${rawName}? לחצו כאן לשינוי`;
                    }
                }
            } catch (e) {
                console.warn('Could not persist guest name:', e);
            }

            if (result.partialSuccess) {
                console.warn('⚠️ Partial success - video uploaded but metadata not saved');
                this.updateProgress(100, 'הוידאו הועלה בהצלחה! ✅');
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.showSuccess(true);
            } else {
                this.updateProgress(100, 'העלאה הושלמה! 🎉');
                await new Promise(resolve => setTimeout(resolve, 800));
                this.showSuccess();
            }
        } catch (error) {
            console.error('❌ Upload error:', error);
            const errorMessage = error.message || 'שגיאה בהעלאת הוידאו. אנא בדקו את החיבור לאינטרנט ונסו שוב.';
            this.showReviewError(errorMessage);
        } finally {
            this.isUploading = false;
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

        if (!this.uploader.isConfigured()) {
            this.showError('Firebase לא מוגדר. אנא הגדירו את firebase-config.js כדי להפעיל העלאת תמונות.\n\nלעת עתה, תוכלו להוריד את התמונה למכשיר שלכם.');
            return;
        }

        // Read name at moment of upload (not at page load)
        const rawName = this.guestNameInput.value.trim();
        this.guestName = rawName || 'אורח/ת אנונימי/ת';

        this.hideReviewError();

        try {
            this.isUploading = true;

            this.uploadVideoBtn.disabled = true;
            this.retakeVideoBtn.disabled = true;
            if (this.downloadVideoBtn) {
                this.downloadVideoBtn.disabled = true;
            }

            this.uploadProgress.style.display = 'block';
            this.uploadProgress.classList.remove('hidden');
            this.updateProgress(0, 'מעבד את התמונה...');

            const metadata = {
                guestName: this.guestName,
                width: this.currentImageData.width,
                height: this.currentImageData.height,
                originalFileSize: this.currentImageData.originalSize
            };

            console.log('🚀 Starting image upload...');
            const result = await this.uploader.uploadWithRetry(
                () => this.uploader.uploadImage(
                    this.currentImageData.blob,
                    metadata,
                    (progress) => {
                        let status = 'מעלה את התמונה...';
                        if (progress < 25) status = 'מעבד את התמונה...';
                        else if (progress < 50) status = 'מעלה את התמונה...';
                        else if (progress < 75) status = 'כמעט שם...';
                        else if (progress < 100) status = 'משלים העלאה...';
                        else status = 'שומר פרטים...';
                        this.updateProgress(progress, status);
                    }
                )
            );

            console.log('✅ Image upload result:', result);

            // Persist name after confirmed upload
            try {
                if (rawName) {
                    localStorage.setItem(STORAGE_KEY_GUEST_NAME, rawName);
                    if (this.changeNameBtn) {
                        this.changeNameBtn.style.display = 'inline-block';
                        this.changeNameBtn.textContent = `לא ${rawName}? לחצו כאן לשינוי`;
                    }
                }
            } catch (e) {
                console.warn('Could not persist guest name:', e);
            }

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
            this.showReviewError(errorMsg);
        } finally {
            this.isUploading = false;
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

    handleImageDownload() {
        if (!this.currentImageData || !this.currentImageData.blob) {
            console.error('No image data available');
            return;
        }
        try {
            const filename = generateImageFilename(this.guestName);
            downloadVideo(this.currentImageData.blob, filename);
            console.log('✅ Image downloaded successfully');
        } catch (error) {
            console.error('Error downloading image:', error);
            this.showError('שגיאה בהורדת התמונה. אנא נסו שוב.');
        }
    }

    /**
     * Handle retake — go back to media selection step (blob is discarded)
     */
    handleRetake() {
        if (this.imagePreview && this.imagePreview.src) {
            URL.revokeObjectURL(this.imagePreview.src);
            this.imagePreview.src = '';
        }

        this.currentMediaType = null;
        this.currentImageData = null;
        this.recordedBlob = null;
        this.currentMediaSource = null;

        this.showStep('media');

        if (this.directMode) {
            this.activateDirectMode();
        }
    }

    /**
     * Show review step with video playback
     */
    showReview() {
        this.currentMediaType = 'video';

        if (this.videoPlayback) {
            this.videoPlayback.classList.remove('hidden');
        }
        if (this.imagePreview) {
            if (this.imagePreview.src) {
                URL.revokeObjectURL(this.imagePreview.src);
            }
            this.imagePreview.classList.add('hidden');
            this.imagePreview.src = '';
        }

        if (this.uploadVideoBtn) {
            this.uploadVideoBtn.textContent = 'העלו את הסרטון 💚';
        }
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.textContent = '💾 שמרו אצלכם';
        }
        if (this.retakeVideoBtn) {
            this.retakeVideoBtn.textContent = 'צלמו שוב 🎥';
        }

        this.showStep('review');

        if (this.recordedBlob) {
            const url = URL.createObjectURL(this.recordedBlob);
            this.videoPlayback.src = url;
            this.videoPlayback.onloadedmetadata = () => {
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

        if (this.successText) {
            if (this.currentMediaType === 'image') {
                this.successText.textContent = 'התמונה שלכם נשלחה בהצלחה 💚';
            } else {
                this.successText.textContent = 'הסרטון שלכם נשלח בהצלחה 💚';
            }
        }

        this.showStep('success');

        if (this.sectionHeader) {
            this.sectionHeader.classList.add('hidden');
        }
        if (this.uploadProgress) {
            setTimeout(() => {
                this.uploadProgress.classList.add('hidden');
            }, 500);
        }
    }

    /**
     * Show inline error on review screen — blob is preserved, user can retry
     * @param {string} message
     */
    showReviewError(message) {
        if (this.reviewInlineErrorText) {
            this.reviewInlineErrorText.textContent = message;
        }
        if (this.reviewInlineError) {
            this.reviewInlineError.classList.remove('hidden');
        }
        // Re-enable buttons so user can retry or save locally
        if (this.uploadVideoBtn) this.uploadVideoBtn.disabled = false;
        if (this.retakeVideoBtn) this.retakeVideoBtn.disabled = false;
        if (this.downloadVideoBtn) this.downloadVideoBtn.disabled = false;
        if (this.uploadProgress) {
            this.uploadProgress.classList.add('hidden');
        }
    }

    hideReviewError() {
        if (this.reviewInlineError) {
            this.reviewInlineError.classList.add('hidden');
        }
    }

    /**
     * Navigate to specific step
     * @param {string} step - Step name (media, review, success, error)
     */
    showStep(step) {
        Object.values(this.steps).forEach(stepEl => {
            if (stepEl) {
                stepEl.classList.add('hidden');
            }
        });
        if (this.steps[step]) {
            this.steps[step].classList.remove('hidden');
            this.currentStep = step;
        }
    }

    /**
     * Show terminal error message (Firebase not configured, blob corrupted, etc.)
     * @param {string} message - Error message
     */
    showError(message) {
        this.errorMessage.textContent = message;
        this.showStep('error');
        this.recorder.cleanup();
    }

    /**
     * Reset to initial state (name persists across uploads)
     */
    reset() {
        if (this.isUploading) {
            this.uploader.cancelUpload();
        }

        this.recorder.cleanup();

        if (this.imagePreview && this.imagePreview.src) {
            URL.revokeObjectURL(this.imagePreview.src);
            this.imagePreview.src = '';
            this.imagePreview.classList.add('hidden');
        }

        this.currentStep = 'media';
        this.guestName = '';
        this.recordedBlob = null;
        this.isUploading = false;
        this.currentMediaType = null;
        this.currentImageData = null;
        this.currentMediaSource = null;

        if (this.uploadProgress) {
            this.uploadProgress.classList.add('hidden');
        }
        if (this.sectionHeader) {
            this.sectionHeader.classList.remove('hidden');
        }
        if (this.videoPlayback) {
            if (this.videoPlayback.src) {
                URL.revokeObjectURL(this.videoPlayback.src);
                this.videoPlayback.src = '';
            }
            this.videoPlayback.classList.remove('hidden');
        }

        this.hideReviewError();

        this.showStep('media');

        if (this.directMode) {
            this.activateDirectMode();
        }
    }
}

export default VideoUI;
