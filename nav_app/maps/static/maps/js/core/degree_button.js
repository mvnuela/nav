/**
 * A "°" button next to a coordinate field.
 *
 * Students on Windows have no easy way to type a degree sign, and the
 * placeholders all show one. The parsers accept "54 22.5 N" without it, but
 * whoever wants the nautical notation gets it with one click: the sign goes in
 * at the caret, replacing any selection, and the caret lands right after it.
 *
 * Fields opt in with a data-degree-button attribute, picked up on load and
 * whenever such a field is added to the page later; attachDegreeButton can
 * also be called directly (the sea map's Go to Position box).
 *
 * Loaded as a plain script; also exported for `node --test tests/js/`.
 */

const DEGREE_SIGN = '°';

/**
 * Put text in place of the selection [start, end).
 *
 * @param {string} value Current field text.
 * @param {?number} start Selection start; null means "no caret", i.e. the end.
 * @param {?number} end Selection end.
 * @param {string} text Text to insert.
 * @returns {{value: string, caret: number}} New text and the caret after the insert.
 */
function insertAtCaret(value, start, end, text) {
    const from = start ?? value.length;
    const to = end ?? from;
    return {
        value: value.slice(0, from) + text + value.slice(to),
        caret: from + text.length,
    };
}

/**
 * Wrap an input so a "°" button sits to its right.
 *
 * @param {HTMLInputElement} input The coordinate field; stays the element the page reads.
 */
function attachDegreeButton(input) {
    if (!input || input.dataset.degreeButtonAttached) return;
    input.dataset.degreeButtonAttached = '1';

    const row = document.createElement('span');
    row.style.cssText = 'display:flex; gap:4px; align-items:stretch;';
    // The row takes over the input's spacing, or the button would stretch
    // into the margin below the field.
    row.style.marginBottom = input.style.marginBottom;
    input.style.marginBottom = '0';
    input.style.flex = '1';
    input.style.minWidth = '0';
    input.parentNode.insertBefore(row, input);
    row.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = DEGREE_SIGN;
    button.title = 'Insert degree sign (°)';
    button.setAttribute('aria-label', 'Insert degree sign');
    button.style.cssText = 'padding:0 9px; border:1px solid #ccc; border-radius:3px; '
        + 'background:#f5f5f5; cursor:pointer; font-size:1em; line-height:1;';
    row.appendChild(button);

    // Until the student has been in the field its selection offsets mean
    // nothing, so the sign goes at the end.
    let visited = false;
    input.addEventListener('focus', () => { visited = true; });

    // Keep focus, and with it the selection, in the field when clicked.
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', () => {
        const r = visited
            ? insertAtCaret(input.value, input.selectionStart, input.selectionEnd, DEGREE_SIGN)
            : insertAtCaret(input.value, null, null, DEGREE_SIGN);
        input.value = r.value;
        input.focus();
        input.setSelectionRange(r.caret, r.caret);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

if (typeof document !== 'undefined') {
    const SELECTOR = 'input[data-degree-button]';
    const initAll = () => {
        document.querySelectorAll(SELECTOR).forEach(attachDegreeButton);
        // The task form adds track rows long after load; their fields opt in
        // with the same attribute instead of each builder calling us.
        new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches(SELECTOR)) attachDegreeButton(node);
                    node.querySelectorAll(SELECTOR).forEach(attachDegreeButton);
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { insertAtCaret };
}
