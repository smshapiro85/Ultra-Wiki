/**
 * Maps file extensions and filenames to shiki language identifiers
 * for syntax highlighting in the code viewer dialog.
 */

const EXT_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  mdx: "mdx",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  xml: "xml",
  svg: "xml",
  graphql: "graphql",
  gql: "graphql",
  prisma: "prisma",
  dockerfile: "dockerfile",
  env: "dotenv",
  ini: "ini",
  conf: "ini",
  lua: "lua",
  r: "r",
  php: "php",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  tf: "hcl",
  hcl: "hcl",
  zig: "zig",
  elixir: "elixir",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  clj: "clojure",
  scala: "scala",
  dart: "dart",
  groovy: "groovy",
  pl: "perl",
  makefile: "makefile",
};

const FILENAME_MAP: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  ".env": "dotenv",
  ".env.local": "dotenv",
  ".env.example": "dotenv",
  ".gitignore": "gitignore",
  ".dockerignore": "gitignore",
  ".editorconfig": "ini",
  "tsconfig.json": "jsonc",
  "package.json": "json",
};

/**
 * Infer a shiki language identifier from a file path.
 * First checks exact filename matches (e.g., Dockerfile, Makefile),
 * then falls back to extension mapping. Returns "text" for unknown types.
 */
export function inferLanguage(filePath: string): string {
  const segments = filePath.split("/");
  const filename = segments[segments.length - 1];

  // Check exact filename match first
  if (FILENAME_MAP[filename]) {
    return FILENAME_MAP[filename];
  }

  // Extract extension (lowercase)
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    return "text";
  }

  const ext = filename.slice(dotIndex + 1).toLowerCase();
  return EXT_MAP[ext] ?? "text";
}
