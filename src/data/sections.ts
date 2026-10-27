// Состав сайта: разделы, их порядок и то, каким топиком GitHub
// помечается проект, чтобы попасть в раздел. Единственный файл,
// который надо править при добавлении нового направления.

export interface Section {
  /** Часть URL: /llm/, /cad/ … */
  id: string;
  /** Заголовок раздела на сайте. */
  title: string;
  /** Топик репозитория, по которому проект попадает в этот раздел. */
  topic: string;
  /** Одна строка «о чём раздел» — на плитке главной и в шапке раздела. */
  lead: string;
  /** Показывать раздел на главной, даже если в нём пока нет проектов. */
  hideWhenEmpty?: boolean;
}

// Порядок в массиве = порядок на главной. Если у репозитория стоит
// несколько топиков сразу, побеждает раздел, который выше в списке.
export const sections: Section[] = [
  {
    id: 'llm',
    title: 'Локальные LLM и автоматизация',
    topic: 'portfolio-llm',
    lead: 'Локальные модели, агенты, пайплайны и автоматизация прикладных задач.',
  },
  {
    id: 'cad',
    title: 'CAD и инженерия',
    topic: 'portfolio-cad',
    lead: 'Модели и расчёты, реверс-инжиниринг, документация и готовые изделия.',
  },
  {
    id: 'games',
    title: 'Игры и геймдизайн',
    topic: 'portfolio-games',
    lead: 'Игровые прототипы, механики и геймдизайн — от идеи до играбельной сборки.',
    // Направление новое: показываем его на главной сразу, даже без проектов.
    hideWhenEmpty: false,
  },
  {
    id: 'other',
    title: 'Остальные',
    topic: 'portfolio-other',
    lead: 'Эксперименты и проекты вне двух основных направлений.',
  },
];

/**
 * Топик из первой версии сайта. Репозитории с ним попадают в раздел
 * «Остальные», если у них нет топика конкретного раздела — чтобы старые
 * проекты не исчезли с сайта при переезде.
 */
export const LEGACY_TOPIC = 'portfolio-project';

/** Раздел по умолчанию для репозиториев без явного раздела. */
export const FALLBACK_SECTION_ID = 'other';

export const fallbackSection = sections.find((s) => s.id === FALLBACK_SECTION_ID)!;

/** Раздел по id, с безопасным фолбэком. */
export function sectionById(id: string): Section {
  return sections.find((s) => s.id === id) ?? fallbackSection;
}

/** Есть ли у репозитория топик, из-за которого он попадает на сайт. */
export function isPortfolioRepo(topics: string[] | undefined): boolean {
  if (!topics || topics.length === 0) return false;
  return topics.includes(LEGACY_TOPIC) || sections.some((s) => topics.includes(s.topic));
}

/** Раздел проекта по его топикам. */
export function sectionForTopics(topics: string[] | undefined): Section {
  if (topics) {
    for (const section of sections) {
      if (topics.includes(section.topic)) return section;
    }
  }
  return fallbackSection;
}
