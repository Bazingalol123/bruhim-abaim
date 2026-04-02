/**
 * Video Recording Main Initialization
 * Entry point for the video recording feature
 */

import VideoUI from './video/video-ui.js';

// Initialize video recording UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing video recording feature...');
    
    try {
        // Create video UI instance
        const videoUI = new VideoUI();
        
        // Make it globally accessible for debugging (optional)
        if (typeof window !== 'undefined') {
            window.videoRecording = videoUI;
        }
        
        console.log('Video recording feature initialized successfully');
    } catch (error) {
        console.error('Failed to initialize video recording feature:', error);
    }
});
