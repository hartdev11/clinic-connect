# Clinic Connect — Theme Enforcement

**Rule:** No hard-coded hex/rgb in components. All UI colors come from semantic tokens.  
**Scope:** Clinic admin only (`.ent-theme`). Public/marketing may keep brand hex for campaigns.

---

## 1. Semantic Token System (Complete)

All tokens live in `src/app/ent-tokens.css` under `.ent-theme`.

### Core
| Token | Use |
|-------|-----|
| `--ent-bg` | Page canvas |
| `--ent-surface-1` | Content area, sidebar |
| `--ent-surface-2` | Cards, tables, panels, header |
| `--ent-surface-3` | Hover, dropdown, modal content |
| `--ent-border` | Default border |
| `--ent-divider` | Section dividers |

### Text
| Token | Use |
|-------|-----|
| `--ent-text-primary` | Headings, body |
| `--ent-text-secondary` | Labels, captions |
| `--ent-text-muted` | Placeholder, disabled, hint |
| `--ent-text-inverse` | Text on accent/dark (e.g. primary button) |

### Brand
| Token | Use |
|-------|-----|
| `--ent-accent` | Primary CTA, active nav, links |
| `--ent-accent-hover` | Primary button hover |
| `--ent-accent-soft` | Highlight card bg, badge accent |

### Status (semantic only)
| Token | Use |
|-------|-----|
| `--ent-success` | Success text, icon |
| `--ent-success-soft` | Success banner/badge bg |
| `--ent-warning` | Warning text, icon |
| `--ent-warning-soft` | Warning banner/badge bg |
| `--ent-danger` | Error/destructive text, icon |
| `--ent-danger-soft` | Error banner/badge bg |
| `--ent-info` | Info text, icon |
| `--ent-info-soft` | Info banner/badge bg |

### Interaction
| Token | Use |
|-------|-----|
| `--ent-hover-surface` | Ghost button, row hover |
| `--ent-focus-ring` | Focus outline (a11y) |
| `--ent-disabled-bg` | Disabled control bg |
| `--ent-disabled-text` | Disabled text |

### Shadow
| Token | Use |
|-------|-----|
| `--ent-shadow-sm` | Small elevation |
| `--ent-shadow-md` | Cards, dropdowns |
| `--ent-shadow-lg` | Modals |

---

## 2. Semantic Mapping Rules

### Buttons
- **Primary** → `bg-[var(--ent-accent)]` / `bg-ent-accent`, `text-[var(--ent-text-inverse)]`, hover `bg-[var(--ent-accent-hover)]`. Focus `ring-[var(--ent-focus-ring)]`.
- **Danger** → `bg-[var(--ent-danger)]`, `text-[var(--ent-text-inverse)]`, hover darker. Focus ring.
- **Ghost** → `bg-transparent`, hover `bg-[var(--ent-hover-surface)]`, text `var(--ent-text-primary)` or `var(--ent-text-secondary)`.
- **Secondary** → `bg-[var(--ent-surface-2)]`, border `var(--ent-border)`, hover `var(--ent-hover-surface)`.
- **Disabled** → `bg-[var(--ent-disabled-bg)]`, `text-[var(--ent-disabled-text)]`, `cursor-not-allowed`.

### Cards
- **Default** → `bg-[var(--ent-surface-2)]`, `border-[var(--ent-border)]`, `shadow-[var(--ent-shadow-card)]`.
- **Elevated** → same + `shadow-[var(--ent-shadow-card-hover)]` on hover.
- **Highlight** → `bg-[var(--ent-accent-soft)]`, border `var(--ent-accent)` low opacity.

### Tables
- **Header** → `bg-[var(--ent-surface-2)]`, `text-[var(--ent-text-secondary)]`, `border-b` `var(--ent-border)`.
- **Row** → `bg-[var(--ent-surface-2)]`, `border-b` `var(--ent-divider)`.
- **Row hover** → `bg-[var(--ent-hover-surface)]`.

### Badges
- **Always soft backgrounds:** `success` → `bg-[var(--ent-success-soft)]` + `text-[var(--ent-success)]`. Same for warning, danger, info. Never solid fill for large areas.

### Notifications (NotificationBell)
- **urgent** → `--ent-danger`, `--ent-danger-soft`.
- **warning** → `--ent-warning`, `--ent-warning-soft`.
- **info** → `--ent-info`, `--ent-info-soft`.

### Sidebar
- **Background** → `var(--ent-surface-1)`.
- **Border** → `var(--ent-border)`.
- **Active item** → left border `var(--ent-accent)`, bg `var(--ent-surface-2)`.
- **Hover** → `var(--ent-hover-surface)` or `var(--ent-surface-2)`.
- **Logo on accent** → `bg-[var(--ent-accent)]`, `text-[var(--ent-text-inverse)]`.

---

## 2.1 Refactor Examples

### Button (primary / danger / ghost)
```tsx
// Primary
className="bg-[var(--ent-accent)] text-[var(--ent-text-inverse)] hover:bg-[var(--ent-accent-hover)] focus:ring-[var(--ent-focus-ring)]"
// Danger
className="bg-[var(--ent-danger)] text-[var(--ent-text-inverse)] hover:opacity-90"
// Ghost
className="text-[var(--ent-text-secondary)] hover:bg-[var(--ent-hover-surface)] hover:text-[var(--ent-text-primary)]"
```
Add `data-ent-focusable` for focus ring; disabled: `disabled:bg-[var(--ent-disabled-bg)] disabled:text-[var(--ent-disabled-text)]`.

### Card (default / highlight)
```tsx
// Default
className="bg-[var(--ent-surface-2)] border border-[var(--ent-border)] shadow-[var(--ent-shadow-card)]"
// Highlight
className="bg-[var(--ent-accent-soft)] border border-[var(--ent-accent)]/20"
```

### Table (header + row + hover)
```tsx
<thead className="bg-[var(--ent-surface-2)] border-b border-[var(--ent-border)]">
  <th className="text-[var(--ent-text-secondary)] font-medium">...</th>
</thead>
<tbody>
  <tr className="border-b border-[var(--ent-divider)] hover:bg-[var(--ent-hover-surface)]">
    <td className="text-[var(--ent-text-primary)]">...</td>
  </tr>
</tbody>
```

### Sidebar nav item (active + hover)
```tsx
<Link
  className={cn(
    "block px-3 py-2 rounded-lg border-l-2",
    isActive
      ? "border-l-[var(--ent-accent)] bg-[var(--ent-surface-2)] text-[var(--ent-accent)]"
      : "border-l-transparent text-[var(--ent-text-secondary)] hover:bg-[var(--ent-hover-surface)] hover:text-[var(--ent-text-primary)]"
  )}
  href={href}
>
  {label}
</Link>
```

---

## 3. Enforcement Strategy

### 3.1 Search and remove hard-coded colors
- Grep for: `#[0-9a-fA-F]{3,8}`, `rgb(`, `rgba(`, `bg-red-`, `text-red-`, `bg-amber-`, `text-amber-`, `bg-green-`, `text-green-`, `border-red-`, `border-amber-`, `border-green-`, `text-surface-`, `bg-surface-`, `border-primary-`, `text-primary-` (when used for non-brand semantic).
- Replace with Tailwind `ent` colors or arbitrary `var(--ent-*)`.

### 3.2 Tailwind usage
- Prefer: `bg-ent-surface-2`, `text-ent-text-primary`, `border-ent-border`, `bg-ent-danger-soft`, `text-ent-danger`.
- When no utility exists: `bg-[var(--ent-success-soft)]`, `text-[var(--ent-success)]`.
- Never: `bg-gray-100`, `text-red-600`, `border-primary-200` inside clinic UI.

### 3.3 Future components
- Lint rule: disallow hex in `src/components/**` and `src/app/(clinic)/**` (e.g. stylelint or custom ESLint).
- Code review: “Does this use ent tokens?” for any new color.

---

## 4. Visual Balance Rules

- **Background vs surface:** Surface-1 and surface-2 must meet contrast for text-primary (4.5:1 minimum).
- **Accent usage:** Primary buttons and active states only; avoid accent on more than ~10% of viewport.
- **Status colors:** Only for meaning (success/warning/danger/info). No decorative use.
- **No random color:** Every color must map to a token and a semantic role.

---

## 5. Validation Checklist

- [ ] No hex colors in clinic components (except in `ent-tokens.css`).
- [ ] No Tailwind default palette (red-*, amber-*, green-*, slate-*, etc.) in clinic UI.
- [ ] All interactive elements have hover state using tokens.
- [ ] All focusable elements have focus ring using `--ent-focus-ring`.
- [ ] Disabled state uses `--ent-disabled-bg` and `--ent-disabled-text`.
- [ ] Buttons: primary → accent, danger → danger, ghost → hover-surface.
- [ ] Badges use *-soft backgrounds + semantic text color.
- [ ] Cards use surface-2, border, shadow tokens.
- [ ] Tables use surface-2, divider, hover-surface.
- [ ] Notifications use danger/warning/info tokens.
- [ ] Contrast checked for text-primary on surface-1 and surface-2.
- [ ] Dark and light themes both tested (if applicable).
- [ ] No `#fff` / `#000` or raw hex in layout or clinic components; use `--ent-text-inverse`, `--ent-text-primary`, etc.
