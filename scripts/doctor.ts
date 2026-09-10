import { printDoctor, runDoctor } from "@relay/core";

const report = await runDoctor();
printDoctor(report);
process.exit(report.failClosed ? 1 : 0);
