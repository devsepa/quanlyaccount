# Verification

Run with Node.js (no dependencies):

    node --test tests/*.test.cjs

Coverage: input/date validation, duplicate detection helpers, versioned backups, backup preview and restore, failed storage, import metadata, cloud save/error/offline state, and floating-panel geometry.

Tests use synthetic data and mocked requests. They do not contact production Firebase or change its rules.

Physical iPhone/Android checks remain required: menu and notifications, keyboard/name/account inputs, copy, delete confirmation, and Safari Add to Home Screen. Browser automation could not run in the current sandbox; permission to run it outside the sandbox was not granted.

Safari icon changes should be checked after deploying all new assets and adding a fresh Home Screen shortcut; an existing shortcut may retain its previous icon.
