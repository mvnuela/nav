/**
 * Markdown editor for the task form's content_md field: a Write / Preview tab
 * pair and a toolbar that inserts Markdown at the caret, so a teacher can
 * format the task text without knowing the syntax or using another editor.
 *
 * The textarea itself is kept — the form reads and saves it exactly as before.
 * Preview renders through task_markdown.js, the same code as the student
 * panel. If the CDN libraries never load, Write still works as a plain field.
 *
 * Loaded as a plain script; also exported for `node --test tests/js/`.
 */

/** Text with [start, end) replaced by insert, and the new selection. */
function replaceRange({ value, start, end }, insert, selStart, selEnd) {
    return {
        value: value.slice(0, start) + insert + value.slice(end),
        start: start + selStart,
        end: start + selEnd,
    };
}

/** Wrap the selection (or a selected placeholder) in prefix/suffix. */
function wrapSelection(s, mark, placeholder) {
    const text = s.value.slice(s.start, s.end) || placeholder;
    return replaceRange(s, mark + text + mark, mark.length, mark.length + text.length);
}

/** Start of the line holding index i. */
function lineStart(value, i) {
    return value.lastIndexOf('\n', i - 1) + 1;
}

/** Prefix every line the selection touches; the result selects them all. */
function prefixLines(s, prefixFor) {
    const from = lineStart(s.value, s.start);
    const nl = s.value.indexOf('\n', s.end);
    const to = nl === -1 ? s.value.length : nl;
    const block = s.value.slice(from, to);
    const range = { value: s.value, start: from, end: to };
    if (block === '') {
        const prefix = prefixFor(0);
        const placeholder = 'List item';
        return replaceRange(range, prefix + placeholder,
            prefix.length, prefix.length + placeholder.length);
    }
    const out = block.split('\n').map((line, i) => prefixFor(i) + line).join('\n');
    return replaceRange(range, out, 0, out.length);
}

/**
 * Apply one toolbar action to the textarea state.
 *
 * @param {string} action bold | italic | heading | ul | ol | link
 * @param {{value: string, start: number, end: number}} s Text and selection.
 * @returns {{value: string, start: number, end: number}} New text and selection;
 *     the input itself for an unknown action.
 */
function applyMarkdownAction(action, s) {
    switch (action) {
        case 'bold':
            return wrapSelection(s, '**', 'bold text');
        case 'italic':
            return wrapSelection(s, '*', 'italic text');
        case 'heading': {
            const at = lineStart(s.value, s.start);
            return {
                value: s.value.slice(0, at) + '### ' + s.value.slice(at),
                start: s.start + 4,
                end: s.end + 4,
            };
        }
        case 'ul':
            return prefixLines(s, () => '- ');
        case 'ol':
            return prefixLines(s, i => `${i + 1}. `);
        case 'link': {
            const text = s.value.slice(s.start, s.end) || 'link text';
            const urlAt = text.length + 3; // past "[text]("
            return replaceRange(s, `[${text}](https://)`, urlAt, urlAt + 'https://'.length);
        }
        default:
            return s;
    }
}

const MD_TOOLBAR_BUTTONS = [
    { action: 'bold',    label: '<b>B</b>', title: 'Bold' },
    { action: 'italic',  label: '<i>I</i>', title: 'Italic' },
    { action: 'heading', label: 'H',        title: 'Heading' },
    { action: 'ul',      label: '• List',   title: 'Bulleted list' },
    { action: 'ol',      label: '1. List',  title: 'Numbered list' },
    { action: 'link',    label: 'Link',     title: 'Link' },
];

/**
 * Wrap a textarea in the Write / Preview editor.
 *
 * @param {HTMLTextAreaElement} textarea The field the form reads; left in place.
 */
function initMarkdownEditor(textarea) {
    const editor = document.createElement('div');
    editor.className = 'md-editor';
    editor.innerHTML = `
        <div class="md-tabs" role="tablist">
            <button type="button" role="tab" class="md-tab active" data-tab="write" aria-selected="true">Write</button>
            <button type="button" role="tab" class="md-tab" data-tab="preview" aria-selected="false">Preview</button>
        </div>
        <div class="md-toolbar">${MD_TOOLBAR_BUTTONS.map(b =>
            `<button type="button" data-action="${b.action}" title="${b.title}">${b.label}</button>`
        ).join('')}</div>
        <div class="md-preview task-panel-content" hidden><div class="task-content"></div></div>`;
    textarea.parentNode.insertBefore(editor, textarea);
    editor.insertBefore(textarea, editor.querySelector('.md-preview'));

    const toolbar = editor.querySelector('.md-toolbar');
    const preview = editor.querySelector('.md-preview');
    const previewBody = preview.querySelector('.task-content');

    toolbar.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const r = applyMarkdownAction(btn.dataset.action, {
            value: textarea.value,
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
        });
        textarea.value = r.value;
        textarea.focus();
        textarea.setSelectionRange(r.start, r.end);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    editor.querySelector('.md-tabs').addEventListener('click', e => {
        const tab = e.target.closest('button[data-tab]');
        if (!tab) return;
        const showPreview = tab.dataset.tab === 'preview';
        editor.querySelectorAll('.md-tab').forEach(t => {
            const on = t === tab;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
        });
        toolbar.hidden = showPreview;
        textarea.hidden = showPreview;
        preview.hidden = !showPreview;
        if (!showPreview) return;
        if (!fillTaskMarkdown(previewBody, textarea.value)) {
            previewBody.innerHTML = '';
            const note = document.createElement('p');
            note.className = 'md-preview-note';
            note.textContent = textarea.value.trim()
                ? 'Preview unavailable — the Markdown renderer did not load. Your text is kept as written.'
                : 'Nothing to preview yet.';
            previewBody.appendChild(note);
        }
    });
}

if (typeof document !== 'undefined') {
    const initAll = () =>
        document.querySelectorAll('textarea[data-md-editor]').forEach(initMarkdownEditor);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyMarkdownAction };
}
