function validateGoogleDriveLink(url) {
    if (!url || typeof url !== 'string') {
        return {
            valid: false,
            error: 'Invalid URL format'
        };
    }

    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?.*id=([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return {
                valid: true,
                fileId: match[1],
                url
            };
        }
    }

    return {
        valid: false,
        error: 'Invalid Google Drive URL format'
    };
}

module.exports = {
    validateGoogleDriveLink
};
