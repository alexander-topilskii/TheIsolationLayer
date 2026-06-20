# The Isolation Layer

> **[TERRA-4 // Recovery Mode]**
> Прочитай методичку. Проверь датчики. Не верь логам на слово.

**The Isolation Layer** — браузерная narrative-игра об операторе корабля-колонизатора TERRA-4. Интерфейс в духе Classic Mac: слева — лента системных сообщений, справа — методичка, схема корабля, действия и архив.

## Концепт

**Ощущение:** как изучение методички / правил настольной игры — много перекрёстных ссылок, документация важнее кнопок, лор открывается через чтение.

**ЦА:** люди, которым нравится вдумчиво разбираться в системах, читать lore и сводить факты из разных источников.

**Игровой луп:** сообщение от AI → методичка (§) → корабль (отсек + диагностика) → сверка с логами → процедура → (архив / логи для лора) → следующий инцидент.

Подробнее: [doc/idea.md](doc/idea.md)

---

## Игровой процесс

1. **Лента слева** — уведомления и реплики SVET; здесь только чтение.
2. **Методичка** — разделы § открывают процедуры; без чтения действия недоступны.
3. **Корабль** — список отсеков, диагностика, ASCII-схема палуб; выбор кликом на карте или в списке.
4. **Действия** — процедуры из изученных § (промывка, изоляция, перезагрузка…).
5. **Архив** — поиск колонистов, решения по данным капитана, скрытые записи.

Метрики: **PWR**, **AI**, **COL**. Три смены, несколько финалов.

---

## Стек

- **Vite + TypeScript**, Vanilla JS
- Модульные JSON-сценарии (`incidents`, `manual`, `procedures`, `sectors`, `ship-map`, …)
- `GameEngine` (FSM) + Classic Mac UI
- Локализация RU / EN, сохранение прогресса в `localStorage`

Документация: [doc/architecture.md](doc/architecture.md) · [doc/scenario-format.md](doc/scenario-format.md)

---

## Запуск

```bash
git clone https://github.com/alexander-topilskii/TheIsolationLayer.git
cd TheIsolationLayer
npm install
npm run dev
```

Сборка: `npm run build` · превью: `npm run preview`

### GitHub Pages

**https://alexander-topilskii.github.io/TheIsolationLayer/**

Деплой при push в `main` — [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

---

## Структура репозитория

```
public/scenarios/terra4/   — активный сценарий (3 смены)
src/engine/                — GameEngine, загрузчик, состояние
src/ui/                    — DesktopUI, ControlPanel, ShipMapView
src/i18n/                  — локализация UI и EN-переводы сценария
doc/                       — концепт, архитектура, формат сценария
```

---

*«Порядок работы: прочитать методичку → выбрать отсек → диагностика → процедура.» — §A0*
