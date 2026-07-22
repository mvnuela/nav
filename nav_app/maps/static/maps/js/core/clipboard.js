/**
 * Clipboard helper shared by the map pages.
 *
 * navigator.clipboard is only available in a secure context (https, or
 * localhost during development), so a page served over plain http on a LAN
 * address falls back to a throwaway <textarea> plus execCommand('copy').
 */

/**
 * Copy text to the clipboard.
 *
 * @param {string} text
 * @returns {Promise<boolean>} true if the copy succeeded.
 */
async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Secure-context or permission failure — fall back to the legacy path.
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            // Keep it out of view and out of the tab order, and avoid the
            // scroll jump a focused off-screen element would otherwise cause.
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return ok;
        } catch (fallbackErr) {
            console.error('Copy to clipboard failed:', fallbackErr);
            return false;
        }
    }
}

// Export for use in other modules (if using module system)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { copyTextToClipboard };
}