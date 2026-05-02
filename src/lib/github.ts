// Тянет проекты с GitHub во время билда.
// На входе ничего, кроме топика, не нужно: имя проекта = имя репо,
// описание = description репо, картинки и файлы — всё что есть в дереве.

const USERNAME = import.meta.env.GITHUB_USERNAME ?? 'mbyourk1337';
const TOPIC = import.meta.env.PORTFOLIO_TOPIC ?? 'portfolio-project';
const TOKEN = import.meta.env.GITHUB_TOKEN;

const API = 'https://api.github.com';

export type FileType =
  | 'pdf'
  | 'docx'
  | 'archive'
  | 'model'
  | 'image'
  | 'video'
  | 'other';

const EXT_TO_TYPE: Record<string, FileType> = {
  pdf: 'pdf',
  doc: 'docx',
  docx: 'docx',
  rtf: 'docx',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  skp: 'model',
  sldprt: 'model',
  sldasm: 'model',
  slddrw: 'model',
  step: 'model',
  stp: 'model',
  iges: 'model',
  igs: 'model',
  stl: 'model',
  obj: 'model',
  fbx: 'model',
  blend: 'model',
  rvt: 'model',
  dwg: 'model',
  dxf: 'model',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  avif: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  m4v: 'video',
  avi: 'video',
  mkv: 'video',
};

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);

// Файлы, которые НЕ показываем на странице (служебные / гитовые).
const SKIP_NAMES = new Set([
  '.gitignore',
  '.gitkeep',
  '.gitattributes',
  '.editorconfig',
  '.DS_Store',
  'Thumbs.db',
]);
const SKIP_PREFIXES = ['.github/', '.vscode/', '.idea/'];

export interface ProjectImage {
  path: string;
  url: string;
  alt: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  type: FileType;
  size: number;
  sizeLabel: string;
  url: string;
  viewUrl: string;
}

export interface Project {
  slug: string;
  repo: string;
  title: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
  updatedAt: string;
  images: ProjectImage[];
  files: ProjectFile[];
}

interface RepoSearchResult {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  updated_at: string;
  topics: string[];
}

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portfolio-master-builder',
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

function ext(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function fmtSize(b: number | undefined): string {
  if (!b && b !== 0) return '';
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} МБ`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

function prettifyName(repo: string): string {
  // motor-mount-or → "Motor mount or" (только заменяет разделители)
  const s = repo.replace(/[-_]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : repo;
}

function shouldSkip(path: string): boolean {
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return true;
  const name = basename(path);
  if (SKIP_NAMES.has(name)) return true;
  if (/^README\.[a-z]+$/i.test(name)) return true;
  if (/^LICENSE(\.[a-z]+)?$/i.test(name)) return true;
  return false;
}

async function searchRepos(): Promise<RepoSearchResult[]> {
  const q = encodeURIComponent(`user:${USERNAME} topic:${TOPIC} fork:false`);
  const res = await fetch(`${API}/search/repositories?q=${q}&per_page=100`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`GitHub search failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { items: RepoSearchResult[] };
  return json.items;
}

async function fetchTree(repo: RepoSearchResult): Promise<TreeEntry[]> {
  const url = `${API}/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.warn(`[skip tree] ${repo.full_name}: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as {
    tree: TreeEntry[];
    truncated: boolean;
  };
  if (json.truncated) {
    console.warn(`[truncated] ${repo.full_name}: tree больше лимита, часть файлов не попадёт`);
  }
  return json.tree.filter((e) => e.type === 'blob');
}

// Корневые файлы метаданных. Регистр игнорируется, расширение опционально.
const DESC_RE = /^desc(\.(md|txt))?$/i;
const NAME_RE = /^name(\.(md|txt))?$/i;

async function fetchText(rawBase: string, path: string): Promise<string | null> {
  const res = await fetch(`${rawBase}/${path}`, { headers: headers() });
  if (!res.ok) return null;
  const text = await res.text();
  return text.trim() || null;
}

function firstLine(s: string): string {
  return s.split(/\r?\n/, 1)[0].trim();
}

export async function loadProjects(): Promise<Project[]> {
  const repos = await searchRepos();
  const projects: Project[] = [];

  for (const repo of repos) {
    const tree = await fetchTree(repo);
    const rawBase = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}`;
    const blobBase = `${repo.html_url}/blob/${repo.default_branch}`;

    // Название: первая строка файла name / name.md / name.txt — иначе
    // причёсанное имя репо. Описание: содержимое файла desc / desc.md / desc.txt
    // целиком — иначе фолбэк на About.
    const nameEntry = tree.find((e) => NAME_RE.test(e.path));
    const descEntry = tree.find((e) => DESC_RE.test(e.path));

    const nameContent = nameEntry ? await fetchText(rawBase, nameEntry.path) : null;
    const descContent = descEntry ? await fetchText(rawBase, descEntry.path) : null;

    const title = nameContent ? firstLine(nameContent) : prettifyName(repo.name);
    const description = descContent ?? repo.description ?? '';

    const images: ProjectImage[] = [];
    const files: ProjectFile[] = [];

    for (const entry of tree) {
      if (shouldSkip(entry.path)) continue;
      if (nameEntry && entry.path === nameEntry.path) continue;
      if (descEntry && entry.path === descEntry.path) continue;
      const e = ext(entry.path);
      if (IMAGE_EXTS.has(e)) {
        images.push({
          path: entry.path,
          url: `${rawBase}/${entry.path}`,
          alt: basename(entry.path),
        });
      } else {
        files.push({
          path: entry.path,
          name: basename(entry.path),
          type: EXT_TO_TYPE[e] ?? 'other',
          size: entry.size ?? 0,
          sizeLabel: fmtSize(entry.size),
          url: `${rawBase}/${entry.path}`,
          viewUrl: `${blobBase}/${entry.path}`,
        });
      }
    }

    images.sort((a, b) => a.path.localeCompare(b.path));
    files.sort((a, b) => a.path.localeCompare(b.path));

    projects.push({
      slug: repo.name,
      repo: repo.name,
      title,
      description,
      repoUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      images,
      files,
    });
  }

  // Сортировка: свежее обновлённые — выше.
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return projects;
}
