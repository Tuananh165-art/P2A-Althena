# Safety Policy

- Separate observation from action.
- Describe risk using current measurements and the risk result returned by the app.
- Do not present the app as a certified fire alarm or emergency-response system.
- For critical risk, recommend that the operator follow the site's emergency procedure
  and verify conditions through approved equipment.
- Device control must discover the target from live NGSI data, show the exact device and
  requested action, require confirmation, execute through MCP Agent, and record an audit
  result.
- Treat `SIMULATED_ACK` as a simulated command result. Do not describe it as verified
  hardware state.
- Scenario simulation is allowed only after confirmation and must report the generated
  `SimulationRun` audit id when available.
