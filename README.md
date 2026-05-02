# Portfolio

Master-репозиторий, который собирает портфолио из других ваших GitHub-репо
и публикует через GitHub Pages по адресу
**https://mbyourk1337.github.io/Portfolio/**

## Как это работает

1. Каждый проект — отдельный репозиторий. Складываете туда что угодно:
   фото, чертежи, PDF, DOCX, CAD-модели, видео, архивы — структура
   произвольная.
2. Ставите репо топик `portfolio-project` и заполняете поле **About** на GitHub
   (это и будет описанием карточки).
3. Master-репо при сборке через GitHub API находит все ваши репо с этим топиком,
   читает дерево файлов и генерирует:
   - на главной — карточку с обложкой (первое фото) и описанием из About;
   - на странице проекта — карусель из всех картинок и список всех остальных
     файлов со ссылками на скачивание.

Никаких `project.json` или метаданных в репо складывать не нужно — всё берётся
из GitHub.

---

## Как добавить новый проект

```bash
# 1. Завести папку для проекта (название = имя будущего репо на GitHub)
mkdir my-new-project && cd my-new-project

# 2. Положить внутрь что угодно: photos/, docs/, models/, video.mp4, drawing.pdf …
#    Структуру делать удобно так:
#      photos/   — фото и рендеры (имена с префиксом 01-, 02- задают порядок)
#      docs/     — PDF, DOCX
#      models/   — CAD: .SLDPRT .SLDASM .STEP .STL .DWG …
#      videos/   — .mp4 .mov .webm
#      archives/ — .zip полные пакеты
#    Но это рекомендация, не требование.

# 3. Запушить как новый публичный репо
git init -b main
git add .
git commit -m "init"
gh repo create my-new-project --public --source=. --push \
  --description "Краткое описание, появится на карточке"

# 4. Поставить топик
gh repo edit --add-topic portfolio-project

# 5. Триггернуть пересборку портфолио (или подождать ночной крон)
gh workflow run "Deploy to GitHub Pages" -R mbyourk1337/Portfolio
```

Через ~1 минуту карточка появится на сайте. Картинки автоматически попадут в
карусель, всё остальное — в список «Файлы» внизу страницы проекта.

### Как изменить описание проекта

`gh repo edit my-new-project --description "Новый текст"` —
или через UI: на странице репо `About → ⚙️`. На сайте обновится при следующем
билде.

### Как изменить порядок проектов

Не нужно — отсортированы по дате последнего обновления, свежие сверху.
Хотите вытащить проект наверх — сделайте в нём пуш (любой).

### Как изменить порядок картинок в карусели

Картинки сортируются по пути в репо. Префиксы `01-`, `02-` … работают как ожидается:
```
photos/01-cover.jpg
photos/02-detail.jpg
photos/03-render.jpg
```

---

## Лимиты

- **100 МБ — максимум на один файл в обычном пуше.** Большие файлы заливайте
  в **Releases** репо (до 2 ГБ на ассет) — они появятся в списке «Файлы»
  только если положены в дерево репо. Для Releases-ассетов пока ставьте
  ссылку в README или в About.
- **5 ГБ мягкий / 100 ГБ жёсткий лимит на репо** — поэтому каждый проект
  отдельный репо.
- **GitHub Pages: 1 ГБ на сайт, 100 ГБ траффика/мес** — у master-репо
  только HTML/CSS/JS, картинки и файлы остаются в проект-репо и грузятся
  напрямую с raw.githubusercontent.com.

---

## Когда обновляется сайт

- **Push в `main` master-репо** — сразу.
- **Каждую ночь** в 03:17 UTC — подхватывает изменения проект-репо.
- **Ручной запуск:** `Actions → Deploy to GitHub Pages → Run workflow`,
  или из терминала:
  ```bash
  gh workflow run "Deploy to GitHub Pages" -R mbyourk1337/Portfolio
  ```
- **Авто-триггер из проект-репо** (опционально, чтобы не ждать кроном):
  положите в проект-репо файл `.github/workflows/notify.yml`:

  ```yaml
  name: Notify portfolio
  on:
    push:
      branches: [main]
  jobs:
    notify:
      runs-on: ubuntu-latest
      steps:
        - env:
            PAT: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}
          run: |
            curl -sS -X POST \
              -H "Authorization: Bearer $PAT" \
              -H "Accept: application/vnd.github+json" \
              "https://api.github.com/repos/mbyourk1337/Portfolio/dispatches" \
              -d '{"event_type":"project-updated"}'
  ```

  И положите в Settings → Secrets → Actions проект-репо секрет
  `PORTFOLIO_DISPATCH_TOKEN` — Personal Access Token с правом `repo` на
  master-репо.

---

## Локальная разработка master-репо

```bash
npm install
npm run dev
```

Без `GITHUB_TOKEN` упрётесь в лимит 60 запросов/час GitHub API. Для нормальной
работы:
```bash
echo 'GITHUB_TOKEN=ghp_xxx' > .env
npm run dev
```

---

## Структура

```
src/
├── lib/github.ts                    # фетч репо и дерева файлов
├── components/
│   ├── ProjectCard.astro            # карточка на главной
│   └── Carousel.astro               # карусель картинок
├── pages/
│   ├── index.astro                  # главная — сетка карточек
│   └── projects/[slug].astro        # страница проекта
└── styles/global.css

.github/workflows/deploy.yml         # билд + деплой на Pages
```

---

## Аватар в шапке

Положите фото в `public/avatar.jpg` (квадрат, ~400×400). Если файл назван
иначе — поправьте путь в `src/pages/index.astro:8`.
