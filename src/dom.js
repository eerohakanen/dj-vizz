export const $ = (id) => document.getElementById(id);

export const setButtonOn = (id, on) => $(id).classList.toggle('on', on);

const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (char) => HTML_ENTITIES[char]);

let messageTimer;

export function showMessage(text) {
  const box = $('msg');
  box.textContent = text;
  box.style.opacity = 1;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    box.style.opacity = 0;
  }, 5000);
}
