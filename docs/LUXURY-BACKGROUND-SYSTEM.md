# Clinic Connect — Luxury Background System

**Design philosophy:** The admin dashboard should feel like entering a high-end aesthetic clinic: calm, premium, medical-grade clean, and beauty-industry aligned. It is an enterprise control system for premium clinics—not a playful consumer app, and not a dark dev-tool or crypto dashboard.

**Aesthetic goal:** Soft warm neutrals, champagne and blush undertones, frosted surfaces, subtle depth. No pure black, no harsh charcoal, no neon. Elegant and barely noticeable gradients.

---

## 1. Design Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Luxurious** | Champagne gold accent, warm ivory/champagne canvas, refined typography and spacing |
| **Medical-grade clean** | High contrast text on soft backgrounds, clear hierarchy, no visual noise |
| **Beauty-industry aligned** | Blush undertones in gradients, rose-gold optional accent, spa-like calm |
| **Avoid heaviness** | No pure black; warm charcoal text; soft shadows with warm tint; layered transparency |
| **Frosted / elevated** | Surface 2 and 3 use near-white with subtle border; cards feel “lifted” not flat |

---

## 2. Color Token System (CSS Variables)

All tokens live under `.ent-theme` so existing components use them without code changes.

### 2.1 Canvas & Surfaces

| Token | Value | Rationale |
|-------|--------|-----------|
| `--ent-bg` | `#f6f4f1` | Main canvas: soft warm gray (warm stone). Not white, not beige—neutral warm. |
| `--ent-bg-bottom` | `#ebe8e4` | Bottom of gradient: slightly darker for subtle depth. |
| `--ent-bg-overlay` | `radial-gradient(ellipse 90% 60% at 20% 0%, rgba(244, 232, 224, 0.35) 0%, transparent 55%)` | Optional radial: soft blush at top-right, fades to transparent. |
| `--ent-surface-1` | `#faf9f7` | Content area / sidebar: slightly lighter than canvas, warm ivory. |
| `--ent-surface-2` | `#ffffff` | Cards, tables, panels: pure white for clarity and “elevated” feel. |
| `--ent-surface-3` | `#fdfcfa` | Hover, dropdown, modal bg: warm off-white to avoid cold gray. |

### 2.2 Borders & Dividers

| Token | Value | Rationale |
|-------|--------|-----------|
| `--ent-border` | `rgba(44, 42, 38, 0.08)` | Warm charcoal at 8%—visible but soft. |
| `--ent-border-hover` | `rgba(44, 42, 38, 0.14)` | Slightly stronger on hover. |
| `--ent-divider` | `rgba(44, 42, 38, 0.06)` | Section dividers, very subtle. |

### 2.3 Text

| Token | Value | Rationale |
|-------|--------|-----------|
| `--ent-text-primary` | `#2c2a26` | Deep warm charcoal (not pure black). |
| `--ent-text-secondary` | `#6b6560` | Warm gray for labels and secondary content. |
| `--ent-text-muted` | `#9c958d` | Placeholders, disabled, captions. |

### 2.4 Accent

| Token | Value | Rationale |
|-------|--------|-----------|
| `--ent-accent` | `#a8926e` | Muted luxury gold (champagne gold). Not shiny yellow. |
| `--ent-accent-hover` | `#927a52` | Darker on hover for feedback. |
| `--ent-accent-secondary` | `#5b8a72` | Soft medical teal for secondary actions or badges. |

### 2.5 Semantic

| Token | Value |
|-------|--------|
| `--ent-success` | `#4a7c59` |
| `--ent-warning` | `#c4903a` |
| `--ent-danger` | `#b85450` |
| `--ent-overlay` | `rgba(44, 42, 38, 0.4)` |

### 2.6 Shadows (soft, warm undertone)

| Token | Value | Use |
|-------|--------|-----|
| `--ent-shadow-card` | `0 1px 3px rgba(44, 42, 38, 0.04), 0 1px 2px -1px rgba(44, 42, 38, 0.03)` | Default card. |
| `--ent-shadow-card-hover` | `0 8px 24px -4px rgba(44, 42, 38, 0.06), 0 2px 8px -2px rgba(44, 42, 38, 0.04)` | Card hover. |
| `--ent-shadow-dropdown` | `0 8px 24px -4px rgba(44, 42, 38, 0.08), 0 2px 8px -2px rgba(44, 42, 38, 0.04)` | Dropdowns. |
| `--ent-shadow-modal` | `0 24px 48px -12px rgba(44, 42, 38, 0.12), 0 8px 16px -8px rgba(44, 42, 38, 0.06)` | Modals. |

---

## 3. Background Layering Strategy

1. **Base layer:** `--ent-bg` (solid).
2. **Gradient layer:** `linear-gradient(180deg, var(--ent-bg) 0%, var(--ent-bg-bottom) 100%)`.
3. **Overlay (optional):** `--ent-bg-overlay` (radial blush) composited on top at low opacity.

Implementation: single wrapper uses `background` with the gradient, then a `::before` or a second div for the radial so it sits above the gradient but below content.

---

## 4. Layout Wrapper

- One root div with `ent-theme` and `ent-theme-luxury-bg` (or inline background).
- Main content area does not add another full-screen background; it inherits so the gradient is visible.

---

## 5. Card Styling

- Background: `var(--ent-surface-2)`.
- Border: `1px solid var(--ent-border)`.
- Border-radius: `var(--ent-radius-lg)` (12px).
- Shadow: `var(--ent-shadow-card)`.
- Hover: `var(--ent-shadow-card-hover)` and optional `border-color: var(--ent-border-hover)`.

---

## 6. Table Styling

- Header: `background: var(--ent-surface-1)`, `color: var(--ent-text-secondary)`, `font-weight: 600`, `border-bottom: 1px solid var(--ent-border)`.
- Rows: `background: var(--ent-surface-2)`, `border-bottom: 1px solid var(--ent-divider)`.
- Row hover: `background: var(--ent-surface-3)`.

---

## 7. Modal Styling

- Backdrop: `var(--ent-overlay)`.
- Panel: `background: var(--ent-surface-2)`, `border-radius: var(--ent-radius-xl)`, `box-shadow: var(--ent-shadow-modal)`, `border: 1px solid var(--ent-border)`.

---

## 8. Preventing Visual Heaviness

- No fill above ~96% opacity for overlays.
- Shadows use warm charcoal tint (44, 42, 38) not pure black.
- Text primary is #2c2a26, not #000.
- Borders are 6–14% opacity.
- Single radial overlay; no multiple competing gradients.

---

## 9. Implementation Snippets

### 9.1 Layout wrapper (layout.tsx)

```tsx
<div className="ent-theme ent-theme-luxury-bg min-h-screen flex font-[var(--font-inter)]">
  <ClinicSidebar />
  <div className="flex-1 flex flex-col min-w-0 min-h-screen">
    <ClinicTopbar />
    <main className="flex-1 px-8 py-6 w-full overflow-auto">
      {children}
    </main>
  </div>
</div>
```

No inline `background`; the class `ent-theme-luxury-bg` applies the gradient and the `::before` radial overlay.

### 9.2 Background gradient (in ent-tokens.css)

Base layer (class `.ent-theme-luxury-bg`):

```css
background: linear-gradient(180deg, var(--ent-bg) 0%, var(--ent-bg-bottom) 100%);
```

Overlay (same class `::before`):

```css
background: var(--ent-bg-overlay); /* radial blush at 20% 0%, 35% opacity, fade to transparent */
```

### 9.3 Card example

```tsx
<div className="ent-card p-6">
  <h3 className="text-lg font-semibold" style={{ color: "var(--ent-text-primary)" }}>Card title</h3>
  <p className="text-sm mt-1" style={{ color: "var(--ent-text-secondary)" }}>Content.</p>
</div>
```

Or with Tailwind + CSS variables:

```tsx
<div className="bg-ent-surface-2 border border-ent-border rounded-xl shadow-ent-card hover:shadow-ent-card-hover transition-shadow duration-200 p-6">
  ...
</div>
```

### 9.4 Table example

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b" style={{ borderColor: "var(--ent-border)", background: "var(--ent-surface-1)", color: "var(--ent-text-secondary)" }}>
      <th className="text-left font-semibold py-3 px-4">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b hover:bg-ent-surface-3 transition-colors" style={{ borderColor: "var(--ent-divider)", background: "var(--ent-surface-2)" }}>
      <td className="py-3 px-4" style={{ color: "var(--ent-text-primary)" }}>Cell</td>
    </tr>
  </tbody>
</table>
```

### 9.5 Modal example

```tsx
<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--ent-overlay)" }}>
  <div
    className="rounded-2xl w-full max-w-md p-6"
    style={{
      background: "var(--ent-surface-2)",
      border: "1px solid var(--ent-border)",
      boxShadow: "var(--ent-shadow-modal)",
    }}
  >
    <h2 style={{ color: "var(--ent-text-primary)" }}>Modal title</h2>
    <p className="mt-2" style={{ color: "var(--ent-text-secondary)" }}>Content.</p>
  </div>
</div>
```

### 9.6 Hover state (buttons / interactive cards)

- **Cards:** `box-shadow: var(--ent-shadow-card-hover)`; optional `border-color: var(--ent-border-hover)`.
- **Buttons (accent):** `background: var(--ent-accent-hover)` on hover.
- **Ghost/secondary:** `background: var(--ent-surface-3)` on hover.
