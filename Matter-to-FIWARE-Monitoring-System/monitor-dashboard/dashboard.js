/* Dashboard page logic */
document.addEventListener('DOMContentLoaded', () => {
  renderNav('dashboard');
  checkOrionConnection();
  checkMCPConnection();

  setInterval(() => fetchEntities(processEntities), REFRESH_INTERVAL);
  setInterval(() => fetchRisk(updateRiskUI), REFRESH_INTERVAL);
  setInterval(() => fetchAlerts(5, updateAlertsUI), REFRESH_INTERVAL);
  setInterval(() => fetchCommands(3, updateCommandsUI), REFRESH_INTERVAL);
});
