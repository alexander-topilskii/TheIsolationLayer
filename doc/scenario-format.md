# Формат сценарных файлов

Сценарий состоит из модуля-индекса и связанных JSON-файлов.

## index.json

```json
{
  "id": "demo",
  "title": "TERRA-4 Recovery",
  "version": "1.0.0",
  "shifts": 3,
  "initialState": {
    "energy": 80,
    "aiStability": 74,
    "colonists": 49994,
    "shift": 1,
    "gameTime": "00:00"
  },
  "modules": {
    "tickets": "./tickets.json",
    "protocols": "./protocols.json",
    "colonists": "./colonists.json",
    "sectors": "./sectors.json",
    "cli": "./cli.json"
  },
  "startTicket": "shift1-intro",
  "endings": []
}
```

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор сценария |
| `title` | string | Название для экрана |
| `version` | string | Semver сценария |
| `shifts` | number | Количество смен (1–5) |
| `initialState` | object | Начальные метрики и время |
| `modules` | object | Пути к модулям (относительно index.json) |
| `startTicket` | string | ID первого тикета |
| `endings` | array | Условия финалов |

### Ending

```json
{
  "id": "perfect-course",
  "title": "Идеальный курс",
  "text": "Корабль выходит на орбиту Терры-4...",
  "conditions": {
    "minEnergy": 50,
    "minColonists": 45000,
    "minAiStability": 1
  }
}
```

## tickets.json

Массив объектов `Ticket`:

```json
{
  "id": "A-404-CO2",
  "shift": 1,
  "system": "Life Support",
  "severity": "warning",
  "log": "Сектор C-3. Превышение CO2 на 40%.",
  "timeAdvance": 10,
  "options": [
    {
      "id": "vent",
      "text": "Вентилировать сектор в космос",
      "impact": { "energy": -5, "aiStability": 2, "colonists": 0 },
      "nextTicket": "shift1-after-co2"
    }
  ]
}
```

### Ticket

| Поле | Тип | Обяз. | Описание |
|------|-----|-------|----------|
| `id` | string | да | Уникальный ID |
| `shift` | number | да | Номер смены |
| `system` | string | да | Имя системы для лога |
| `severity` | `"info"` \| `"warning"` \| `"critical"` | да | Уровень |
| `log` | string | да | Текст тикета (без timestamp — добавляет движок) |
| `options` | TicketOption[] | нет | Варианты ответа; пусто для narrative-only |
| `timeAdvance` | number | нет | Минуты игрового времени (+default 10) |
| `deception` | Deception | нет | Ложный лог ИИ |
| `onEnter` | TicketSideEffect | нет | При входе в тикет |
| `onResolve` | TicketSideEffect | нет | После любого выбора |
| `isShiftEnd` | boolean | нет | Завершение смены |
| `isShiftStart` | boolean | нет | Первый тикет смены (для auto-advance) |
| `flagAdvance` | object | нет | `{ "flag": "nextTicketId" }` — переход по CLI-флагу |
| `cliGate` | CliGate | нет | Ожидание CLI-команды для перехода |
| `skipIfFail` | string | нет | ID тикета при невыполнении conditions |
| `inputMode` | `"buttons"` \| `"cli"` \| `"both"` | нет | Режим ввода в footer |
| `conditions` | TicketConditions | нет | Условия появления |

### CliGate

```json
{
  "command": "DEACTIVATE",
  "arg": "TERRA-7F2A",
  "nextTicket": "shift5-res-code-2",
  "wrongMessage": "Неверный код."
}
```

### EndingConditions (дополнительно)

| `requiresAllFlags` | string[] | Все флаги должны быть установлены |

### TicketOption

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID опции |
| `text` | string | Текст кнопки |
| `impact` | MetricImpact | Изменение метрик |
| `nextTicket` | string \| null | Следующий тикет; null — конец ветки |
| `requiresVerification` | boolean | Бонус если игрок проверил диагностику |
| `penaltyIfUnverified` | MetricImpact | Штраф если не проверил (опционально) |

### Deception

```json
{
  "active": true,
  "claim": { "sector": "B-1", "condition": "fire" },
  "truth": { "sector": "B-1", "condition": "nominal" }
}
```

`SYS_STATUS` и F2 DIAGNOSTICS показывают `truth`, не `claim`.

### TicketSideEffect

```json
{
  "logAppend": "строка в лог",
  "triggerEffect": "ai_cli_override",
  "setFlags": ["quarantine_C3"],
  "sectorUpdates": [{ "id": "C-3", "quarantine": true }]
}
```

## protocols.json

```json
{
  "1": ["Правило 1 смены...", "Правило 2..."],
  "2": ["Карантин: вентиляция запрещена..."],
  "3": ["МАТЬ может блокировать справочник..."]
}
```

Ключ — номер смены (строка), значение — массив строк для F1 PROTOCOLS.

## sectors.json

```json
[
  {
    "id": "A-1",
    "label": "A1",
    "status": "nominal",
    "temperature": 22,
    "quarantine": false
  }
]
```

`status`: `nominal` | `damaged` | `offline`. На F2 повреждённые отмечаются `[X]`.

## colonists.json

```json
[
  {
    "id": "col-001",
    "lastName": "Иванов",
    "firstName": "Алексей",
    "sector": "B-1",
    "bio": "Инженер-биолог. Сектор B-1."
  }
]
```

Используется командой `SEARCH <фамилия>`.

## cli.json

```json
{
  "commands": [
    {
      "name": "REBOOT",
      "description": "Перезагрузка подсистемы (демо)",
      "response": "Подсистема недоступна. Обратитесь к протоколам."
    }
  ]
}
```

Расширяет встроенные `HELP`, `SYS_STATUS`, `SEARCH`, `CLEAR`.

## Расположение файлов

Сценарии хранятся в `public/scenarios/<id>/` — Vite отдаёт их как статику в dev и production.

Пример загрузки: `ScenarioLoader.load('/scenarios/demo/index.json')`

## Валидация

При загрузке проверяется:

- `startTicket` существует в tickets
- все `nextTicket` (не null) ссылаются на существующие ID
- `shift` каждого тикета в диапазоне 1..shifts
- начальные метрики в допустимых пределах
