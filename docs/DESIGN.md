# Trainingsapp — Design System (aus Stitch)

## Fonts

| Verwendung | Font | Gewichte |
|------------|------|----------|
| Headlines (h1, h2, h3) | Plus Jakarta Sans | 600, 700, 800 |
| Body, Labels, Inputs | Inter | 400, 500, 600 |

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
```

## Farbpalette

### Primärfarben

| Token | HEX | Verwendung |
|-------|-----|-----------|
| `primary` | `#059669` | Buttons, aktive Tabs, Akzente, Links |
| `on-primary` | `#ffffff` | Text auf Primary-Hintergrund |
| `primary-container` | `#00855d` | Dunklere Primary-Variante |
| `primary/10` | `rgba(5,150,105,0.1)` | Badge-Hintergründe, dezente Akzente |
| `primary/20` | `rgba(5,150,105,0.2)` | Hover-Borders, Shadow |
| `primary/50` | `rgba(5,150,105,0.5)` | Focus-Rings |

### Oberflächen

| Token | HEX | Verwendung |
|-------|-----|-----------|
| `background` | `#f9f9f9` | Seiten-Hintergrund |
| `surface` | `#f9f9f9` | Overlay-Hintergrund (Modals) |
| `surface-container-lowest` | `#ffffff` | Karten, Inputs, Listen-Items |
| `surface-container-low` | `#f3f3f3` | Platzhalter, Bild-Container |
| `surface-container` | `#eeeeee` | Borders, Trennlinien |
| `surface-container-high` | `#e8e8e8` | Chips (inaktiv), Icon-Buttons (default) |
| `surface-container-highest` | `#e2e2e2` | Chips (hover), Close-Buttons |

### Text

| Token | HEX | Verwendung |
|-------|-----|-----------|
| `on-surface` | `#1a1c1c` | Headlines, primärer Text |
| `on-surface-variant` | `#3d4a42` | Sekundärer Text, Beschreibungen |
| `on-surface-variant/70` | `rgba(61,74,66,0.7)` | Tertiärer Text, Subtexte |
| `outline` | `#6d7a72` | Placeholder-Text, deaktivierte Icons |
| `outline-variant` | `#bccac0` | Dezente Borders, Ring-Farben |

### Status & Feedback

| Token | HEX | Verwendung |
|-------|-----|-----------|
| `error` | `#ba1a1a` | Fehler, Löschen-Aktionen |
| `error-container` | `#ffdad6` | Fehler-Hintergrund |
| `tertiary` | `#9b3e3b` | Warnung, sekundäre Aktionen |
| `secondary` | `#3e6753` | Sekundäre Elemente |

## Border Radius

| Token | Wert | Verwendung |
|-------|------|-----------|
| `rounded-md` | `6px` | Kleine Badges, Tags |
| `rounded-xl` | `12px` | Bild-Container |
| `rounded-2xl` | `16px` | Karten, Inputs, Buttons, Listen-Items |
| `rounded-3xl` | `24px` | Bottom-Navigation |
| `rounded-full` | `9999px` | Chips, Icon-Buttons, Pill-Shapes |

## Komponenten-Patterns

### Karten (Exercise Cards, Training Cards)

```
Container: bg-surface-container-lowest rounded-2xl border border-surface-container
Hover:     hover:border-primary/20 hover:shadow-sm
Active:    active:scale-[0.98]
Padding:   p-4
```

### Primäre Buttons (CTAs)

```
Container: bg-primary text-on-primary rounded-2xl font-bold
Height:    h-14 (56px)
Shadow:    shadow-lg shadow-primary/20
Active:    active:scale-[0.97]
```

### Icon-Buttons (Add, Close)

```
Default:   w-10 h-10 rounded-full bg-surface-container-high text-primary
Hover:     hover:bg-primary hover:text-on-primary
Active:    active:scale-90
```

### Close-Button (Modals)

```
Container: w-10 h-10 rounded-full bg-surface-container-high
Hover:     hover:bg-surface-container-highest
Active:    active:scale-90
Icon:      Material Symbols "close"
```

### Filter-Chips

```
Aktiv:     px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-semibold shadow-sm
Inaktiv:   px-5 py-2.5 bg-surface-container-high text-on-surface-variant rounded-full text-sm font-medium
Hover:     hover:bg-surface-container-highest
Active:    active:scale-95
Layout:    Horizontal scrollbar, no-scrollbar, gap-2
```

### Suchfeld

```
Container: h-14 rounded-2xl bg-surface-container-lowest
Border:    ring-1 ring-outline-variant/30
Focus:     focus:ring-2 focus:ring-primary/50
Padding:   pl-12 pr-12 (Platz für Icons links/rechts)
Icon:      Material Symbols "search" (left), "cancel" (right)
```

### Badges / Tags

```
Muskelgruppe:    px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md
Studio-gebunden: px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-md (aus bestehendem Code)
```

### Bottom Navigation

```
Container:    fixed bottom-0 w-full rounded-t-[32px] bg-white/80 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.04)]
Padding:      px-4 pb-8 pt-4
Tab inaktiv:  text-zinc-400 p-3
Tab aktiv:    bg-primary/10 text-primary rounded-2xl p-3
Active:       active:scale-90
```

### Sticky Footer (Modal)

```
Container: fixed bottom-0 w-full bg-white/90 backdrop-blur-xl px-6 py-6
Border:    border-t border-surface-container
Shadow:    shadow-[0_-8px_32px_rgba(0,0,0,0.06)]
```

## Icons

Material Symbols Outlined (Google):
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

Variante: `FILL 0, wght 400, GRAD 0, opsz 24`

Wichtige Icons:
- Navigation: `home`, `fitness_center`, `explore`, `scale`, `settings`
- Aktionen: `add`, `close`, `search`, `cancel`
- Status: `check_circle`, `radio_button_unchecked`

**Hinweis:** Die bestehende App verwendet Lucide React Icons. Für die Migration entweder komplett auf Material Symbols umstellen oder bei Lucide bleiben und nur das Styling übernehmen.

## Typografie-Skala

| Element | Klassen |
|---------|---------|
| Seiten-Headline | `text-2xl font-extrabold tracking-tight` (Plus Jakarta Sans) |
| Übungs-Name | `font-bold text-base` |
| Beschreibung | `text-xs text-on-surface-variant/70` |
| Badge-Text | `text-[10px] font-bold uppercase tracking-wider` |
| Button-Text | `font-bold` (Standard-Größe) |
| Chip-Text aktiv | `text-sm font-semibold` |
| Chip-Text inaktiv | `text-sm font-medium` |
| Counter/Zähler | `text-xs font-semibold tracking-tight` |

## Animationen & Transitions

```css
/* Standard-Transition für alle interaktiven Elemente */
transition-all duration-150

/* Hover-Effekte */
hover:border-primary/20 hover:shadow-sm

/* Active/Press-Effekte */
active:scale-[0.98]  /* Karten */
active:scale-[0.97]  /* Große Buttons */
active:scale-95      /* Chips */
active:scale-90      /* Icon-Buttons */
```

## Glass-Effekte

```css
/* Navigation & Sticky Footer */
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background: rgba(255, 255, 255, 0.8);  /* bg-white/80 */
```

## Responsive Breakpoints

- **Mobile (Standard):** 375px, volle Breite
- **Content-Container:** `max-w-md mx-auto` (448px) für zentriertes Layout auf größeren Screens
- Bottom Navigation: Immer sichtbar, `pb-8` für Safe Area (iPhone Notch)

## Tailwind Config Erweiterung

```js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: "#059669",
        "on-primary": "#ffffff",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#3d4a42",
        background: "#f9f9f9",
        surface: "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        outline: "#6d7a72",
        "outline-variant": "#bccac0",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
      },
      fontFamily: {
        headline: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
}
```
