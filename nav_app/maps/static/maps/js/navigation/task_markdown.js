/**
 * Renders a task's content_md for display — shared by the student task panel
 * and the Preview tab of the teacher's Markdown editor, so the teacher sees
 * exactly what the student will.
 *
 * marked and DOMPurify come from a CDN. When either has not loaded, nothing is
 * rendered: the caller shows a fallback instead, never unsanitised HTML.
 *
 * Loaded as a plain script; also exported for `node --test tests/js/`.
 */

const TASK_MD_MARKED_OPTIONS = { gfm: true, breaks: false };

const TASK_MD_SANITIZE = {
    ALLOWED_TAGS: ['p','br','strong','em','code','pre','blockquote',
                   'ul','ol','li','h1','h2','h3','h4','h5','h6',
                   'a','img','hr','table','thead','tbody','tr','th','td',
                   'span','div','del','sub','sup'],
    ALLOWED_ATTR: ['href','title','alt','src','class'],
};

/**
 * @param {string|undefined} md Markdown source.
 * @param {{marked?: object, DOMPurify?: object}} [libs] Defaults to the page's globals.
 * @returns {string|null} Sanitised HTML, or null when there is nothing to show
 *     or a library is missing.
 */
function renderTaskMarkdown(md, libs = globalThis) {
    if (!md || !md.trim()) return null;
    const { marked, DOMPurify } = libs;
    if (!marked || !DOMPurify) return null;
    const html = marked.parse(md, TASK_MD_MARKED_OPTIONS);
    return DOMPurify.sanitize(html, TASK_MD_SANITIZE);
}

/**
 * Render md into el, opening its links in a new tab.
 *
 * @param {HTMLElement} el Target container; replaced only on success.
 * @param {string|undefined} md Markdown source.
 * @returns {boolean} Whether anything was rendered.
 */
function fillTaskMarkdown(el, md) {
    const html = renderTaskMarkdown(md);
    if (html === null) return false;
    el.innerHTML = html;
    el.querySelectorAll('a[href]').forEach(a => {
        a.target = '_blank';
        a.rel = 'noopener noreferrer ugc';
    });
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderTaskMarkdown, fillTaskMarkdown };
}
