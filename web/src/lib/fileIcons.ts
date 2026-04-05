import type { LucideIcon } from "lucide-react";
import {
  FileCode,
  FileText,
  Globe,
  Paintbrush,
  Braces,
  Settings,
  BookOpen,
  Database,
  Terminal,
  Image,
} from "lucide-react";

interface FileIconInfo {
  icon: LucideIcon;
  className: string;
}

const extensionMap: Record<string, FileIconInfo> = {
  // JavaScript / TypeScript
  js: { icon: FileCode, className: "text-yellow-400" },
  jsx: { icon: FileCode, className: "text-yellow-400" },
  ts: { icon: FileCode, className: "text-yellow-400" },
  tsx: { icon: FileCode, className: "text-yellow-400" },
  // Java
  java: { icon: FileCode, className: "text-orange-500" },
  // Python
  py: { icon: FileCode, className: "text-blue-400" },
  // Go
  go: { icon: FileCode, className: "text-cyan-400" },
  // Rust
  rs: { icon: FileCode, className: "text-orange-400" },
  // C / C++
  c: { icon: FileCode, className: "text-blue-500" },
  h: { icon: FileCode, className: "text-blue-500" },
  cpp: { icon: FileCode, className: "text-blue-500" },
  cc: { icon: FileCode, className: "text-blue-500" },
  cxx: { icon: FileCode, className: "text-blue-500" },
  hpp: { icon: FileCode, className: "text-blue-500" },
  // C#
  cs: { icon: FileCode, className: "text-purple-400" },
  // Ruby
  rb: { icon: FileCode, className: "text-red-400" },
  // Kotlin / Gradle
  kt: { icon: FileCode, className: "text-purple-500" },
  kts: { icon: FileCode, className: "text-purple-500" },
  gradle: { icon: FileCode, className: "text-purple-500" },
  // Swift
  swift: { icon: FileCode, className: "text-orange-500" },
  // Web
  html: { icon: Globe, className: "text-orange-500" },
  htm: { icon: Globe, className: "text-orange-500" },
  css: { icon: Paintbrush, className: "text-blue-400" },
  scss: { icon: Paintbrush, className: "text-blue-400" },
  // Data / Config
  json: { icon: Braces, className: "text-yellow-500" },
  yml: { icon: Settings, className: "text-gray-400" },
  yaml: { icon: Settings, className: "text-gray-400" },
  toml: { icon: Settings, className: "text-gray-400" },
  xml: { icon: FileCode, className: "text-orange-300" },
  // Markdown
  md: { icon: BookOpen, className: "text-blue-300" },
  // SQL
  sql: { icon: Database, className: "text-blue-400" },
  // Shell
  sh: { icon: Terminal, className: "text-green-400" },
  bash: { icon: Terminal, className: "text-green-400" },
  // Images
  png: { icon: Image, className: "text-pink-400" },
  jpg: { icon: Image, className: "text-pink-400" },
  jpeg: { icon: Image, className: "text-pink-400" },
  gif: { icon: Image, className: "text-pink-400" },
  svg: { icon: Image, className: "text-pink-400" },
  ico: { icon: Image, className: "text-pink-400" },
  webp: { icon: Image, className: "text-pink-400" },
  bmp: { icon: Image, className: "text-pink-400" },
};

const specialNameMap: Record<string, FileIconInfo> = {
  Dockerfile: { icon: Settings, className: "text-gray-400" },
  ".gitignore": { icon: Settings, className: "text-gray-400" },
  ".env": { icon: Settings, className: "text-gray-400" },
  ".dockerignore": { icon: Settings, className: "text-gray-400" },
};

const defaultIcon: FileIconInfo = { icon: FileText, className: "text-muted-foreground" };

export function getFileIcon(filename: string): FileIconInfo {
  // Check special filenames first
  const special = specialNameMap[filename];
  if (special) return special;

  const dot = filename.lastIndexOf(".");
  if (dot < 0) return defaultIcon;

  const ext = filename.substring(dot + 1).toLowerCase();
  return extensionMap[ext] ?? defaultIcon;
}

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "webp", "bmp",
]);

export function isImageFile(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(filename.substring(dot + 1).toLowerCase());
}
