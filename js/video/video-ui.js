/**
 * Video UI Manager
 * Handles UI state management and user interactions
 */

import VideoRecorder from './video-recorder.js';
import VideoUploader from './video-uploader.js';
import {
    formatTime,
    validateGuestName,
    getErrorMessage,
    checkBrowserSupport,
    downloadVideo,
    generateFilename,
    runPreflightChecks,
    logDiagnostics
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
            recording: document.getElementById('recordingStep'),
            review: document.getElementById('reviewStep'),
            success: document.getElementById('successStep'),
            error: document.getElementById('errorStep')
        };

        // Name input step
        this.guestNameInput = document.getElementById('guestNameInput');
        this.startRecordingBtn = document.getElementById('startRecordingBtn');

        // Recording step
        this.videoPreview = document.getElementById('videoPreview');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.recordingTime = document.getElementById('recordingTime');
        this.toggleRecordBtn = document.getElementById('toggleRecordBtn');
        this.stopRecordBtn = document.getElementById('stopRecordBtn');
        this.cancelRecordBtn = document.getElementById('cancelRecordBtn');
        this.permissionsError = document.getElementById('permissionsError');
        this.testPermissionsBtn = document.getElementById('testPermissionsBtn');

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

        // Start recording button
        this.startRecordingBtn.addEventListener('click', () => {
            this.handleStartRecording();
        });

        // Toggle record button (start recording)
        this.toggleRecordBtn.addEventListener('click', () => {
            this.handleToggleRecording();
        });

        // Stop recording button
        this.stopRecordBtn.addEventListener('click', () => {
            this.handleStopRecording();
        });

        // Cancel recording button
        this.cancelRecordBtn.addEventListener('click', () => {
            this.handleCancel();
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
        
        // Test permissions button
        this.testPermissionsBtn.addEventListener('click', () => {
            this.handleTestPermissions();
        });
    }
    
    /**
     * Handle test permissions - retry camera access
     */
    async handleTestPermissions() {
        console.log('🔄 Retrying camera access...');
        this.permissionsError.classList.add('hidden');
        
        try {
            // Request camera and microphone access again
            const stream = await this.recorder.initializeMedia();
            
            // Show video preview
            this.videoPreview.srcObject = stream;
            await this.videoPreview.play();

            console.log('✅ Camera access granted on retry');
        } catch (error) {
            console.error('❌ Camera access still denied:', error);
            
            // Show detailed error message
            const errorMessage = getErrorMessage(error);
            this.showPermissionsError(errorMessage);
            
            // Log diagnostics for debugging
            await logDiagnostics(error);
        }
    }

    /**
     * Handle name input validation
     */
    handleNameInput() {
        const name = this.guestNameInput.value;
        this.startRecordingBtn.disabled = !validateGuestName(name);
    }

    /**
     * Handle start recording flow
     */
    async handleStartRecording() {
        this.guestName = this.guestNameInput.value.trim();
        
        if (!validateGuestName(this.guestName)) {
            return;
        }

        // Show recording step
        this.showStep('recording');
        this.permissionsError.classList.add('hidden');

        try {
            // Run pre-flight checks
            console.log('🔍 Running pre-flight checks...');
            const preflightResults = await runPreflightChecks();
            
            if (!preflightResults.passed) {
                console.error('❌ Pre-flight checks failed:', preflightResults.errors);
                throw new Error(preflightResults.errors.join('\n'));
            }
            
            if (preflightResults.warnings.length > 0) {
                console.warn('⚠️ Pre-flight warnings:', preflightResults.warnings);
            }

            // Request camera and microphone access
            console.log('📹 Requesting camera access...');
            const stream = await this.recorder.initializeMedia();
            
            // Show video preview
            this.videoPreview.srcObject = stream;
            await this.videoPreview.play();

            console.log('✅ Camera initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing camera:', error);
            
            // Show detailed error message
            const errorMessage = getErrorMessage(error);
            this.showPermissionsError(errorMessage);
            
            // Log diagnostics for debugging
            await logDiagnostics(error);
        }
    }
    
    /**
     * Show permissions error with formatted message
     * @param {string} message - Error message (may contain newlines)
     */
    showPermissionsError(message) {
        this.permissionsError.classList.remove('hidden');
        
        // Format message with line breaks
        const paragraphElement = this.permissionsError.querySelector('p');
        paragraphElement.innerHTML = message.split('\n').map(line =>
            line.trim() ? `<span style="display: block; margin: 0.5em 0;">${line}</span>` : ''
        ).join('');
    }

    /**
     * Handle toggle recording (start)
     */
    async handleToggleRecording() {
        try {
            await this.recorder.startRecording(
                null,
                (duration) => this.updateRecordingTimer(duration)
            );

            // Update UI
            this.toggleRecordBtn.classList.add('hidden');
            this.stopRecordBtn.classList.remove('hidden');
            this.recordingIndicator.classList.remove('hidden');
            this.cancelRecordBtn.disabled = true;

            console.log('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError(getErrorMessage(error));
        }
    }

    /**
     * Handle stop recording
     */
    async handleStopRecording() {
        try {
            this.recordedBlob = await this.recorder.stopRecording();
            
            console.log('Recording stopped, blob size:', this.recordedBlob.size);

            // Clean up camera
            this.recorder.cleanup();

            // Show review step
            this.showReview();
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showError(getErrorMessage(error));
        }
    }

    /**
     * Handle cancel recording
     */
    handleCancel() {
        this.recorder.cleanup();
        this.showStep('name');
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
     * Update recording timer display
     * @param {number} duration - Duration in seconds
     */
    updateRecordingTimer(duration) {
        this.recordingTime.textContent = formatTime(duration);
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
     * @param {string} step - Step name (name, recording, review, success, error)
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

        // Reset recording UI if going back to recording step
        if (step === 'recording') {
            this.toggleRecordBtn.classList.remove('hidden');
            this.stopRecordBtn.classList.add('hidden');
            this.recordingIndicator.classList.add('hidden');
            this.cancelRecordBtn.disabled = false;
            this.recordingTime.textContent = '00:00';
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
        if (this.videoPreview.srcObject) {
            this.videoPreview.srcObject = null;
        }
        if (this.videoPlayback.src) {
            URL.revokeObjectURL(this.videoPlayback.src);
            this.videoPlayback.src = '';
        }

        // Show name input step
        this.showStep('name');
    }
}

export default VideoUI;
