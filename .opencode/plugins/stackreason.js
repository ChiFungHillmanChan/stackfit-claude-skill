/**
 * stackreason plugin for OpenCode.ai
 *
 * Registers the skills directory so OpenCode discovers all five skills.
 *
 * Deliberately smaller than it could be. Some skill plugins also inject a
 * bootstrap message telling the agent to read a "start here" skill on every
 * session. stackreason does not need that: each skill's frontmatter
 * description carries its own trigger phrases, so the harness loads the right
 * one when the user asks about system design. Injecting context every session
 * would spend tokens on every conversation to serve the small fraction that
 * are about architecture.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .opencode/plugins/ -> repo root
const pluginRoot = path.resolve(__dirname, '..', '..');
const skillsDir = path.join(pluginRoot, 'skills');

export const StackreasonPlugin = async () => {
  // Fail loudly rather than silently registering a path that does not exist.
  // A skills directory that is quietly absent looks identical to a harness
  // that ignores the plugin, and that is a miserable thing to debug.
  if (!fs.existsSync(skillsDir)) {
    console.error(
      `[stackreason] skills directory not found at ${skillsDir}. ` +
      `The plugin file must stay inside the cloned repository.`
    );
    return {};
  }

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
    },
  };
};

export default StackreasonPlugin;
