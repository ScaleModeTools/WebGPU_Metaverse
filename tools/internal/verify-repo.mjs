import { collectRepoVerificationErrors } from "./repo-verifier.mjs";

const errors = collectRepoVerificationErrors();

if (errors.length > 0) {
  console.error("WebGPU Metaverse verify failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
} else {
  console.log("WebGPU Metaverse verify passed.");
}
