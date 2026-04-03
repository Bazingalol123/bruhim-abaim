/**
 * Video Recorder Class
 * Handles video file selection from native camera and image processing
 */

import { detectDevice, validateImageFile, compressImage, getImageDimensions, validateVideoDuration } from './video-utils.js';

class VideoRecorder {
    constructor() {
        this.recordedBlob = null;
        this.recordingDuration = 0;
        this.deviceInfo = detectDevice();
        this.maxDuration = 45; // 45 seconds max
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

            // Validate video duration against 45-second cap
            const durationCheck = validateVideoDuration(this.recordingDuration);
            if (!durationCheck.valid) {
                const durationError = new Error('Video exceeds maximum duration');
                durationError.type = durationCheck.error;
                throw durationError;
            }
            
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
     * Handle image file selection: validate, compress, and return processed data
     * @param {File} file - Image file from input element
     * @returns {Promise<{blob: Blob, width: number, height: number, originalSize: number, compressedSize: number}>}
     */
    async handleImageSelection(file) {
        try {
            if (!file) {
                throw new Error('No file selected');
            }

            console.log('🖼️ Image file selected:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            // Validate image file (type + size)
            const validation = validateImageFile(file);
            if (!validation.valid) {
                const validationError = new Error(validation.error);
                validationError.type = validation.error;
                throw validationError;
            }

            const originalSize = file.size;

            // Get original dimensions
            const { width, height } = await getImageDimensions(file);
            console.log('📐 Original dimensions:', width, 'x', height);

            // Compress the image (resize + JPEG encode)
            const compressedBlob = await compressImage(file);
            const compressedSize = compressedBlob.size;
            console.log(`🗜️ Compressed: ${originalSize} → ${compressedSize} bytes (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);

            // Get final dimensions after compression
            const finalDims = await getImageDimensions(compressedBlob);

            console.log('✅ Image processed successfully');

            return {
                blob: compressedBlob,
                width: finalDims.width,
                height: finalDims.height,
                originalSize: originalSize,
                compressedSize: compressedSize
            };
        } catch (error) {
            console.error('❌ Error processing image file:', error);
            throw error;
        }
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
