import { existsSync, readFileSync } from "node:fs";

export function loadLocalEnv(paths = [".env"]) {
  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }

    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const entry = parseEnvLine(line);
      if (!entry || process.env[entry.key] !== undefined) {
        continue;
      }

      process.env[entry.key] = entry.value;
    }
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  return {
    key,
    value: unquote(rawValue)
  };
}

function unquote(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
