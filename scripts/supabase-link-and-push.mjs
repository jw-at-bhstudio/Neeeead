import { spawn } from "node:child_process";

const target = process.argv[2];
const envName =
  target === "staging"
    ? "SUPABASE_STAGING_PROJECT_REF"
    : target === "prod"
    ? "SUPABASE_PROD_PROJECT_REF"
    : null;

if (!envName) {
  console.error("Usage: node scripts/supabase-link-and-push.mjs <staging|prod>");
  process.exit(1);
}

const projectRef = process.env[envName];
if (!projectRef) {
  console.error(`Missing ${envName}. Set it before running this command.`);
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

await run("npx", ["--yes", "supabase", "link", "--project-ref", projectRef]);
await run("npx", ["--yes", "supabase", "db", "push"]);
