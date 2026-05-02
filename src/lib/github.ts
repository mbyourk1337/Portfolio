// Подтягивает список проектов с GitHub во время build:
//   1. Ищет все публичные репо пользователя с топиком PORTFOLIO_TOPIC
//   2. Для каждого читает project.json из дефолтной ветки
//   3. Возвращает массив отсортированных проектов
//
// GITHUB_USERNAME и PORTFOLIO_TOPIC задаются в .env или GitHub Action.
// GITHUB_TOKEN опционален при локальной сборке (rate limit 60/час),
// в Action он подставляется автоматически.

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

export interface ProjectFile {
  name: string;
  path: string;
  type?: FileType;
  size?: string;
}

const EXT_TO_TYPE: Record<string, FileType> = {
  pdf: 'pdf',
  doc: 'docx',
  docx: 'docx',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  skp: 'model',
  sldprt: 'model',
  sldasm: 'model',
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
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  m4v: 'video',
  avi: 'video',
  mkv: 'video',
};

export function detectFileType(path: string): FileType {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_TYPE[ext] ?? 'other';
}

export interface ProjectMeta {
  title: string;
  description?: string;
  tags?: string[];
  year?: number;
  cover?: string;
  screenshots?: string[];
  files?: ProjectFile[];
  order?: number;
  external?: { label: string; url: string }[];
}

export interface Project extends ProjectMeta {
  repo: string;
  repoUrl: string;
  defaultBranch: string;
  rawBase: string;
  updatedAt: string;
  coverUrl?: string;
  screenshotUrls?: string[];
  fileUrls?: (ProjectFile & { url: string })[];
}

interface RepoSearchResult {
  full_name: string;
  name: string;
  html_url: string;
  default_branch: string;
  updated_at: string;
  topics: string[];
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

async function fetchProjectJson(
  repo: RepoSearchResult,
): Promise<ProjectMeta | null> {
  const url = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/project.json`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.warn(`[skip] ${repo.full_name}: project.json not found`);
    return null;
  }
  try {
    return (await res.json()) as ProjectMeta;
  } catch (err) {
    console.warn(`[skip] ${repo.full_name}: invalid project.json (${err})`);
    return null;
  }
}

function rawUrl(rawBase: string, relPath: string): string {
  if (/^https?:/i.test(relPath)) return relPath;
  return `${rawBase}/${relPath.replace(/^\/+/, '')}`;
}

export async function loadProjects(): Promise<Project[]> {
  const repos = await searchRepos();
  const projects: Project[] = [];

  for (const repo of repos) {
    const meta = await fetchProjectJson(repo);
    if (!meta) continue;

    const rawBase = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}`;

    projects.push({
      ...meta,
      repo: repo.name,
      repoUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      rawBase,
      updatedAt: repo.updated_at,
      coverUrl: meta.cover ? rawUrl(rawBase, meta.cover) : undefined,
      screenshotUrls: meta.screenshots?.map((p) => rawUrl(rawBase, p)),
      fileUrls: meta.files?.map((f) => ({
        ...f,
        type: f.type ?? detectFileType(f.path),
        url: rawUrl(rawBase, f.path),
      })),
    });
  }

  // Сортировка: явный order по возрастанию, затем по году по убыванию,
  // затем по дате последнего обновления.
  projects.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    if ((b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return projects;
}
