import { hrtime } from "node:process";

import { createBenchmarkSuites } from "./benchmark-suites.mjs";
import { createClientBenchmarkModuleLoader } from "./load-client-benchmark-modules.mjs";

function formatNs(value) {
  return `${value.toFixed(0)} ns`;
}

function formatOpsPerSecond(meanNs) {
  return `${(1_000_000_000 / meanNs).toFixed(0)} ops/s`;
}

function runSuite(suite) {
  const runIteration = suite.setup();
  const warmupIterations = Math.min(2000, Math.max(500, Math.floor(suite.iterations / 10)));

  for (let index = 0; index < warmupIterations; index += 1) {
    runIteration();
  }

  const startedAt = hrtime.bigint();

  for (let index = 0; index < suite.iterations; index += 1) {
    runIteration();
  }

  const elapsedNs = Number(hrtime.bigint() - startedAt);
  const meanNs = elapsedNs / suite.iterations;

  return {
    elapsedNs,
    meanNs,
    passed: meanNs <= suite.maxMeanNs
  };
}

const clientLoader = await createClientBenchmarkModuleLoader();

try {
  const suites = await createBenchmarkSuites({ clientLoader });
  let failures = 0;

  if (suites.length === 0) {
    console.error("ThumbShooter bench failed: no benchmark suites are defined.");
    process.exitCode = 1;
  } else {
    console.log("ThumbShooter benchmarks");

    for (const suite of suites) {
      const result = runSuite(suite);

      console.log(
        `- ${result.passed ? "PASS" : "FAIL"} ${suite.id}: ${formatNs(result.meanNs)} mean, ${formatOpsPerSecond(result.meanNs)}, budget <= ${formatNs(suite.maxMeanNs)}`
      );

      if (!result.passed) {
        failures += 1;
      }
    }

    if (failures > 0) {
      console.error(
        `ThumbShooter bench failed: ${failures} benchmark suite${failures === 1 ? "" : "s"} exceeded the configured budget.`
      );
      process.exitCode = 1;
    }
  }
} finally {
  await clientLoader.close();
}
