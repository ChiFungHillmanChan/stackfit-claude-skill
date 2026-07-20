# stackreason for OpenCode

Add to the `plugin` array in your `opencode.json`, global or project-level:

```json
{
  "plugin": ["stackreason@git+https://github.com/ChiFungHillmanChan/stackreason.git"]
}
```

Restart OpenCode. The plugin registers `skills/` so all five skills are discoverable.

Verify by asking:

> What stack should I use for a booking app with 800 users?

It should start by asking you three questions rather than naming components.

## Note

OpenCode has its own plugin manager. If you also use Claude Code or Codex, install stackreason separately for each — they do not share plugin state.

## Status

**Untested.** This plugin mirrors the structure of a working OpenCode plugin, and the JavaScript is valid, but OpenCode was not installed on the machine where it was written, so it has never actually been loaded. If you try it, an issue reporting either outcome is genuinely useful.
