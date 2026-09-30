function popupHtml(r) {
    const photoHtml = r.photo_url
        ? `<a href="${esc(r.photo_url)}" target="_blank" rel="noopener">
               <img class="popup-photo" src="${esc(r.photo_url)}" alt="Report photo">
           </a>`
        : '';

    return `
        <span class="badge ${r.severity}">${r.severity}</span>
        ${photoHtml}
        <div class="popup-row"><strong>Town:</strong> ${esc(r.town || 'Unknown')}</div>
        <div class="popup-row"><strong>District:</strong> ${esc(r.district || 'Unknown')}</div>
        <div class="popup-row"><strong>Region:</strong> ${esc(r.region || 'Unknown')}</div>
        <div class="popup-time">Reported ${formatTime(r.created_at)}</div>
    `;
}