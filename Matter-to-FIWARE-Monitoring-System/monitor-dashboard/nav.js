/* Navigation Bar Component */

function renderNav(activePage) {
  const pages = [
    { id: 'dashboard', label: 'Dashboard', href: 'index.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
    { id: 'devices', label: 'Devices', href: 'devices.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>' },
    { id: 'alerts', label: 'Alerts', href: 'alerts.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' },
    { id: 'map', label: 'Map', href: 'map.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>' },
    { id: 'simulator', label: 'Simulator', href: 'simulator.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
    { id: 'chat', label: 'AI Chat', href: 'chat.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' }
  ];

  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.innerHTML = pages.map(p =>
    `<a href="${p.href}" class="nav-link ${p.id === activePage ? 'active' : ''}"><span class="nav-icon">${p.icon}</span>${p.label}</a>`
  ).join('');

  const statusBar = document.querySelector('.status-bar');
  if (statusBar && statusBar.nextSibling) {
    statusBar.parentNode.insertBefore(nav, statusBar.nextSibling);
  } else if (statusBar) {
    statusBar.parentNode.appendChild(nav);
  }
}
