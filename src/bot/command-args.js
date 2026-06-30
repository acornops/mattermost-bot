export function commandArguments(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed.split(/\s+/).slice(1);
}

export function parseListArgs(commandArgs, allowedFilters, { allowReference = true } = {}) {
  const filters = {};
  const bare = [];

  for (const arg of commandArgs) {
    const separatorIndex = arg.indexOf("=");
    if (separatorIndex === -1) {
      bare.push(arg);
      continue;
    }

    const key = arg.slice(0, separatorIndex);
    const value = arg.slice(separatorIndex + 1);
    if (!allowedFilters.includes(key)) {
      return { error: `Unsupported filter \`${key}\`. Send \`help filters\` for supported filters.` };
    }
    filters[key] = value;
  }

  if (bare.length > 1) {
    filters.q = bare.join(" ");
    return { filters };
  }

  if (bare.length === 1) {
    if (!allowReference) {
      filters.q = bare[0];
      return { filters };
    }

    if (/^\d+$/.test(bare[0])) {
      return { filters, reference: bare[0] };
    }

    filters.q = bare[0];
  }

  return { filters };
}

export function parseTargetFilterArgs(commandArgs, allowedFilters) {
  const args = [...commandArgs];
  let hint = "";
  if (args[0] === "cluster" || args[0] === "vm") {
    hint = args.shift();
  }

  const parsed = parseListArgs(args, allowedFilters, { allowReference: false });
  if (parsed.error) {
    return parsed;
  }

  return {
    hint,
    filters: parsed.filters
  };
}
