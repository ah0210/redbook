#!/usr/bin/env node
/**
 * Post-install script for redbook CLI.
 *
 * Sets up Claude Code skill by creating a symlink:
 *   ~/.claude/skills/redbook -> <npm-package-location>
 *
 * This gives Claude Code a /redbook slash command automatically.
 */

import { existsSync, mkdirSync, unlinkSync, symlinkSync, lstatSync, readlinkSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_ROOT = join(__dirname, '..');
const SKILL_DIR = join(homedir(), '.claude', 'skills');
const SKILL_LINK = join(SKILL_DIR, 'redbook');

function setupClaudeSkill() {
  try {
    if (!existsSync(SKILL_DIR)) {
      mkdirSync(SKILL_DIR, { recursive: true });
    }

    if (existsSync(SKILL_LINK)) {
      try {
        const stats = lstatSync(SKILL_LINK);
        if (stats.isSymbolicLink()) {
          const currentTarget = readlinkSync(SKILL_LINK);
          if (currentTarget === PACKAGE_ROOT) {
            console.log('[redbook] Claude Code skill already configured.');
            return true;
          }
          unlinkSync(SKILL_LINK);
        } else {
          rmSync(SKILL_LINK, { recursive: true });
        }
      } catch (err) {
        console.log(`[redbook] Warning: ${err.message}`);
      }
    }

    symlinkSync(PACKAGE_ROOT, SKILL_LINK);
    console.log('[redbook] Claude Code skill installed:');
    console.log(`[redbook]   ~/.claude/skills/redbook -> ${PACKAGE_ROOT}`);
    return true;
  } catch (error) {
    console.error(`[redbook] Failed to set up skill: ${error.message}`);
    console.log('[redbook] You can manually create the symlink:');
    console.log(`[redbook]   ln -s "${PACKAGE_ROOT}" "${SKILL_LINK}"`);
    return false;
  }
}

function main() {
  console.log('[redbook] Running post-install...');
  const success = setupClaudeSkill();
  console.log('');
  console.log('[redbook] Installation complete!');
  if (success) {
    console.log('[redbook] Use /redbook in Claude Code, or run: redbook --help');
  }
}

main();
