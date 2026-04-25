#!/usr/bin/env python3
"""
Anthropic API checkpoint runner with tool use.

The auto-update.sh checkpoints (A/B/C) prompt the model to inspect git state,
SQLite tables, env vars, and run logs before deciding GO/CAUTION/STOP. The
Claude Code CLI path could execute these reads via its built-in Bash tool.
The plain /v1/messages text-completion API path could not — it returned
"I cannot execute commands" and emitted STOP.

This script wraps the API call in a tool-use loop:
  1. Send the checkpoint prompt + a tools spec (bash, read_file).
  2. If the response contains tool_use blocks, execute them locally,
     send tool_results back, repeat.
  3. When the model emits text only (no more tool_use), print that text
     to stdout and exit.

Usage: checkpoint-runner.py <label> <prompt-file>
Env:   ANTHROPIC_API_KEY (required), CLAUDE_API_MODEL (optional, default opus-4-7)
Exit:  0 on model response received, 2 on API/parse error.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = os.environ.get("CLAUDE_API_MODEL", "claude-opus-4-7")
WORKING_DIR = "/home/ubuntu/Sports-Bar-TV-Controller"
MAX_TURNS = 15
TOOL_TIMEOUT_SEC = 60
TOOL_OUTPUT_CAP_BYTES = 65536

TOOLS = [
    {
        "name": "bash",
        "description": (
            "Run a shell command on the server (cwd is the repo root). "
            "Returns stdout+stderr (capped at 64 KB) and exit code. "
            "Use for git, sqlite3, grep, head, ls, env inspection."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute"}
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file from disk (up to 64 KB). Use for inspecting CLAUDE.md, .env, log tails, JSON state files.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to the file"}
            },
            "required": ["path"],
        },
    },
]


def run_bash(cmd: str) -> str:
    try:
        result = subprocess.run(
            ["bash", "-lc", cmd],
            cwd=WORKING_DIR,
            capture_output=True,
            text=True,
            timeout=TOOL_TIMEOUT_SEC,
        )
        body = (result.stdout or "") + (result.stderr or "")
        return f"exit={result.returncode}\n{body[:TOOL_OUTPUT_CAP_BYTES]}"
    except subprocess.TimeoutExpired:
        return f"exit=124\nTimeout after {TOOL_TIMEOUT_SEC}s"
    except Exception as e:
        return f"exit=255\nError: {e}"


def read_file(path: str) -> str:
    try:
        with open(path, "rb") as f:
            return f.read(TOOL_OUTPUT_CAP_BYTES).decode("utf-8", errors="replace")
    except Exception as e:
        return f"Error: {e}"


def call_api(messages):
    payload = {
        "model": MODEL,
        "max_tokens": 4096,
        "tools": TOOLS,
        "messages": messages,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-api-key": os.environ["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.stderr.write(f"HTTP {e.code}: {body[:1000]}\n")
        sys.exit(2)
    except Exception as e:
        sys.stderr.write(f"API call failed: {e}\n")
        sys.exit(2)


def execute_tool(name: str, inp: dict) -> str:
    if name == "bash":
        return run_bash(inp.get("command", ""))
    if name == "read_file":
        return read_file(inp.get("path", ""))
    return f"Unknown tool: {name}"


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: checkpoint-runner.py <label> <prompt-file>")
    label, prompt_file = sys.argv[1], sys.argv[2]
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.stderr.write("ANTHROPIC_API_KEY not set\n")
        sys.exit(2)
    with open(prompt_file) as f:
        prompt = f.read()
    messages = [{"role": "user", "content": prompt}]
    final_text_blocks = []
    for turn in range(MAX_TURNS):
        resp = call_api(messages)
        content = resp.get("content", [])
        messages.append({"role": "assistant", "content": content})
        tool_uses = [b for b in content if b.get("type") == "tool_use"]
        final_text_blocks = [b.get("text", "") for b in content if b.get("type") == "text"]
        stop_reason = resp.get("stop_reason")
        sys.stderr.write(f"[checkpoint-runner:{label}] turn={turn + 1} stop_reason={stop_reason} tool_uses={len(tool_uses)}\n")
        if stop_reason == "end_turn" and not tool_uses:
            print("\n".join(final_text_blocks))
            return
        if tool_uses:
            tool_results = []
            for tu in tool_uses:
                name = tu.get("name", "")
                inp = tu.get("input", {})
                summary = json.dumps(inp)[:120]
                sys.stderr.write(f"[checkpoint-runner:{label}]   tool={name} input={summary}\n")
                result = execute_tool(name, inp)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.get("id"),
                    "content": result,
                })
            messages.append({"role": "user", "content": tool_results})
        else:
            # Model returned text + non-end_turn (e.g. max_tokens). Bail out
            # with what we have so DECISION parsing can still work.
            print("\n".join(final_text_blocks))
            return
    sys.stderr.write(f"[checkpoint-runner:{label}] hit MAX_TURNS={MAX_TURNS}, returning last text\n")
    print("\n".join(final_text_blocks))


if __name__ == "__main__":
    main()
