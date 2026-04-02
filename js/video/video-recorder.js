/**
 * Video Recorder Class
 * Handles video file selection from native camera
 */

import { detectDevice } from './video-utils.js';

class VideoRecorder {
    constructor() {
        this.recordedBlob = null;
        this.recordingDuration = 0;
        this.deviceInfo = detectDevice();
        this.maxDuration = 60; // 60 seconds max
    }

    /**
     * Handle file selection from native camera input
     * @param {File} file - Video file from input element
     * @returns {Promise<Blob>}
     */
    async handleFileSelection(file) {
        try {
            if (!file) {
                throw new Error('No file selected');
            }

            if (!file.type.startsWith('video/')) {
                throw new Error('Selected file is not a video');
            }

            console.log('📹 Video file selected:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            // Convert File to Blob for consistency with the rest of the app
            this.recordedBlob = new Blob([file], { type: file.type });
            
            // Get video duration if possible
            await this.getVideoDuration(file);
            
            console.log('✅ Video file processed successfully');
            
            return this.recordedBlob;
        } catch (error) {
            console.error('❌ Error processing video file:', error);
            throw error;
        }
    }

    /**
     * Get video duration from file
     * @param {File} file - Video file
     * @returns {Promise<number>} Duration in seconds
     */
    async getVideoDuration(file) {
        return new Promise((resolve) => {
            try {
                const video = document.createElement('video');
                video.preload = 'metadata';
                
                video.onloadedmetadata = () => {
                    window.URL.revokeObjectURL(video.src);
                    this.recordingDuration = Math.floor(video.duration);
                    console.log('Video duration:', this.recordingDuration, 'seconds');
                    resolve(this.recordingDuration);
                };
                
                video.onerror = () => {
                    window.URL.revokeObjectURL(video.src);
                    console.warn('Could not determine video duration');
                    this.recordingDuration = 0;
                    resolve(0);
                };
                
                video.src = URL.createObjectURL(file);
            } catch (error) {
                console.warn('Error getting video duration:', error);
                this.recordingDuration = 0;
                resolve(0);
            }
        });
    }

    /**
     * Get recorded blob
     * @returns {Blob|null}
     */
    getRecordedBlob() {
        return this.recordedBlob;
    }

    /**
     * Get current recording duration in seconds
     * @returns {number}
     */
    getDuration() {
        return this.recordingDuration;
    }

    /**
     * Clean up recorder state
     */
    cleanup() {
        this.recordedBlob = null;
        this.recordingDuration = 0;
    }
}

export default VideoRecorder;
