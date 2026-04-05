import { collectRepoVerificationErrors } from "./repo-verifier.mjs";

const errors = collectRepoVerificationErrors();

if (errors.length > 0) {
  console.error("ThumbShooter verify failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
} else {
  console.log("ThumbShooter verify passed.");
}
