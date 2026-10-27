// Состояние проекта задаётся топиком GitHub-репозитория. Топик — это
// независимая от раздела метка: проект остаётся в своём направлении,
// а на карточке и странице появляется плашка статуса.
//
// Если статус-топика нет, плашка не показывается — старые проекты
// выглядят как раньше. Если топиков несколько, побеждает первый
// в массиве (сначала «работает», потом «прототип», потом «в разработке»).

export interface ProjectStatus {
  /** Часть CSS-класса: status-badge--dev и т.п. */
  id: 'dev' | 'proto' | 'live';
  /** Топик репозитория на GitHub. */
  topic: string;
  /** Текст плашки. */
  label: string;
}

export const statuses: ProjectStatus[] = [
  {
    id: 'live',
    topic: 'status-live',
    label: 'Работает',
  },
  {
    id: 'proto',
    topic: 'status-proto',
    label: 'Прототип',
  },
  {
    id: 'dev',
    topic: 'status-dev',
    label: 'В разработке',
  },
];

/** Статус проекта по его топикам или null, если статус не задан. */
export function statusForTopics(topics: string[] | undefined): ProjectStatus | null {
  if (!topics || topics.length === 0) return null;
  return statuses.find((status) => topics.includes(status.topic)) ?? null;
}
