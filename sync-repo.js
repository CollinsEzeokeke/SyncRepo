#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import inquirer from "inquirer";
import simpleGit from "simple-git";
import ignore from "ignore";

const CONFIG_FILE = ".repo-sync.json";

/**
 * Utility to calculate simple hash of file contents for change detection
 */
async function getFileHash(filePath) {
  const crypto = await import("crypto");
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha1").update(data).digest("hex");
}

/**
 * Load and parse .gitignore file from directory
 */
async function loadGitignore(dir) {
  const gitignorePath = path.join(dir, '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const ig = ignore().add(content);
    // Always ignore .git directory
    ig.add('.git');
    return ig;
  }
  // Default patterns even without .gitignore
  return ignore().add(['.git']);
}

/**
 * Recursively list files in a directory
 */
async function listFiles(dir, gitignoreFilter) {
  const files = [];
  async function walk(current) {
    const items = await fs.readdir(current);
    for (const item of items) {
      const full = path.join(current, item);
      const relative = path.relative(dir, full);
      
      // Skip if ignored
      if (gitignoreFilter.ignores(relative)) {
        continue;
      }
      
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        await walk(full);
      } else {
        files.push(full);
      }
    }
  }
  await walk(dir);
  return files;
}

/**
 * Copy changed or new files from source → destination
 */
async function syncDirs(source, dest) {
  const gitignoreFilter = await loadGitignore(source);
  const srcFiles = await listFiles(source, gitignoreFilter);
  let changes = [];

  for (const file of srcFiles) {
    const rel = path.relative(source, file);
    const destFile = path.join(dest, rel);

    const srcHash = await getFileHash(file);
    let destHash = null;

    if (await fs.pathExists(destFile)) {
      destHash = await getFileHash(destFile);
    }

    if (srcHash !== destHash) {
      await fs.ensureDir(path.dirname(destFile));
      await fs.copy(file, destFile);
      changes.push(rel);
    }
  }

  return changes;
}

/**
 * Main function
 */
async function main() {
  let config = {};

  if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(await fs.readFile(CONFIG_FILE, "utf-8"));
    console.log("✅ Existing sync configuration found.");
  } else {
    console.log("🆕 No sync configuration found. Let's set it up.");
    const answers = await inquirer.prompt([
      { type: "input", name: "repoA", message: "Enter path to source repo (Repo A):" },
      { type: "input", name: "repoB", message: "Enter path to destination repo (Repo B):" },
    ]);

    config.repoA = path.resolve(answers.repoA);
    config.repoB = path.resolve(answers.repoB);

    // Ensure repoB directory exists
    if (!(await fs.pathExists(config.repoB))) {
      await fs.mkdirp(config.repoB);
      console.log("📂 Created Repo B directory:", config.repoB);
    }

    // Check if repoB is a git repository, initialize if not
    const gitB = simpleGit(config.repoB);
    try {
      await gitB.status();
    } catch (error) {
      // Not a git repository, initialize it
      await gitB.init();
      console.log("📂 Initialized Repo B as Git repository:", config.repoB);
    }

    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log("📝 Configuration saved to", CONFIG_FILE);
  }

  const repoA = config.repoA;
  const repoB = config.repoB;

  // Ensure repoB is a git repository (for existing configs too)
  const gitB = simpleGit(repoB);
  try {
    await gitB.status();
  } catch (error) {
    // Not a git repository, initialize it
    await gitB.init();
    console.log("📂 Initialized Repo B as Git repository:", repoB);
  }

  console.log(`🔍 Checking for changes between:\nA: ${repoA}\nB: ${repoB}`);

  const changes = await syncDirs(repoA, repoB);

  if (changes.length > 0) {
    console.log(`⚙️  Synced ${changes.length} file(s):`);
    changes.forEach(f => console.log("   -", f));

    // Ask user how to commit
    const { commitType } = await inquirer.prompt([
      {
        type: "list",
        name: "commitType",
        message: "Do you want to enter a custom commit message or use Repo A's latest commit message?",
        choices: ["Enter custom message", "Use Repo A's latest commit message"],
      },
    ]);

    let commitMessage;

    if (commitType === "Enter custom message") {
      const { customMessage } = await inquirer.prompt([
        {
          type: "input",
          name: "customMessage",
          message: "Enter your commit message:",
          validate: input => input.trim() !== "" || "Commit message cannot be empty",
        },
      ]);
      commitMessage = customMessage;
    } else {
      // Fetch latest commit message from Repo A
      const gitA = simpleGit(repoA);
      const log = await gitA.log({ n: 1 });
      commitMessage = log.latest ? log.latest.message : "Synced changes from Repo A";
    }

    const gitB = simpleGit(repoB);
    await gitB.add(".");
    await gitB.commit(commitMessage);

    console.log(`💾 Changes committed to Repo B with message:\n"${commitMessage}"`);
  } else {
    console.log("✅ No changes detected. Repos are already in sync.");
  }
}

main().catch(err => console.error("❌ Error:", err));
