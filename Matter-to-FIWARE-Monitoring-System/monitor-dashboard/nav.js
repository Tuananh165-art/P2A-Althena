/* Navigation Bar Component */

function renderNav(activePage) {
  const pages = [
    { id: 'dashboard', label: 'Dashboard', href: 'index.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
    { id: 'devices', label: 'Devices', href: 'devices.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>' },
    { id: 'alerts', label: 'Alerts', href: 'alerts.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' },
    { id: 'map', label: 'Map', href: 'map.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>' },
    { id: 'city3d', label: '3D City', href: 'city-3d.html', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V8l4-2v15"/><path d="M13 21V4l6 3v14"/><path d="M7 11h1"/><path d="M7 15h1"/><path d="M15 10h1"/><path d="M15 14h1"/></svg>' },
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

function renderOpsSidebar(activePage) {
  const host = document.querySelector('[data-ops-sidebar]');
  if (!host) return;

  const pages = [
    { id: 'dashboard', label: 'Overview', href: 'index.html' },
    { id: 'city3d', label: '3D Zones', href: 'city-3d.html' },
    { id: 'devices', label: 'Devices', href: 'devices.html' },
    { id: 'alerts', label: 'Alerts', href: 'alerts.html' },
    { id: 'map', label: 'Map', href: 'map.html' },
    { id: 'simulator', label: 'Simulator', href: 'simulator.html' },
    { id: 'chat', label: 'AI Chat', href: 'chat.html' }
  ];

  host.className = 'ops-sidebar';
  host.innerHTML = `
    <a class="ops-brand" href="index.html" aria-label="Climate Resilience Copilot">
      <span class="ops-brand-mark">CR</span>
      <span>
        <strong>Climate Resilience</strong>
        <small>Operations Copilot</small>
      </span>
    </a>
    <nav class="ops-nav" aria-label="Main navigation">
      ${pages.map(page => `
        <a href="${page.href}" class="${page.id === activePage ? 'active' : ''}">
          <span>${page.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="ops-sidebar-status">
      <span class="sidebar-eyebrow">System</span>
      <div class="sidebar-health-row">
        <span class="status-dot disconnected" id="orion-status"></span>
        <span>Orion</span>
        <strong id="orion-text">Checking...</strong>
      </div>
      <div class="sidebar-health-row">
        <span class="status-dot disconnected" id="mcp-status"></span>
        <span>MCP Agent</span>
        <strong id="mcp-text">Checking...</strong>
      </div>
      <a class="sidebar-chat-link" href="chat.html">Open Copilot</a>
    </div>
  `;
}
