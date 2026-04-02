# OrnnSkills - Skill Evolution Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/ornn-skills.svg)](https://www.npmjs.com/package/ornn-skills)

[English](README.md) | [中文](README.zh-CN.md)

OrnnSkills is a background meta-agent that does not replace the main agent to execute tasks. Instead, it continuously observes the real execution of the main agent and maintains a shadow copy of skills from the global Skill registry for each project. It then performs small-step, automatic, and rollback-able continuous optimization on this shadow copy based on execution traces.

## Core Features

- 🔍 **Smart Observation**: Collect execution traces from Agents like Codex/OpenCode/Claude
- 🎯 **Precise Mapping**: Intelligently map traces to corresponding skills with 6 mapping strategies
- 🔄 **Automatic Optimization**: Automatically optimize skills based on real execution data
- 📦 **Shadow Copy**: Maintain independent skill copies for each project without polluting the global registry
- 🔙 **Rollback Support**: All modifications have evolution logs and checkpoints, supporting one-click rollback
- 🚀 **Seamless Operation**: Runs automatically in the background without manual intervention

## Installation

```bash
npm install -g ornn-skills
```

## Quick Start

### Prerequisites

Before using OrnnSkills, make sure you have:
- Node.js 18+ installed
- An Agent (Codex/OpenCode/Claude) running in your project

### 1. Navigate to Your Project Directory

```bash
cd /path/to/your/project
```

OrnnSkills works on a per-project basis, so you need to run it in your project directory.

### 2. Initialize Configuration

```bash
ornn init
```

This will:
- Create `.ornn/` directory in your project
- Generate default configuration files
- Scan and register global skills

### 3. Start the Daemon

```bash
ornn start
```

This starts the background daemon that will:
- Monitor your Agent's execution traces
- Automatically optimize skills based on real usage
- Run continuously in the background

### 4. Check Status

```bash
ornn status
```

View the current status of the daemon and shadow skills.

### 5. Stop the Daemon

```bash
ornn stop
```

Stop the background daemon when you're done.

### Advanced Operations

#### View Evolution Log

```bash
ornn skills log <skill-id>
```

#### Rollback to a Specific Version

```bash
ornn skills rollback <skill-id> --to rev_8
```

#### Freeze/Unfreeze Automatic Optimization

```bash
ornn skills freeze <skill-id>
ornn skills unfreeze <skill-id>
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Agent Runtime                       │
│                  (Codex/OpenCode/Claude)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TraceSkillObserver                        │
│  - Listen to trace events                                     │
│  - Real-time mapping of traces to skills                      │
│  - Aggregate traces by skill                                  │
│  - Trigger evaluation callbacks                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TraceSkillMapper                          │
│  - 6 mapping strategies                                       │
│  - Path extraction                                            │
│  - Semantic inference                                         │
│  - Confidence calculation                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  OptimizationPipeline                        │
│  - Get traces grouped by skill                                │
│  - Call Evaluator for assessment                              │
│  - Generate optimization tasks                                │
│  - Trigger Patch Generator                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Shadow Skill Manager                          │
│  ├─ Origin Registry (Global skill scanning)                   │
│  ├─ Shadow Registry (Project skill management)                │
│  ├─ Evolution Evaluator (Optimization assessment)             │
│  ├─ Patch Generator (Patch generation)                        │
│  └─ Journal Manager (Evolution logs)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Project Shadow Skills (.ornn/skills/*)
```

### Trace-Skill Mapping

The system uses 6 strategies to map traces to corresponding skills:

| Strategy | Trigger Condition | Confidence | Description |
|----------|-------------------|------------|-------------|
| Strategy 1 | `tool_call` reads skill file | 0.95 | Most reliable mapping method |
| Strategy 2 | `tool_call` executes skill-related operations | 0.85 | Inferred from tool parameters |
| Strategy 3 | `file_change` modifies skill file | 0.9 | File changes clearly point to skill |
| Strategy 4 | `metadata` contains skill_id | 0.98 | Explicit skill identifier |
| Strategy 5 | `assistant_output` references skill | 0.6 | Inferred from output content |
| Strategy 6 | `user_input` requests skill | 0.5 | Inferred from user input |

### Automatic Optimization Loop

The system implements a complete automatic optimization loop:

1. **Trace Collection**: Collect execution traces from Agent runtime
2. **Trace-Skill Mapping**: Intelligently map traces to corresponding skills
3. **Evaluation**: Analyze trace patterns and identify optimization opportunities
4. **Task Generation**: Create optimization tasks
5. **Optimization Execution**: Apply patches to shadow skills
6. **Log Recording**: Save evolution history and snapshots

### Configuration

#### Trace-Skill Mapping Configuration

```toml
[mapper]
min_confidence = 0.5  # Minimum confidence threshold
persist_mappings = true  # Whether to save mapping relationships to database

[observer]
buffer_size = 10  # Buffer size
flush_interval = 5000  # Periodic flush interval (milliseconds)

[pipeline]
auto_optimize = true  # Whether to enable automatic optimization
min_confidence = 0.7  # Minimum confidence for optimization tasks
```

## Project Structure

```
your-project/
└── .ornn/
    ├── skills/
    │   └── <skill-id>/
    │       ├── current.md      # Current shadow skill content
    │       ├── meta.json       # Metadata
    │       ├── journal.ndjson  # Evolution logs
    │       └── snapshots/      # Snapshots
    │           ├── rev_0005.md
    │           └── rev_0010.md
    ├── state/
    │   ├── sessions.db         # SQLite database
    │   ├── traces.ndjson       # Raw traces
    │   └── runtime_state.json  # Runtime state
    └── config/
        └── settings.toml       # Project configuration
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `ornn init` | Initialize configuration |
| `ornn start` | Start the daemon in background |
| `ornn stop` | Stop the daemon |
| `ornn daemon` | Manage daemon (start, stop, status, restart) |
| `ornn logs` | View daemon logs |
| `ornn config` | Manage configuration |
| `ornn completion` | Generate shell completion script |
| `ornn skills status` | View current project shadow skills status |
| `ornn skills log <skill>` | View evolution log for a skill |
| `ornn skills diff <skill>` | View diff between current content and origin |
| `ornn skills rollback <skill> --to <rev>` | Rollback to specified revision |
| `ornn skills freeze <skill>` | Pause automatic optimization for a skill |
| `ornn skills unfreeze <skill>` | Resume automatic optimization |
| `ornn skills sync <skill>` | Resync with origin |
| `ornn skills preview <skill>` | Preview optimization suggestions |

## Automatic Optimization Strategies

The system automatically performs the following types of optimizations:

- ✅ **append_context**: Supplement project-specific context
- ✅ **tighten_trigger**: Tighten applicability conditions
- ✅ **add_fallback**: Add high-frequency fallback handling
- ✅ **prune_noise**: Remove low-value noise descriptions

The following operations are not automatically performed by default:

- ❌ Large-scale rewriting of entire skills
- ❌ Deleting large amounts of core steps
- ❌ Changing the overall goal of a skill
- ❌ Writing back to global origin

## Configuration

### Global Configuration (~/.ornn/settings.toml)

```toml
[origin_paths]
paths = ["~/.skills", "~/.claude/skills"]

[observer]
enabled_runtimes = ["codex", "opencode", "claude"]
trace_retention_days = 30

[evaluator]
min_signal_count = 3
min_source_sessions = 2
min_confidence = 0.7

[patch]
allowed_types = ["append_context", "tighten_trigger", "add_fallback", "prune_noise"]
cooldown_hours = 24
max_patches_per_day = 3

[journal]
snapshot_interval = 5
max_snapshots = 20

[daemon]
auto_start = true
log_level = "info"
```

### Project Configuration (.ornn/config/settings.toml)

```toml
[project]
name = "my-project"
auto_optimize = true

[skills]
# Specific skill configuration overrides
[skills.my-skill]
auto_optimize = false  # Freeze this skill
```

## Development

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run format
```

## Tech Stack

- **TypeScript**: Type-safe JavaScript
- **Node.js**: Runtime environment
- **Commander.js**: CLI framework
- **SQLite**: Local database
- **Winston**: Logging system
- **Vitest**: Testing framework

## Documentation

- [PRD - Product Requirements Document](docs/PRD.md)
- [Engineering Plan](docs/ENGINEERING_PLAN.md)
- [Trace-Skill Mapping Documentation](docs/TRACE-SKILL-MAPPING.md)
- [User Guide](USER-GUIDE.md)

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) for details.
