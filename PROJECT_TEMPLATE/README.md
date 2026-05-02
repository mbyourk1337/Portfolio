# Как оформить репозиторий проекта

Этот шаблон — то, как должен выглядеть **репозиторий одного проекта**, чтобы его
подхватил [`portfolio-master`](../).

## Шаги

### 1. Создайте репозиторий для проекта

Один проект = один публичный репо. Имя репо станет техническим идентификатором
(показывается в `meta` карточки), название проекта берётся из `project.json`.

```bash
gh repo create my-cool-project --public
```

### 2. Добавьте топик `portfolio-project`

Через UI: `About → ⚙️ → Topics → portfolio-project`

Или через CLI:
```bash
gh repo edit --add-topic portfolio-project
```

Без этого топика master-репо не увидит проект.

### 3. Положите в корень `project.json`

См. [`project.json`](./project.json) рядом — это рабочий пример со всеми полями.
Минимум, что нужно:

```json
{
  "title": "Название проекта",
  "description": "Что это и зачем"
}
```

### 4. Положите файлы как удобно — ссылайтесь по относительным путям

Master-репо строит ссылки от корня проект-репо. Структура произвольная,
но рекомендую такую:

```
my-cool-project/
├── project.json
├── README.md
├── cover.jpg              # обложка карточки
├── screenshots/           # фото / рендеры
│   ├── 01-plan.png
│   └── 02-render.png
├── docs/                  # PDF, docx — пояснительные, спецификации
│   ├── specification.pdf
│   └── note.docx
├── models/                # нативные CAD: .skp .sldprt .sldasm .step .stl .dwg .blend …
│   └── design.skp
├── videos/                # демо-ролики, mp4/mov/webm
│   └── demo.mp4
└── archives/              # zip/rar/7z — полный пакет
    └── full-package.zip
```

Поле `type` в `project.json` указывать не обязательно — определяется по
расширению автоматически. На карточке у каждого файла своя иконка
(📄 PDF, 📝 docx, 🧊 модель, 🎬 видео, 🗜 архив, 🖼 картинка).

> ⚠️ Видео тяжёлые. Если оно > 100 МБ — заливайте в **GitHub Releases**
> (до 2 ГБ на ассет) и в `project.json` укажите полный URL вида
> `https://github.com/USER/REPO/releases/...`. Иначе пуш заблокируется.

### 5. (рекомендуется) Триггер обновления master-сайта

Чтобы master-сайт пересобирался **сразу** после пуша в проект-репо
(а не ждал ночного крона), создайте в проект-репо файл
`.github/workflows/notify-portfolio.yml` со следующим содержимым:

```yaml
name: Notify portfolio
on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger portfolio rebuild
        env:
          PAT: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}
        run: |
          curl -sS -X POST \
            -H "Authorization: Bearer $PAT" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/YOUR_USERNAME/portfolio-master/dispatches" \
            -d '{"event_type":"project-updated"}'
```

`PORTFOLIO_DISPATCH_TOKEN` — Personal Access Token с правом `repo` на master-репо,
кладётся в `Settings → Secrets → Actions` каждого проект-репо
(или в Organization secrets, чтобы не дублировать).

Если возиться лень — пропустите этот шаг, ночной крон в master-репо
всё равно подхватит изменения.

---

## Лимиты, о которых стоит помнить

- **100 МБ на один файл** — блокирующий лимит GitHub. Для бóльших файлов:
  - используйте **GitHub Releases** — до 2 ГБ на ассет (ссылку в `project.json`
    укажите как полный URL вида `https://github.com/.../releases/download/...`),
  - либо подключите **Git LFS** — но он платный сверх 1 ГБ хранения.
- **5 ГБ мягкий лимит на репо** — GitHub предупредит, но не заблокирует.
- **100 ГБ жёсткий лимит на репо** — если упираетесь, разбивайте проект на
  несколько репо («part-1», «part-2») и делайте на них несколько карточек.
- **GitHub Pages — 1 ГБ на сайт, 100 ГБ траффика/мес** — но это про master-репо,
  а у нас он лёгкий, тяжёлые файлы лежат в проект-репо и не попадают на Pages.

## Частые ошибки

- Забыли топик `portfolio-project` → проект не появится на сайте.
- Невалидный JSON в `project.json` → проект пропустится с warning'ом в логах
  Action (см. вывод `withastro/action`).
- Репо приватный → master-репо его не увидит. Сделайте публичным или
  переключитесь на `loadProjects` через токен с доступом к приватным репо.
- Битые относительные пути в `cover` / `screenshots` / `files` → broken-image
  на карточке. Проверяйте, что файл реально лежит в указанном месте на ветке
  по умолчанию.
