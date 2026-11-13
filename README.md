# Tetris

Implementación de **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar. Además del juego clásico incluye HOLD, piezas especiales, power-ups, combos, habilidades cargables y un modo desafío.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Qué hace el proyecto](#qué-hace-el-proyecto)
- [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
- [Controles](#controles)
- [Mecánicas](#mecánicas)
- [Cómo funciona](#cómo-funciona)
- [Pruebas](#pruebas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Personalización](#personalización)
- [Licencia](#licencia)

---

## Qué hace el proyecto

- Tablero de **10 × 20**, rotación con _wall kicks_, soft/hard drop, pieza fantasma, nivel y velocidad crecientes, pausa y Game Over.
- **HOLD** para reservar piezas (una vez por pieza colocada).
- **12 piezas**: las 7 clásicas + pentominós `+`, `U`, `Y`, la pieza **1×1** y la **Tuerca** (3×3 hueca).
- **Power-ups** aleatorios: Bomba, Rayo, Tinte, Gravedad y Congelar.
- **Combos**, multiplicadores, T-Spin, Back-to-Back y Perfect Clear.
- **Energía y habilidades**: Visión futura, Intercambio, Tiempo lento, Deshacer y Reserva.
- **Modo Desafío** con 5 retos y 3 dificultades cada uno.
- Efectos visuales (partículas, explosiones, rayos, sacudidas) y sonidos sintetizados con WebAudio.
- Tema claro / oscuro y botón de silencio, ambos recordados.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar.

```bash
start index.html                 # Windows (open en macOS, xdg-open en Linux)
python3 -m http.server 8000      # o cualquier servidor estático → http://localhost:8000
```

---

## Controles

| Tecla               | Acción                                              |
| ------------------- | --------------------------------------------------- |
| `←` / `→`           | Mover la pieza                                      |
| `↑` o `X`           | Rotar en sentido horario                            |
| `Z`                 | Rotar en sentido antihorario                        |
| `↓`                 | Soft drop                                           |
| `Espacio`           | Hard drop                                           |
| `C` o `Shift`       | HOLD (reservar / intercambiar)                      |
| `E`                 | Usar el power-up guardado                           |
| `Q`                 | Abrir el menú de habilidades (con la energía llena) |
| `P`                 | Pausar / reanudar                                   |
| `Esc`               | Cancelar selección / cerrar menú                    |

**Selección de objetivo** (Bomba, Rayo, Tinte): mueve el ratón y haz clic, o usa las flechas y `Enter`. `R` o clic derecho alterna fila/columna en el Rayo.

---

## Mecánicas

### HOLD
Guarda la pieza actual; si ya había una reservada, se intercambian. Solo una vez por pieza: el panel se atenúa hasta que la pieza se bloquea.

### Piezas especiales
Salen con probabilidades configurables (`pieceWeights`). La **Tuerca** es poco frecuente (reto: su hueco central no se puede rellenar). La **1×1** no sale al azar: aparece como recompensa inmediata tras un **Tetris**.

### Power-ups
Cada 5 líneas hay un 70 % de probabilidad de ganar uno (slot único, se activa con `E`).

| Power-up | Efecto |
| -------- | ------ |
| Bomba    | Destruye un área 3×3 que eliges (respeta los bordes) |
| Rayo     | Elimina una fila (lo de arriba baja) o una columna |
| Tinte    | Elige un color: sus bloques pasan a **comodín** (cada comodín cubre un hueco de su fila al evaluar líneas) |
| Gravedad | Compacta los bloques hacia abajo; puede completar líneas |
| Congelar | 5 s sin gravedad (puedes seguir moviendo y rotando) |

### Puntuación
`puntos = base × nivel × (×1.5 si Back-to-Back) × combo (+ bono Perfect Clear)`

- **Combo**: líneas en colocaciones consecutivas → x1, x2, x3… (tope x8). Una colocación sin líneas lo reinicia.
- **T-Spin**: pieza T con rotación final y ≥3 esquinas ocupadas.
- **Back-to-Back**: Tetris o T-Spin con líneas consecutivos.
- **Perfect Clear**: el tablero queda vacío.

### Habilidades
Cada línea carga la barra de energía. Con la barra llena, `Q` abre el menú (el tiempo se detiene) y cada habilidad gasta su coste:

| Habilidad     | Coste | Efecto |
| ------------- | ----- | ------ |
| Visión futura | 30    | Muestra las próximas 5 piezas durante 20 s |
| Intercambio   | 20    | Cambia la pieza actual por otra al azar |
| Tiempo lento  | 30    | Caída 3× más lenta durante 10 s (incompatible con Congelar) |
| Deshacer      | 50    | Vuelve antes de la última colocación (tablero, puntuación, combo, cola…) |
| Reserva       | 20    | Rearma el HOLD para usarlo otra vez con la pieza actual |

### Modo Desafío
Menú → Desafío → reto → dificultad. Muestra el objetivo, una barra de progreso y un cronómetro; hay pantallas de victoria y derrota con reintento.

1. **Contrarreloj**: 40 líneas en 2:00 (Fácil 25 · Difícil 1:45).
2. **Supervivencia**: sube una fila de basura cada 10 s (cada vez más rápido); sobrevive 2/3/4 min.
3. **Tablero contaminado**: empieza con 6/8/10 filas de basura; límpialas todas.
4. **Piezas invisibles**: los bloques se ocultan al bloquearse (solo se ven un instante al limpiar líneas).
5. **Rotación inversa**: aviso previo; desde cierto nivel (3/2/1) el giro se invierte.

---

## Cómo funciona

La lógica está separada de la presentación para poder probarla sin navegador:

- **Motor (`js/engine.js`)** — `GameEngine`: única fuente de verdad del estado (tablero, pieza, puntuación, estado de la partida). Expone acciones (`move`, `rotate`, `hardDrop`, `holdPiece`, `usePowerUp`, `useAbility`…), `update(dt)` y eventos (`engine.on('lines', …)`). No toca el DOM.
- **Estados**: `menu · ready · playing · paused · targeting · abilityMenu · over · won`. Todos los temporizadores (congelar, tiempo lento, visión, basura, cronómetro) se descuentan con el `dt` de `update()` y solo en `playing`, así que se pausan solos y `reset()` los reinicia sin dejar nada pendiente.
- **Módulos** — `board.js` (operaciones puras sobre el tablero), `pieces.js` (formas + cola ponderada) y los _managers_ en `js/managers/` (`hold`, `combo`, `powerups`, `abilities`, `challenge`).
- **Presentación (`game.js`)** — render en canvas, HUD, menús, entrada de teclado/ratón y reacción a los eventos del motor (partículas, sonido). Un único bucle `requestAnimationFrame` siempre activo llama a `engine.update(dt)` y dibuja.
- **Efectos y sonido** — `js/fx.js` (partículas, popups, rayos, sacudida) y `js/audio.js` (WebAudio, sin archivos).

---

## Pruebas

Requieren Node.js (solo para las pruebas; el juego no lo necesita). Usan el ejecutor integrado `node:test`, sin dependencias:

```bash
node --test tests/*.test.js
```

Cubren colisiones y rotaciones de todas las piezas, limpieza de líneas con comodines, power-ups, combos/B2B/T-Spin/Perfect Clear, HOLD, habilidades (incluido Deshacer), los cinco desafíos, que los temporizadores no se acumulen, el reinicio y que el Game Over detenga el juego.

---

## Estructura del proyecto

```
03-tetris/
├── index.html            # DOM y canvas
├── style.css             # Estilos (tema oscuro/claro)
├── game.js               # Presentación: render, entrada, menús, HUD
├── js/
│   ├── config.js         # Constantes y balance configurable
│   ├── board.js          # Operaciones puras sobre el tablero
│   ├── pieces.js         # Formas, cola ponderada de piezas
│   ├── engine.js         # GameEngine (estado + reglas + eventos)
│   ├── audio.js          # Sonidos WebAudio
│   ├── fx.js             # Efectos visuales en canvas
│   └── managers/         # hold, combo, powerups, abilities, challenge
├── tests/                # node --test
└── README.md
```

---

## Personalización

Casi todo el balance está en `js/config.js`:

| Clave                  | Significado                                         |
| ---------------------- | --------------------------------------------------- |
| `COLS`, `ROWS`         | Tamaño del tablero                                  |
| `pieceWeights`         | Probabilidad relativa de cada pieza                 |
| `powerUps`             | Cada cuántas líneas, probabilidad, duración de Congelar |
| `energy`               | Energía máxima, por línea, costes y duraciones      |
| `lineScores`, `tSpinScores`, `b2bMultiplier`, `perfectClearBonus`, `comboMax` | Puntuación |
| `drop`                 | Velocidad de caída base / mínima / paso por nivel   |
| `colors`, `colorsLight`| Paletas por tipo de pieza                           |

> `BLOCK` (30 px) vive en `game.js`. Si cambias `COLS`, `ROWS` o `BLOCK`, ajusta también `width` y `height` del `<canvas id="board">` en `index.html` (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
