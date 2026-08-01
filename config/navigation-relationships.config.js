export const NavigationRelationships = Object.freeze({
  "schema": "dgo-navigation-relationships/v1",
  "primarySidebar": {
    "START_HERE": [
      "home",
      "ecm-erp-charter"
    ],
    "OPERATIONS": [
      "correspondence",
      "orchestrator"
    ],
    "CONTROL": [
      "response-tracking",
      "approvals"
    ],
    "CLOSURE": [
      "dispatch",
      "correspondence-email"
    ],
    "SYSTEM": [
      "settings"
    ]
  },
  "hiddenModules": {
    "activities": {
      "ownerWorkspace": "home",
      "entryFrom": [
        "home",
        "correspondence"
      ],
      "exitTo": [
        "correspondence",
        "orchestrator"
      ]
    },
    "registry": {
      "ownerWorkspace": "correspondence",
      "entryFrom": [
        "correspondence",
        "activities",
        "lookup"
      ],
      "exitTo": [
        "single-assignment",
        "archive"
      ]
    },
    "single-assignment": {
      "ownerWorkspace": "correspondence",
      "entryFrom": [
        "correspondence",
        "lookup",
        "acknowledgment"
      ],
      "exitTo": [
        "orchestrator",
        "response-tracking"
      ]
    },
    "bulk-assignment": {
      "ownerWorkspace": "correspondence",
      "entryFrom": [
        "activities",
        "single-assignment"
      ],
      "exitTo": [
        "orchestrator",
        "response-tracking"
      ]
    },
    "lookup": {
      "ownerWorkspace": "response-tracking",
      "entryFrom": [
        "response-tracking",
        "archive",
        "dispatch",
        "commandPalette"
      ],
      "exitTo": [
        "correspondence",
        "single-assignment",
        "orchestrator",
        "archive"
      ]
    },
    "acknowledgment": {
      "ownerWorkspace": "orchestrator",
      "entryFrom": [
        "orchestrator"
      ],
      "exitTo": [
        "orchestrator"
      ]
    },
    "comments": {
      "ownerWorkspace": "orchestrator",
      "entryFrom": [
        "orchestrator",
        "approvals",
        "dispatch"
      ],
      "exitTo": [
        "previous-module"
      ]
    },
    "fasttrack": {
      "ownerWorkspace": "response-tracking",
      "entryFrom": [
        "home",
        "response-tracking"
      ],
      "exitTo": [
        "single-assignment",
        "orchestrator",
        "response-tracking"
      ]
    },
    "executive": {
      "ownerWorkspace": "approvals",
      "entryFrom": [
        "approvals",
        "response-tracking"
      ],
      "exitTo": [
        "approvals",
        "dispatch"
      ]
    },
    "archive": {
      "ownerWorkspace": "dispatch",
      "entryFrom": [
        "dispatch",
        "registry",
        "lookup"
      ],
      "exitTo": [
        "lookup",
        "reports"
      ]
    },
    "reports": {
      "ownerWorkspace": "response-tracking",
      "entryFrom": [
        "response-tracking",
        "archive"
      ],
      "exitTo": [
        "response-tracking",
        "statistics"
      ]
    },
    "statistics": {
      "ownerWorkspace": "response-tracking",
      "entryFrom": [
        "response-tracking",
        "reports",
        "home"
      ],
      "exitTo": [
        "response-tracking",
        "reports"
      ]
    },
    "assistant": {
      "ownerWorkspace": "home",
      "entryFrom": [
        "anyModule"
      ],
      "exitTo": [
        "previous-module"
      ]
    },
    "operator-hud": {
      "ownerWorkspace": "settings",
      "entryFrom": [
        "settings",
        "diagnostics"
      ],
      "exitTo": [
        "settings",
        "diagnostics"
      ]
    },
    "diagnostics": {
      "ownerWorkspace": "settings",
      "entryFrom": [
        "settings",
        "operator-hud"
      ],
      "exitTo": [
        "settings",
        "operator-hud"
      ]
    },
    "user-admin": {
      "ownerWorkspace": "settings",
      "entryFrom": [
        "settings"
      ],
      "exitTo": [
        "settings",
        "diagnostics"
      ]
    }
  }
});
