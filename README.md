# OrnnSkills

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/ornn-skills.svg)](https://www.npmjs.com/package/ornn-skills)

[English](README.md) | [中文](README.zh-CN.md)

OrnnSkills is a local-first dashboard for managing AI agent skills across projects and hosts.

It helps you see which skills are installed, where they are used, when they were last active, how their versions changed, and which skills are worth reviewing or improving. It is built for personal users who use tools such as Codex, Claude Code, and OpenCode and want a clear way to manage their skill library without turning it into a cloud account system or team governance platform.

## What OrnnSkills Does

OrnnSkills treats a skill as a first-class object. Instead of showing a flat list of files, it separates skill information into practical views:

- **Skill Family**: the skill as you recognize it, grouped across projects and hosts.
- **Skill Instance**: a copy of that skill inside a specific project and host.
- **Skill Version**: the editable history of a skill instance, with effective versions, disabled versions, and diffs.
- **Usage Evidence**: observed calls, analyzed touches, optimization count, project coverage, host coverage, and last-used time.

The result is a local SkillOps workspace: you can scan your local projects, browse skills, inspect real usage signals, review version history, compare content, edit safely, and keep an eye on cost and model configuration.

## Main Dashboard

Start the dashboard with:

```bash
ornn dashboard
```

By default, OrnnSkills opens a local dashboard in your browser. You can also choose a port or language:

```bash
ornn dashboard --port 47432
ornn dashboard --lang zh
ornn dashboard --no-open
```

The dashboard has four main areas: **Skills**, **Market**, **Project**, and **Config**.

### Skills

The Skills page is the main workspace for understanding your global skill library.

It shows skills as families rather than isolated files, so you can answer questions such as:

- How many projects use this skill?
- Which hosts have an instance of it?
- How many revisions exist?
- Is the skill active, idle, unused, or only partially observed?
- When was it last called?

From a skill family, you can choose a project and host instance, then inspect and edit the skill body. The editor supports:

- viewing the current effective version
- switching between versions
- comparing one version against another
- disabling or restoring a version
- saving edited content as a new version
- previewing which sibling instances would be affected before applying content across a family
- checking whether a matching marketplace version exists
- reviewing marketplace differences before applying them to your draft

When marketplace content differs from your local version, OrnnSkills presents a diff review screen. You can accept or reject individual change groups, apply all changes, reject all changes, or cancel without touching the draft.

### Market

The Market page is a lightweight directory for finding external skill sources.

It groups entries into:

- skill directories and indexes
- GitHub repositories and public collections

Each entry is a direct external link with source name, host, trust label, supported host tags, and short description. The Market page is intentionally a discovery layer: it does not scrape remote content, automatically install skills, or mix external entries into your local library without your action.

### Project

The Project page focuses on one project at a time.

It includes a project rail for registered local projects and a project picker for adding another local folder. After selecting a project, you can see:

- the skills observed in that project
- host-specific skill instances
- status, effective version, evaluation count, and last update
- search and host filtering
- paginated skill tables for larger projects

The Project page also includes a Cost view. When usage data is available, it summarizes:

- estimated spend when model pricing is known
- model-level usage
- call count
- input, output, and total tokens
- average latency
- average tokens per call
- scope-level and skill-level breakdowns
- catalog matching status for model pricing and capabilities

Cost values are estimates based on locally observed usage and the available provider catalog. When pricing is unknown, the dashboard keeps the value blank instead of inventing a number.

### Config

The Config page manages the settings that affect skill analysis and model use.

The model section supports:

- adding model providers
- choosing a provider and model
- custom provider IDs and custom model names
- API key entry with show/hide controls
- one active default provider
- connectivity checks
- LiteLLM catalog loading when available
- local safety limits for requests, concurrency, and estimated tokens

The evolution section supports prompt controls for the analysis flow:

- Skill Call Analyzer
- Decision Explainer
- Readiness Probe

For each stage, you can use the built-in prompt or provide a custom override. This makes the analysis behavior adjustable without editing skill files directly.

## CLI Workflow

The dashboard is the main product surface, while the CLI remains useful for setup, automation, and precise local operations.

### Install

```bash
npm install -g ornn-skills
```

OrnnSkills requires Node.js 18 or newer.

### Initialize a Project

Run this once in each project you want OrnnSkills to include:

```bash
cd /path/to/project
ornn init
```

Initialization creates the local OrnnSkills project state and registers the project for the dashboard and daemon.

### Run the Daemon

```bash
ornn start
ornn status
ornn stop
```

`ornn start` runs one background daemon for the registered projects. You do not need a separate daemon per project.

### Inspect and Manage Skills

```bash
ornn skills status
ornn skills status --interactive
ornn skills log <skill-id>
ornn skills diff <skill-id>
ornn skills rollback <skill-id> --to <revision>
ornn skills freeze <skill-id>
ornn skills unfreeze <skill-id>
ornn skills sync <skill-id>
ornn skills preview <skill-id>
```

These commands help you inspect local skill state, view history, compare content, pause automatic optimization for a skill, restore it, resync it, or preview a suggested change.

Useful options include:

- `--project <path>` to target a specific project
- `--runtime codex|claude|opencode` to scope a command to one host
- `--interactive` for guided skill selection
- `--dry-run` on freeze and unfreeze flows to preview the action

### Logs and Configuration

```bash
ornn logs
ornn config
ornn completion
```

`ornn logs` shows recent local OrnnSkills logs. `ornn config` opens the configuration flow. `ornn completion` generates shell completion scripts.

## Supported Hosts

OrnnSkills 0.1.12 focuses on:

- Codex
- Claude Code
- OpenCode

The dashboard can show host-specific instances and lets you filter or operate by host when the data is available.

## Local-First Data

OrnnSkills is designed around local ownership:

- project state stays under the local project’s `.ornn` directory
- global logs and registry data stay under the local user environment
- the dashboard runs on a local HTTP server
- model provider configuration is stored locally
- external market entries are links, not imported remote content

This makes OrnnSkills suitable for users who want visibility and control without sending their skill library to a hosted workspace.

## Typical Use Cases

Use OrnnSkills when you want to:

- see all skills used across multiple local projects
- understand which skills are active and which are stale
- compare skill versions before restoring or disabling one
- edit a project skill and keep a version trail
- apply a known-good skill edit to sibling instances after previewing the impact
- check whether marketplace content is different from your local copy
- inspect project-level model usage and estimated cost
- configure model providers and safety limits from a browser interface
- keep Codex, Claude Code, and OpenCode skill usage visible in one place

## License

MIT License.
