/**
 * Video Recorder Class
 * Handles MediaRecorder API for video recording
 */

import { getVideoConstraints, getRecorderOptions, detectDevice, logDiagnostics } from './video-utils.js';

class VideoRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.recordedChunks = [];
        this.startTime = null;
        this.recordingDuration = 0;
        this.timerInterval = null;
        this.deviceInfo = detectDevice();
        this.maxDuration = 60; // 60 seconds max
    }

    /**
     * Initialize camera and microphone access
     * @returns {Promise<MediaStream>}
     */
    async initializeMedia() {
        try {
            const constraints = getVideoConstraints(this.deviceInfo);
            console.log('📹 Requesting media access with constraints:', constraints);
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('✅ Media access granted successfully');
            console.log('Stream tracks:', this.stream.getTracks().map(t => ({
                kind: t.kind,
                label: t.label,
                enabled: t.enabled,
                readyState: t.readyState
            })));
            
            return this.stream;
        } catch (error) {
            console.error('❌ Error accessing media devices:', error);
            
            // Log comprehensive diagnostics
            await logDiagnostics(error);
            
            throw error;
        }
    }

    /**
     * Start recording video
     * @param {Function} onDataAvailable - Callback for data chunks
     * @param {Function} onTimerUpdate - Callback for timer updates
     * @returns {Promise<void>}
     */
    async startRecording(onDataAvailable = null, onTimerUpdate = null) {
        if (!this.stream) {
            throw new Error('Media stream not initialized. Call initializeMedia() first.');
        }

        try {
            this.recordedChunks = [];
            const options = getRecorderOptions(this.deviceInfo);
            
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            // Handle data available
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    if (onDataAvailable) {
                        onDataAvailable(event.data);
                    }
                }
            };

            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped');
                this.stopTimer();
            };

            // Handle errors
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.stopTimer();
            };

            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.startTime = Date.now();
            
            // Start timer
            this.startTimer(onTimerUpdate);

            console.log('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
            throw error;
        }
    }

    /**
     * Stop recording and return blob
     * @returns {Promise<Blob>}
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                reject(new Error('No active recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                try {
                    const mimeType = this.mediaRecorder.mimeType;
                    const blob = new Blob(this.recordedChunks, { type: mimeType });
                    this.stopTimer();
                    console.log('Recording stopped, blob created:', blob.size, 'bytes');
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Start timer for recording duration
     * @param {Function} onTimerUpdate - Callback for timer updates
     */
    startTimer(onTimerUpdate) {
        this.timerInterval = setInterval(() => {
            this.recordingDuration = Math.floor((Date.now() - this.startTime) / 1000);
            
            if (onTimerUpdate) {
                onTimerUpdate(this.recordingDuration);
            }

            // Auto-stop at max duration
            if (this.recordingDuration >= this.maxDuration) {
                console.log('Max recording duration reached');
                this.stopRecording();
            }
        }, 1000);
    }

    /**
     * Stop timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Get current recording duration in seconds
     * @returns {number}
     */
    getDuration() {
        return this.recordingDuration;
    }

    /**
     * Check if currently recording
     * @returns {boolean}
     */
    isRecording() {
        return this.mediaRecorder && this.mediaRecorder.state === 'recording';
    }

    /**
     * Clean up media streams and recorder
     */
    cleanup() {
        this.stopTimer();

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log('Track stopped:', track.kind);
            });
            this.stream = null;
        }

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.startTime = null;
        this.recordingDuration = 0;
    }

    /**
     * Get media stream for preview
     * @returns {MediaStream|null}
     */
    getStream() {
        return this.stream;
    }
}

export default VideoRecorder;
