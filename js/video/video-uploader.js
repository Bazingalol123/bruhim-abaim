/**
 * Media Uploader Class
 * Handles uploading videos and images to Firebase Storage and saving metadata to Firestore
 */

import { storage, db } from '../config/firebase-config.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { detectDevice } from './video-utils.js';

class VideoUploader {
    constructor() {
        this.currentUploadTask = null;
    }

    /**
     * Generate UUID v4 for unique video ID
     * @returns {string}
     */
    generateVideoId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Upload video blob to Firebase Storage
     * @param {Blob} videoBlob - Recorded video blob
     * @param {Object} metadata - Video metadata (guestName, duration, etc.)
     * @param {Function} progressCallback - Progress update callback (0-100)
     * @returns {Promise<Object>} Upload result with video URL and document ID
     */
    async uploadVideo(videoBlob, metadata, progressCallback = null) {
        if (!storage || !db) {
            throw new Error('Firebase not initialized. Please configure firebase-config.js');
        }

        const videoId = this.generateVideoId();
        const fileName = `${videoId}.webm`;
        const storageRef = ref(storage, `wedding-videos/${fileName}`);
        
        console.log('📤 Starting upload:', fileName);

        // Create upload task with metadata
        const uploadTask = uploadBytesResumable(storageRef, videoBlob, {
            contentType: videoBlob.type,
            customMetadata: {
                guestName: metadata.guestName,
                uploadedAt: new Date().toISOString()
            }
        });

        this.currentUploadTask = uploadTask;

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                // Progress updates
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload progress: ${progress.toFixed(1)}%`);
                    
                    if (progressCallback) {
                        progressCallback(progress);
                    }
                },
                // Error handling
                (error) => {
                    console.error('Upload error:', error);
                    this.currentUploadTask = null;
                    reject(this.handleUploadError(error));
                },
                // Upload complete
                async () => {
                    try {
                        // Get download URL
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('✅ Upload complete, URL:', downloadURL);

                        // Save metadata to Firestore (with mediaType for forward compat)
                        const docId = await this.saveMetadata(videoId, downloadURL, metadata, videoBlob.size);
                        
                        this.currentUploadTask = null;
                        
                        resolve({
                            videoId: videoId,
                            videoUrl: downloadURL,
                            documentId: docId,
                            success: true
                        });
                    } catch (error) {
                        console.error('Error saving metadata:', error);
                        // Storage upload succeeded but metadata save failed
                        // Return partial success with error info
                        this.currentUploadTask = null;
                        resolve({
                            videoId: videoId,
                            videoUrl: downloadURL,
                            documentId: null,
                            success: false,
                            partialSuccess: true,
                            error: error.message
                        });
                    }
                }
            );
        });
    }

    /**
     * Save video metadata to Firestore
     * @param {string} videoId - UUID of the video
     * @param {string} videoUrl - Firebase Storage download URL
     * @param {Object} metadata - Video metadata (guestName, duration)
     * @param {number} fileSize - File size in bytes
     * @returns {Promise<string>} Document ID
     */
    async saveMetadata(videoId, videoUrl, metadata, fileSize) {
        try {
            const deviceInfo = detectDevice();
            
            const docData = {
                // Required fields
                guestName: metadata.guestName,
                timestamp: serverTimestamp(),
                mediaType: 'video',
                mediaUrl: videoUrl,
                videoUrl: videoUrl,
                duration: metadata.duration || 0,
                fileSize: fileSize,
                
                // Optional device info
                deviceInfo: {
                    userAgent: deviceInfo.userAgent,
                    platform: deviceInfo.platform,
                    isMobile: deviceInfo.isMobile,
                    isIOS: deviceInfo.isIOS,
                    isSafari: deviceInfo.isSafari
                },
                
                // Status flags
                uploadComplete: true,
                viewed: false,
                starred: false,
                
                // Timestamps
                uploadedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'videoMetadata'), docData);
            console.log('✅ Metadata saved with ID:', docRef.id);
            
            return docRef.id;
        } catch (error) {
            console.error('Error saving metadata:', error);
            throw new Error('Failed to save video metadata: ' + error.message);
        }
    }

    /**
     * Upload an image blob to Firebase Storage and save metadata
     * @param {Blob} imageBlob - Compressed image blob (JPEG)
     * @param {Object} metadata - Image metadata (guestName, width, height, originalFileSize)
     * @param {Function} progressCallback - Progress update callback (0-100)
     * @returns {Promise<Object>} Upload result with image URL and document ID
     */
    async uploadImage(imageBlob, metadata, progressCallback = null) {
        if (!storage || !db) {
            throw new Error('Firebase not initialized. Please configure firebase-config.js');
        }

        const imageId = this.generateVideoId();
        const fileName = `${imageId}.jpg`;
        const storageRef = ref(storage, `wedding-images/${fileName}`);

        console.log('📤 Starting image upload:', fileName);

        // Create upload task with metadata
        const uploadTask = uploadBytesResumable(storageRef, imageBlob, {
            contentType: 'image/jpeg',
            customMetadata: {
                guestName: metadata.guestName,
                uploadedAt: new Date().toISOString()
            }
        });

        this.currentUploadTask = uploadTask;

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                // Progress updates
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Image upload progress: ${progress.toFixed(1)}%`);

                    if (progressCallback) {
                        progressCallback(progress);
                    }
                },
                // Error handling
                (error) => {
                    console.error('Image upload error:', error);
                    this.currentUploadTask = null;
                    reject(this.handleUploadError(error));
                },
                // Upload complete
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('✅ Image upload complete, URL:', downloadURL);

                        // Save image metadata to Firestore
                        const docId = await this.saveImageMetadata(imageId, downloadURL, metadata, imageBlob.size);

                        this.currentUploadTask = null;

                        resolve({
                            imageId: imageId,
                            imageUrl: downloadURL,
                            documentId: docId,
                            success: true
                        });
                    } catch (error) {
                        console.error('Error saving image metadata:', error);
                        this.currentUploadTask = null;
                        resolve({
                            imageId: imageId,
                            imageUrl: downloadURL,
                            documentId: null,
                            success: false,
                            partialSuccess: true,
                            error: error.message
                        });
                    }
                }
            );
        });
    }

    /**
     * Save image metadata to Firestore (videoMetadata collection, mediaType: 'image')
     * @param {string} imageId - UUID of the image
     * @param {string} imageUrl - Firebase Storage download URL
     * @param {Object} metadata - Image metadata (guestName, width, height, originalFileSize)
     * @param {number} fileSize - Compressed file size in bytes
     * @returns {Promise<string>} Document ID
     */
    async saveImageMetadata(imageId, imageUrl, metadata, fileSize) {
        try {
            const deviceInfo = detectDevice();

            const docData = {
                // Required fields
                guestName: metadata.guestName,
                timestamp: serverTimestamp(),
                mediaType: 'image',
                mediaUrl: imageUrl,
                videoUrl: imageUrl,       // backward compat
                imageUrl: imageUrl,
                width: metadata.width || 0,
                height: metadata.height || 0,
                fileSize: fileSize,
                originalFileSize: metadata.originalFileSize || 0,

                // Optional device info
                deviceInfo: {
                    userAgent: deviceInfo.userAgent,
                    platform: deviceInfo.platform,
                    isMobile: deviceInfo.isMobile,
                    isIOS: deviceInfo.isIOS,
                    isSafari: deviceInfo.isSafari
                },

                // Status flags
                uploadComplete: true,
                viewed: false,
                starred: false,

                // Timestamps
                uploadedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'videoMetadata'), docData);
            console.log('✅ Image metadata saved with ID:', docRef.id);

            return docRef.id;
        } catch (error) {
            console.error('Error saving image metadata:', error);
            throw new Error('Failed to save image metadata: ' + error.message);
        }
    }

    /**
     * Cancel ongoing upload
     */
    cancelUpload() {
        if (this.currentUploadTask) {
            console.log('🛑 Canceling upload...');
            this.currentUploadTask.cancel();
            this.currentUploadTask = null;
        }
    }

    /**
     * Handle upload errors with user-friendly messages
     * @param {Error} error - Firebase Storage error
     * @returns {Error} Error with Hebrew message
     */
    handleUploadError(error) {
        const errorMessages = {
            'storage/unauthorized': 'אין הרשאה להעלות קבצים. אנא בדקו את הגדרות האבטחה של Firebase.',
            'storage/canceled': 'ההעלאה בוטלה.',
            'storage/unknown': 'אירעה שגיאה לא ידועה. אנא נסו שוב.',
            'storage/quota-exceeded': 'אין מספיק מקום באחסון. אנא צרו קשר עם מארגני החתונה.',
            'storage/unauthenticated': 'נדרשת הזדהות. אנא רעננו את הדף ונסו שוב.',
            'storage/retry-limit-exceeded': 'יותר מדי ניסיונות. אנא המתינו מעט ונסו שוב.',
            'storage/invalid-checksum': 'הקובץ נפגם במהלך ההעלאה. אנא נסו שוב.'
        };

        const message = errorMessages[error.code] || 'שגיאה בהעלאת הקובץ. אנא בדקו את החיבור לאינטרנט ונסו שוב.';
        const hebrewError = new Error(message);
        hebrewError.originalError = error;
        
        return hebrewError;
    }

    /**
     * Check if Firebase is properly configured
     * @returns {boolean}
     */
    isConfigured() {
        return !!(storage && db);
    }
}

export default VideoUploader;
