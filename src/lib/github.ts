// Тянет проекты с GitHub во время билда.
// Раздел проекта задаётся топиком репозитория (см. src/data/sections.ts),
// название, описание и теги — файлами name / desc / tags в корне репо.

import {
  sections,
  isPortfolioRepo,
  sectionForTopics,
  type Section,
} from '../data/sections';

const USERNAME = import.meta.env.GITHUB_USERNAME ?? 'mbyourk1337';
const TOKEN = import.meta.env.GITHUB_TOKEN;

const API = 'https://api.github.com';
const MAX_TAGS = 6;

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
  tags: string[];
  /** id раздела из src/data/sections.ts */
  section: string;
  repoUrl: string;
  defaultBranch: string;
  updatedAt: string;
  images: ProjectImage[];
  files: ProjectFile[];
}

/** Раздел вместе с его проектами — то, из чего собираются главная и разделы. */
export interface SectionGroup {
  section: Section;
  projects: Project[];
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
  // Один запрос на все публичные репо аккаунта: раздел определяется по
  // топикам уже локально. Искать отдельно по каждому топику (search API
  // разрешает 30 запросов в минуту) смысла нет — при росте числа
  // направлений это лишние запросы на каждый билд.
  const q = encodeURIComponent(`user:${USERNAME} fork:false`);
  const res = await fetch(`${API}/search/repositories?q=${q}&per_page=100`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`GitHub search failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    total_count: number;
    items: RepoSearchResult[];
  };
  if (json.total_count > json.items.length) {
    console.warn(
      `[search] у аккаунта ${json.total_count} репозиториев, получено ${json.items.length} — часть проектов может не попасть на сайт`,
    );
  }
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
// Поддерживаются: name, name.txt, name.md, name.text (и Name.TXT, NAME.md и т.п.)
const DESC_RE = /^desc(\.(md|txt|text))?$/i;
const NAME_RE = /^name(\.(md|txt|text))?$/i;
const TAGS_RE = /^tags(\.(md|txt|text))?$/i;

async function fetchText(rawBase: string, path: string): Promise<string | null> {
  // Сырые файлы GitHub отдаёт без авторизации и с щедрыми лимитами,
  // поэтому токен сюда не отправляем.
  const res = await fetch(`${rawBase}/${path}`);
  if (!res.ok) return null;
  const text = await res.text();
  return text.trim() || null;
}

function firstLine(s: string): string {
  return s.split(/\r?\n/, 1)[0].trim();
}

function parseTags(text: string | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    // Разрешаем писать как чистым списком, так и маркированным.
    const tag = line.replace(/^\s*[-*•]\s*/, '').trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

async function loadProject(repo: RepoSearchResult): Promise<Project> {
  const tree = await fetchTree(repo);
  const rawBase = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}`;
  const blobBase = `${repo.html_url}/blob/${repo.default_branch}`;

  // Название: первая строка файла name / name.md / name.txt — иначе
  // причёсанное имя репо. Описание: содержимое файла desc / desc.md / desc.txt
  // целиком — иначе фолбэк на About. Теги: файл tags, по строке на тег.
  const nameEntry = tree.find((e) => NAME_RE.test(e.path));
  const descEntry = tree.find((e) => DESC_RE.test(e.path));
  const tagsEntry = tree.find((e) => TAGS_RE.test(e.path));

  const [nameContent, descContent, tagsContent] = await Promise.all([
    nameEntry ? fetchText(rawBase, nameEntry.path) : null,
    descEntry ? fetchText(rawBase, descEntry.path) : null,
    tagsEntry ? fetchText(rawBase, tagsEntry.path) : null,
  ]);

  const title = nameContent ? firstLine(nameContent) : prettifyName(repo.name);
  const description = descContent ?? repo.description ?? '';

  const serviceEntries = new Set(
    [nameEntry?.path, descEntry?.path, tagsEntry?.path].filter(Boolean) as string[],
  );

  const images: ProjectImage[] = [];
  const files: ProjectFile[] = [];

  for (const entry of tree) {
    if (serviceEntries.has(entry.path)) continue;
    if (shouldSkip(entry.path)) continue;
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

  return {
    slug: repo.name,
    repo: repo.name,
    title,
    description,
    tags: parseTags(tagsContent),
    section: sectionForTopics(repo.topics).id,
    repoUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
    images,
    files,
  };
}

async function buildPortfolio(): Promise<SectionGroup[]> {
  const repos = await searchRepos();
  const portfolioRepos = repos.filter((r) => isPortfolioRepo(r.topics));

  const projects = await Promise.all(portfolioRepos.map(loadProject));

  // Сортировка: свежее обновлённые — выше.
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return sections.map((section) => ({
    section,
    projects: projects.filter((p) => p.section === section.id),
  }));
}

// Кэш на время работы процесса: без него каждая страница заново дёргает
// GitHub API. В dev это особенно чувствительно — у search API лимит
// 30 запросов в минуту. Минус: правки в проект-репо подхватываются
// после перезапуска `npm run dev`.
let cached: Promise<SectionGroup[]> | undefined;

/** Все разделы с проектами. Разделы без проектов тоже присутствуют. */
export function loadPortfolio(): Promise<SectionGroup[]> {
  cached ??= buildPortfolio();
  return cached;
}

/** Плоский список всех проектов. */
export async function loadProjects(): Promise<Project[]> {
  const groups = await loadPortfolio();
  return groups.flatMap((g) => g.projects);
}
