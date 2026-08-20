# Package Config Format

This document describes the `package.json` format used as the extension packaging config.

The config is intentionally explicit. A packaging script should not guess what to build. It should receive an action name, find that action in `actions`, read the target names listed by the action, then build only those targets from `targets`.

## Shape

```json
{
  "schema": 1,
  "source": "addon",
  "output": "build",
  "actions": [],
  "common": [],
  "targets": {}
}
```

## `schema`

Required.

The config format version. Only version `1` is currently defined.

```json
"schema": 1
```

If a script receives an unknown schema version, it must stop with an error.

## `source`

Required.

The source directory for the extension files. All paths in `common`, `targets.*.manifest`, and `targets.*.files` are resolved relative to this directory.

```json
"source": "addon"
```

Example source paths:

```text
addon/icons
addon/scripts/background-firefox.js
addon/manifest.firefox.json
```

## `output`

Required.

The root directory for generated build results. Target output directories and optional bundle files are created inside this directory.

```json
"output": "build"
```

Example result:

```text
build/firefox/
build/chrome/
build/extra-sounds-firefox.zip
build/extra-sounds-chrome.zip
```

## `actions`

Required.

The list of allowed command-line actions. Each action is a two-item array:

```json
["action name", ["target-1", "target-2"]]
```

Example:

```json
"actions": [
  ["firefox", ["firefox"]],
  ["chrome", ["chrome"]],
  ["all", ["firefox", "chrome"]]
]
```

A script must build through this list:

1. Read the action name from the command-line argument.
2. Find a matching action in `actions`.
3. Read the target list from the second item.
4. Resolve each target name in `targets`.
5. Build only those targets.

If the action is not found, the script must not build anything. It should print the available actions.

If an action references a target that does not exist in `targets`, the config is invalid.

Action names must be unique.

## Command output

The script prints when the selected action starts, when each target starts and completes, and how long the action took.

```text
action firefox: started
  target firefox: started
  target firefox: done in 42 ms
action firefox: done in 43 ms
```

Generated paths are shown only when the `--show` or `-s` option is passed:

```text
py build.py firefox --show
```

The detailed block is named `Outputs` and contains target directories and bundle files.

## `common`

Optional.

Files and directories copied into every target.

If omitted, it behaves like an empty list:

```json
"common": []
```

Each entry can be either a string or a two-item array.

A string:

```json
"icons"
```

copies the source path to the same relative target path:

```text
addon/icons -> build/<target output>/icons
```

A two-item array:

```json
["scripts/audio-firefox-safe.js", "scripts/audio.js"]
```

copies the first path to the second path:

```text
addon/scripts/audio-firefox-safe.js -> build/<target output>/scripts/audio.js
```

In the array form:

- the first item is the source path inside `source`;
- the second item is the destination path inside the target output directory.

## `targets`

Required.

An object containing target definitions. The object key is the target name referenced by `actions`.

```json
"targets": {
  "firefox": {},
  "chrome": {}
}
```

A target is not built just because it exists in `targets`. It is built only when the selected action references it.

## `targets.*.output`

Required.

The output directory for this target inside the root `output` directory.

```json
"output": "firefox"
```

Example:

```text
build/firefox/
```

The root `output` field defines the build root. The target `output` field defines the target-specific subdirectory.

## `targets.*.common`

Optional.

Controls whether this target receives files from the root `common` list.

```json
"common": false
```

Allowed values are `true` and `false`.

If omitted, the value is treated as `true`.

Examples:

```json
{
  "output": "firefox",
  "manifest": "manifest.firefox.json"
}
```

This target receives root `common` files.

```json
{
  "output": "firefox-minimal",
  "common": false,
  "manifest": "manifest.firefox.json"
}
```

This target does not receive root `common` files.

The root `common` field is a list of shared files. The target `common` field is a boolean switch for that list.

## `targets.*.manifest`

Required.

The manifest file for this target. It is copied to the root of the target output directory as `manifest.json`.

```json
"manifest": "manifest.firefox.json"
```

Example:

```text
addon/manifest.firefox.json -> build/firefox/manifest.json
```

## `targets.*.bundle`

Optional.

The output bundle file name. If this field exists, the script should create a zip file from the contents of the target output directory.

```json
"bundle": "extra-sounds-firefox.zip"
```

Example:

```text
build/firefox/ -> build/extra-sounds-firefox.zip
```

If `bundle` is omitted, the script should only create the unpacked target directory.

## `targets.*.files`

Optional.

Files and directories specific to this target. Entries use the same format as `common`.

A string:

```json
"scripts/offscreen.js"
```

copies:

```text
addon/scripts/offscreen.js -> build/chrome/scripts/offscreen.js
```

A two-item array:

```json
["scripts/service-worker-chrome.js", "scripts/background.js"]
```

copies:

```text
addon/scripts/service-worker-chrome.js -> build/chrome/scripts/background.js
```

Files from `targets.*.files` are copied after `common`. If a destination path already exists, the target-specific file replaces the common file.

## File Entry Format

The same file entry format is used in `common` and `targets.*.files`.

String form:

```json
"path/in/source"
```

Meaning:

```text
source/path/in/source -> output/<target output>/path/in/source
```

Array form:

```json
["path/in/source", "path/in/target"]
```

Meaning:

```text
source/path/in/source -> output/<target output>/path/in/target
```

No other entry formats are valid.

## Target Build Order

For each target, the script should:

1. Remove the old target output directory.
2. Create a fresh target output directory.
3. Copy every entry from `common`, unless `targets.*.common` is `false`.
4. Copy every entry from `targets.*.files`, if present.
5. Copy `targets.*.manifest` as `manifest.json`.
6. If `targets.*.bundle` exists, create a zip file from the target output directory contents.

## Validation

A script should treat the following as errors:

- unknown `schema`;
- missing required field;
- duplicate action name;
- unknown action name;
- action referencing a missing target;
- path escaping `source` or `output`;
- file entry that is not a string or a two-item string array;
- missing source file or directory;
- invalid target definition;
- invalid target `common` value;
- invalid manifest path;
- invalid bundle name;
- two file entries writing different sources to the same destination unless the later replacement is intentional by build order.

## Full Example

```json
{
  "schema": 1,
  "source": "addon",
  "output": "build",
  "actions": [
    ["firefox", ["firefox"]],
    ["chrome", ["chrome"]],
    ["all", ["firefox", "chrome"]]
  ],
  "common": [
    "icons",
    "_locales",
    "options",
    "sounds",
    "scripts/audio.js"
  ],
  "targets": {
    "firefox": {
      "output": "firefox",
      "manifest": "manifest.firefox.json",
      "bundle": "extra-sounds-firefox.zip",
      "files": [
        ["scripts/background-firefox.js", "scripts/background.js"]
      ]
    },
    "chrome": {
      "output": "chrome",
      "manifest": "manifest.chrome.json",
      "bundle": "extra-sounds-chrome.zip",
      "files": [
        ["scripts/service-worker-chrome.js", "scripts/background.js"],
        "scripts/offscreen.html",
        "scripts/offscreen.js"
      ]
    }
  }
}
```
