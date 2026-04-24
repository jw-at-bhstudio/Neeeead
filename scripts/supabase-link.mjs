import { spawn } from "node:child_process";

const target = process.argv[2];
const envName =
  target === "staging"
    ? "SUPABASE_STAGING_PROJECT_REF"
    : target === "prod"
    ? "SUPABASE_PROD_PROJECT_REF"
    : null;

if (!envName) {
  console.error("Usage: node scripts/supabase-link.mjs <staging|prod>");
  process.exit(1);
}

const projectRef = process.env[envName];
if (!projectRef) {
  console.error(`Missing ${envName}. Set it before running this command.`);
  process.exit(1);
}

const child = spawn("npx", ["--yes", "supabase", "link", "--project-ref", projectRef], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
