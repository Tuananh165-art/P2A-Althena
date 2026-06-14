#!/usr/bin/env node

import {
  createClimateClient,
  parseCliArgs,
  runOperation,
  serializeError,
} from "./climate-api-lib.mjs";

let operation;

try {
  const options = parseCliArgs(process.argv.slice(2));
  operation = options.operation;
  const client = createClimateClient();
  const output = await runOperation(client, options);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.ok ? 0 : 2;
} catch (error) {
  process.stderr.write(`${JSON.stringify(serializeError(error, operation), null, 2)}\n`);
  process.exitCode = 1;
}
