# portfolio-master

Master-репозиторий, который агрегирует проекты из других ваших GitHub-репо
и публикует портфолио через GitHub Pages.

**Как это работает:**
1. Каждый проект живёт в своём репозитории (PDF, архивы, 3D-модели и т.п.).
2. Каждому такому репо вы ставите топик `portfolio-project` и кладёте в корень `project.json`.
3. GitHub Action в этом master-репо при сборке через GitHub API находит все ваши репо
   с этим топиком, читает `project.json` и генерирует статичный сайт с карточками.
4. Большие файлы остаются в исходных репо — карточки на них только ссылаются,
   ничего не дублируется.

Шаблон, как оформить проект-репо, лежит в [`PROJECT_TEMPLATE/`](./PROJECT_TEMPLATE/).

---

## Первичная настройка

### 1. Создайте репозиторий из этой папки

```bash
cd portfolio-master
git init
git add .
git commit -m "init portfolio master"
gh repo create portfolio-master --public --source=. --push
```

(или вручную через UI GitHub — имя `portfolio-master` или любое другое)

### 2. Поправьте `astro.config.mjs`

```js
site: 'https://YOUR_USERNAME.github.io',
base: '/portfolio-master',  // имя master-репо
```

Если вы хотите деплоить на корень `<username>.github.io`, назовите репо
`<username>.github.io` и поставьте `base: '/'`.

### 3. Включите GitHub Pages

`Settings → Pages → Build and deployment → Source: GitHub Actions`

### 4. (опционально) Задайте переменные

`Settings → Secrets and variables → Actions → Variables`:
- `PORTFOLIO_USERNAME` — если ваш аккаунт отличается от владельца репо
- `PORTFOLIO_TOPIC` — если хотите другой топик вместо `portfolio-project`

### 5. Положите фото в `public/avatar.jpg`

Размер ~ 400×400 px, квадратное (обрежется в круг). Если используете другое
имя/расширение — поменяйте путь в `src/pages/index.astro` (переменная `avatar`).

### 6. Сделайте первый пуш

Action запустится автоматически. Без проектов сайт покажет пустое состояние,
но шапка с вашим именем и фото уже будет на месте.

---

## Локальный запуск

```bash
npm install
npm run dev
```

Без `GITHUB_TOKEN` в env упрётесь в лимит 60 запросов/час. Чтобы не упираться:

```bash
echo 'GITHUB_TOKEN=ghp_xxx' > .env
echo 'GITHUB_USERNAME=ваш_username' >> .env
npm run dev
```

Токен с правом `public_repo` (или вообще без скоупов для public-репо) получите
в `Settings → Developer settings → Personal access tokens`.

---

## Когда обновляется сайт

- При пуше в `main` master-репо.
- Каждую ночь в 03:17 UTC (cron).
- При вызове `repository_dispatch` из проект-репо — настраивается в
  [`PROJECT_TEMPLATE/`](./PROJECT_TEMPLATE/), чтобы карточка обновлялась сразу
  после пуша в проект.
- Вручную — `Actions → Deploy to GitHub Pages → Run workflow`.

---

## Структура

```
src/
├── lib/github.ts        # фетчит репо и project.json через GitHub API
├── components/          # ProjectCard.astro
├── pages/index.astro    # главная страница с сеткой карточек
└── styles/global.css

.github/workflows/deploy.yml   # билд + деплой
PROJECT_TEMPLATE/              # как оформлять проект-репо
```

Расширить можно по вкусу: добавить детальные страницы (`src/pages/projects/[slug].astro`),
фильтры по тегам, поиск, рендер README через `marked` — структура к этому
готова, поля уже доступны в `Project`.
