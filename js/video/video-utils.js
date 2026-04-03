/**
 * Video Recording Utility Functions
 * Helper functions for video recording and image upload features
 */

// ── Image & Video Constants ──────────────────────────────────────────
export const MAX_VIDEO_DURATION = 45; // seconds
export const IMAGE_MAX_DIMENSION = 4096;
export const IMAGE_QUALITY = 0.92;
export const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB raw before compression
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Format time in seconds to MM:SS
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size in bytes to human-readable
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generate unique filename with timestamp
 * @param {string} guestName
 * @returns {string}
 */
export function generateFilename(guestName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedName = guestName.replace(/[^a-zA-Z0-9א-ת\s]/g, '').replace(/\s+/g, '_');
    return `ברכה_${sanitizedName}_${timestamp}.webm`;
}

/**
 * Create download link for video blob
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadVideo(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Detect device information
 * @returns {Object}
 */
export function detectDevice() {
    const ua = navigator.userAgent;
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    return {
        isMobile: /iPhone|iPad|iPod|Android/i.test(ua),
        isIOS: /iPhone|iPad|iPod/i.test(ua),
        isSafari: /Safari/i.test(ua) && !/Chrome/i.test(ua),
        isAndroid: /Android/i.test(ua),
        isMac: isMac,
        userAgent: ua,
        platform: navigator.platform
    };
}

/**
 * Validate guest name
 * @param {string} name
 * @returns {boolean}
 */
export function validateGuestName(name) {
    return name && name.trim().length > 0 && name.trim().length <= 100;
}

/**
 * Get optimal video constraints for device
 * @param {Object} deviceInfo
 * @returns {Object} MediaRecorder constraints
 */
export function getVideoConstraints(deviceInfo) {
    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user' // Front camera
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };

    // iOS Safari specific adjustments
    if (deviceInfo.isIOS && deviceInfo.isSafari) {
        constraints.video.width = { ideal: 640 };
        constraints.video.height = { ideal: 480 };
    }

    // Mobile adjustments
    if (deviceInfo.isMobile) {
        constraints.video.frameRate = { ideal: 30, max: 30 };
    }

    return constraints;
}

/**
 * Get optimal MediaRecorder options
 * @param {Object} deviceInfo
 * @returns {Object}
 */
export function getRecorderOptions(deviceInfo) {
    // Try VP9 first (better compression), fallback to VP8, then H.264
    const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4' // iOS Safari fallback
    ];

    let mimeType = 'video/webm';
    for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
        }
    }

    return {
        mimeType: mimeType,
        videoBitsPerSecond: deviceInfo.isMobile ? 2500000 : 5000000 // 2.5Mbps mobile, 5Mbps desktop
    };
}

/**
 * Check if page is served securely
 * @returns {Object}
 */
export function checkSecureContext() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    const isHttps = protocol === 'https:';
    const isSecure = isHttps || isLocalhost;
    
    return {
        protocol,
        hostname,
        isLocalhost,
        isHttps,
        isSecure
    };
}

/**
 * Get available media devices (for debugging)
 * @returns {Promise<Object>}
 */
export async function getAvailableDevices() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return { supported: false, devices: [] };
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        
        return {
            supported: true,
            devices,
            videoInputs,
            audioInputs,
            hasCamera: videoInputs.length > 0,
            hasMicrophone: audioInputs.length > 0
        };
    } catch (error) {
        console.error('Error enumerating devices:', error);
        return { supported: false, devices: [], error };
    }
}

/**
 * Log comprehensive diagnostic information
 * @param {Error} [error] - Optional error to log
 */
export async function logDiagnostics(error = null) {
    console.group('🔍 Camera Access Diagnostics');
    
    // Browser and OS info
    const deviceInfo = detectDevice();
    console.log('📱 Device Info:', {
        isMobile: deviceInfo.isMobile,
        isIOS: deviceInfo.isIOS,
        isMac: deviceInfo.isMac,
        isSafari: deviceInfo.isSafari,
        platform: deviceInfo.platform,
        userAgent: deviceInfo.userAgent
    });
    
    // Security context
    const securityInfo = checkSecureContext();
    console.log('🔒 Security Context:', {
        protocol: securityInfo.protocol,
        hostname: securityInfo.hostname,
        isSecure: securityInfo.isSecure,
        isHttps: securityInfo.isHttps,
        isLocalhost: securityInfo.isLocalhost
    });
    
    // Browser support
    const support = checkBrowserSupport();
    console.log('✅ Browser Support:', support);
    
    // Available devices
    const devices = await getAvailableDevices();
    console.log('🎥 Available Devices:', {
        hasCamera: devices.hasCamera,
        hasMicrophone: devices.hasMicrophone,
        videoInputs: devices.videoInputs?.length || 0,
        audioInputs: devices.audioInputs?.length || 0
    });
    
    // Error details
    if (error) {
        console.error('❌ Error Details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    }
    
    console.groupEnd();
}

/**
 * Get detailed Hebrew error message for camera/recording errors
 * @param {Error} error
 * @returns {string}
 */
export function getErrorMessage(error) {
    const deviceInfo = detectDevice();
    const securityInfo = checkSecureContext();

    // ── Image & video-specific error types (by string type) ──────────
    const mediaErrorMessages = {
        'image-too-large': '😔 התמונה גדולה מדי. אנא נסו תמונה קטנה יותר',
        'invalid-image-type': '😔 סוג הקובץ לא נתמך. אנא צלמו תמונה בפורמט רגיל',
        'compression-failed': '😔 לא הצלחנו לעבד את התמונה. אנא נסו שוב',
        'video-too-long': '😔 הסרטון ארוך מדי. אנא צלמו סרטון קצר יותר (עד 45 שניות)'
    };

    if (error.type && mediaErrorMessages[error.type]) {
        return mediaErrorMessages[error.type];
    }
    
    // Check for specific error types
    if (error.name === 'NotAllowedError') {
        // Determine if it's likely a system-level permission issue
        const isSystemPermissionIssue = deviceInfo.isMac || deviceInfo.isIOS;
        
        if (!securityInfo.isSecure) {
            return `⚠️ הדף לא מאובטח!\n\nגישה למצלמה דורשת חיבור מאובטח.\nוודאו שהכתובת מתחילה ב-https:// או localhost\n\nכתובת נוכחית: ${securityInfo.protocol}//${securityInfo.hostname}`;
        }
        
        if (isSystemPermissionIssue) {
            if (deviceInfo.isMac) {
                return `🔒 הרשאות מערכת חסומות\n\nנראה שהדפדפן אינו מורשה לגשת למצלמה ברמת המערכת.\n\nכדי לתקן:\n1. פתחו System Preferences (העדפות מערכת)\n2. לחצו על Security & Privacy (אבטחה ופרטיות)\n3. בחרו בלשונית Privacy (פרטיות)\n4. לחצו על Camera (מצלמה) בצד שמאל\n5. ודאו שהדפדפן שלכם (Chrome/Safari/Firefox) מסומן\n6. אם השתנה משהו, רעננו את הדף`;
            } else {
                return `🔒 הרשאות מערכת חסומות\n\nנראה ש-iOS חוסם את הגישה למצלמה.\n\nכדי לתקן:\n1. פתחו Settings (הגדרות)\n2. גללו למטה למציאת הדפדפן שלכם\n3. ודאו ש-Camera מופעל\n4. רעננו את הדף`;
            }
        }
        
        return `🚫 לא ניתנה גישה למצלמה\n\nאנא אפשרו גישה למצלמה ומיקרופון:\n1. לחצו על סימן המנעול/מצלמה בשורת הכתובת\n2. אפשרו גישה למצלמה ומיקרופון\n3. רעננו את הדף`;
    }
    
    const errorMessages = {
        'NotFoundError': '📹 לא נמצאה מצלמה או מיקרופון במכשיר.\n\nוודאו שמכשיר מצלמה מחובר למחשב.',
        'NotReadableError': '⚠️ המצלמה בשימוש על ידי אפליקציה אחרת.\n\nסגרו יישומים אחרים שעשויים להשתמש במצלמה (Zoom, Teams, וכו\') ונסו שוב.',
        'OverconstrainedError': '⚙️ המצלמה אינה תומכת בהגדרות המבוקשות.\n\nנסו עם מצלמה אחרת או עדכנו את דרייברי המצלמה.',
        'SecurityError': '🔐 גישה למצלמה נחסמה מסיבות אבטחה.\n\nוודאו שהדף נטען דרך HTTPS או localhost.',
        'TypeError': '❌ שגיאה בהגדרות המצלמה.\n\nנסו לרענן את הדף.',
        'AbortError': '⏹️ ההקלטה בוטלה.'
    };

    return errorMessages[error.name] || `❌ אירעה שגיאה: ${error.message || 'אנא נסו שוב.'}`;
}

/**
 * Check if browser supports required features
 * @returns {Object}
 */
export function checkBrowserSupport() {
    return {
        mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        mediaRecorder: typeof MediaRecorder !== 'undefined',
        supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined')
    };
}

/**
 * Run pre-flight checks before requesting camera access
 * @returns {Promise<Object>}
 */
export async function runPreflightChecks() {
    const results = {
        passed: true,
        errors: [],
        warnings: []
    };
    
    // Check browser support
    const support = checkBrowserSupport();
    if (!support.supported) {
        results.passed = false;
        results.errors.push('הדפדפן אינו תומך בהקלטת וידאו');
        return results;
    }
    
    // Check secure context
    const securityInfo = checkSecureContext();
    if (!securityInfo.isSecure) {
        results.passed = false;
        results.errors.push(`הדף חייב להיטען דרך HTTPS או localhost. כתובת נוכחית: ${securityInfo.protocol}//${securityInfo.hostname}`);
    }
    
    // Check for available devices (requires permission or previous access)
    try {
        const devices = await getAvailableDevices();
        if (!devices.hasCamera) {
            results.warnings.push('לא זוהתה מצלמה (ייתכן שנדרשת הרשאה)');
        }
        if (!devices.hasMicrophone) {
            results.warnings.push('לא זוהה מיקרופון (ייתכן שנדרשת הרשאה)');
        }
    } catch (error) {
        results.warnings.push('לא ניתן לבדוק מכשירים זמינים');
    }
    
    return results;
}

// ── Image Utility Functions ──────────────────────────────────────────

/**
 * Validate an image file (type + size)
 * @param {File} file
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'invalid-image-type' };
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return { valid: false, error: 'invalid-image-type' };
    }

    if (file.size > MAX_IMAGE_SIZE) {
        return { valid: false, error: 'image-too-large' };
    }

    return { valid: true, error: null };
}

/**
 * Get image dimensions by loading it into an Image element
 * @param {File|Blob} file
 * @returns {Promise<{width: number, height: number}>}
 */
export function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
            URL.revokeObjectURL(url);
            resolve(dimensions);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Compress an image using the Canvas API.
 * Resizes to max IMAGE_MAX_DIMENSION px (maintaining aspect ratio) and
 * encodes as JPEG at IMAGE_QUALITY.
 * @param {File|Blob} file
 * @returns {Promise<Blob>} Compressed JPEG blob
 */
export async function compressImage(file) {
    try {
        // Load image dimensions first
        const { width, height } = await getImageDimensions(file);

        // Calculate target dimensions (maintain aspect ratio, cap at IMAGE_MAX_DIMENSION)
        let targetWidth = width;
        let targetHeight = height;

        if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
            if (width > height) {
                targetWidth = IMAGE_MAX_DIMENSION;
                targetHeight = Math.round(height * (IMAGE_MAX_DIMENSION / width));
            } else {
                targetHeight = IMAGE_MAX_DIMENSION;
                targetWidth = Math.round(width * (IMAGE_MAX_DIMENSION / height));
            }
        }

        // Create canvas for compression
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');

        // Draw the image onto the canvas
        const imageBitmap = await createImageBitmap(file);
        ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
        imageBitmap.close();

        // Convert canvas to JPEG blob
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas toBlob returned null'));
                    }
                },
                'image/jpeg',
                IMAGE_QUALITY
            );
        });
    } catch (error) {
        console.error('Image compression failed:', error);
        const compressionError = new Error('compression-failed');
        compressionError.type = 'compression-failed';
        throw compressionError;
    }
}

/**
 * Generate unique filename for an image upload
 * @param {string} guestName
 * @returns {string}
 */
export function generateImageFilename(guestName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedName = guestName.replace(/[^a-zA-Z0-9א-ת\s]/g, '').replace(/\s+/g, '_');
    return `ברכה_${sanitizedName}_${timestamp}.jpg`;
}

/**
 * Validate that video duration is within the allowed cap
 * @param {number} duration - Duration in seconds
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateVideoDuration(duration) {
    if (typeof duration === 'number' && duration > MAX_VIDEO_DURATION) {
        return { valid: false, error: 'video-too-long' };
    }
    return { valid: true, error: null };
}
