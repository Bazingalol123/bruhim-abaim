/**
 * Video UI Manager
 * Handles UI state management and user interactions
 */

import VideoRecorder from './video-recorder.js';
import VideoUploader from './video-uploader.js';
import {
    validateGuestName,
    getErrorMessage,
    checkBrowserSupport,
    downloadVideo,
    generateFilename
} from './video-utils.js';

class VideoUI {
    constructor() {
        this.recorder = new VideoRecorder();
        this.uploader = new VideoUploader();
        this.currentStep = 'name';
        this.guestName = '';
        this.recordedBlob = null;
        this.isUploading = false;
        
        // Check browser support
        const support = checkBrowserSupport();
        if (!support.supported) {
            this.showError('הדפדפן שלכם אינו תומך בהקלטת וידאו. אנא השתמשו בדפדפן מודרני יותר.');
            return;
        }

        this.initializeElements();
        this.attachEventListeners();
        
        // Check Firebase configuration
        if (!this.uploader.isConfigured()) {
            console.warn('⚠️ Firebase not configured. Upload functionality will be disabled.');
            console.warn('To enable uploads, configure js/config/firebase-config.js');
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

        // Name input step
        this.guestNameInput = document.getElementById('guestNameInput');
        this.startRecordingBtn = document.getElementById('startRecordingBtn');
        this.videoFileInput = document.getElementById('videoFileInput');

        // Review step
        this.videoPlayback = document.getElementById('videoPlayback');
        this.uploadVideoBtn = document.getElementById('uploadVideoBtn');
        this.downloadVideoBtn = document.getElementById('downloadVideoBtn');
        this.retakeVideoBtn = document.getElementById('retakeVideoBtn');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');

        // Success step
        this.recordAnotherBtn = document.getElementById('recordAnotherBtn');

        // Error step
        this.errorMessage = document.getElementById('errorMessage');
        this.tryAgainBtn = document.getElementById('tryAgainBtn');
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
                this.handleStartRecording();
            }
        });

        // Start recording button - trigger file input
        this.startRecordingBtn.addEventListener('click', () => {
            this.handleStartRecording();
        });

        // File input change - handle video selection
        this.videoFileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });

        // Upload video button
        this.uploadVideoBtn.addEventListener('click', () => {
            this.handleUpload();
        });

        // Download video button (optional, for offline save)
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }

        // Retake video button
        this.retakeVideoBtn.addEventListener('click', () => {
            this.handleRetake();
        });

        // Record another button
        this.recordAnotherBtn.addEventListener('click', () => {
            this.reset();
        });

        // Try again button
        this.tryAgainBtn.addEventListener('click', () => {
            this.reset();
        });
    }

    /**
     * Handle name input validation
     */
    handleNameInput() {
        const name = this.guestNameInput.value;
        this.startRecordingBtn.disabled = !validateGuestName(name);
    }

    /**
     * Handle start recording flow - trigger native camera
     */
    async handleStartRecording() {
        this.guestName = this.guestNameInput.value.trim();
        
        if (!validateGuestName(this.guestName)) {
            return;
        }

        // Trigger the file input which will open native camera
        console.log('📹 Opening native camera...');
        this.videoFileInput.click();
    }

    /**
     * Handle file selection from native camera
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
     * Handle upload video to Firebase
     */
    async handleUpload() {
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

            // Show progress bar
            this.uploadProgress.classList.remove('hidden');
            this.updateProgress(0);

            // Prepare metadata
            const metadata = {
                guestName: this.guestName,
                duration: this.recorder.getDuration()
            };

            // Upload video
            console.log('🚀 Starting upload...');
            const result = await this.uploader.uploadVideo(
                this.recordedBlob,
                metadata,
                (progress) => this.updateProgress(progress)
            );

            console.log('✅ Upload successful:', result);
            
            // Show success
            this.showSuccess();
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
     * Handle download video (offline save)
     */
    handleDownload() {
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
     * Handle retake video
     */
    handleRetake() {
        this.recordedBlob = null;
        this.showStep('name');
    }

    /**
     * Show review step with playback
     */
    showReview() {
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
     */
    updateProgress(progress) {
        const progressPercent = Math.round(progress);
        
        if (this.progressBar) {
            this.progressBar.style.width = `${progressPercent}%`;
        }
        
        if (this.progressText) {
            this.progressText.textContent = `מעלה... ${progressPercent}%`;
        }
    }

    /**
     * Show success message
     */
    showSuccess() {
        this.showStep('success');
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

        // Reset state
        this.currentStep = 'name';
        this.guestName = '';
        this.recordedBlob = null;
        this.isUploading = false;

        // Reset form
        this.guestNameInput.value = '';
        this.startRecordingBtn.disabled = true;

        // Hide progress bar
        if (this.uploadProgress) {
            this.uploadProgress.classList.add('hidden');
        }

        // Clean up video sources
        if (this.videoPlayback.src) {
            URL.revokeObjectURL(this.videoPlayback.src);
            this.videoPlayback.src = '';
        }

        // Show name input step
        this.showStep('name');
    }
}

export default VideoUI;
