# Clinic Connect — Enterprise Design System

**Version:** 1.0  
**Target:** Internal back-office (clinic dashboard), dark-first, multi-tenant AI SaaS for aesthetic clinics  
**Philosophy:** Premium Medical-Tech, institutional-grade, data-driven, zero playful/startup patterns

---

## Quick Start

1. **Import tokens:** Add `import "@/app/ent-tokens.css"` to `src/app/layout.tsx` (or clinic layout).
2. **Apply theme:** Wrap clinic layout in `<div className="ent-theme min-h-screen bg-ent-bg">` or `data-theme="enterprise"`.
3. **Fonts:** Add Inter + JetBrains Mono to `layout.tsx` (see §6.4).
4. **Tailwind:** Use `bg-ent-bg`, `text-ent-text-primary`, `border-ent-border`, etc. (config extended).

---

## 1. Design Tokens

### 1.1 Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--ent-bg` | `#0d0f12` | Page background (deep charcoal) |
| `--ent-surface-1` | `#14171c` | Sidebar, topbar, primary cards |
| `--ent-surface-2` | `#1a1e24` | Elevated cards, dropdowns |
| `--ent-surface-3` | `#23282f` | Hover states, inputs, table rows |
| `--ent-border` | `rgba(255,255,255,0.06)` | Subtle border |
| `--ent-border-hover` | `rgba(255,255,255,0.1)` | Hover border |
| `--ent-divider` | `rgba(255,255,255,0.04)` | Section dividers |
| `--ent-text-primary` | `#ffffff` | Headers, primary content |
| `--ent-text-secondary` | `#a1a8b2` | Labels, secondary text |
| `--ent-text-muted` | `#6b7280` | Placeholder, disabled |
| `--ent-accent` | `#3b82f6` | Primary CTA, links, active |
| `--ent-accent-hover` | `#2563eb` | Hover on accent |
| `--ent-success` | `#10b981` | Success states, positive delta |
| `--ent-warning` | `#f59e0b` | Warning, pending |
| `--ent-danger` | `#ef4444` | Error, destructive |
| `--ent-overlay` | `rgba(0,0,0,0.6)` | Modal backdrop |

### 1.2 Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--ent-font-sans` | `Inter, system-ui, sans-serif` | Body, UI |
| `--ent-font-mono` | `JetBrains Mono, monospace` | Code, IDs |
| `--ent-text-xs` | `0.75rem` | Captions |
| `--ent-text-sm` | `0.875rem` | Labels, table cells |
| `--ent-text-base` | `1rem` | Body |
| `--ent-text-lg` | `1.125rem` | Subheadings |
| `--ent-text-xl` | `1.25rem` | Card titles |
| `--ent-text-2xl` | `1.5rem` | Section headers |
| `--ent-text-3xl` | `1.875rem` | Page titles |
| `--ent-font-medium` | `500` | Labels |
| `--ent-font-semibold` | `600` | Headers |
| `--ent-font-bold` | `700` | KPI numbers |
| `--ent-leading-tight` | `1.25` | Headers |
| `--ent-leading-normal` | `1.5` | Body |

### 1.3 Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--ent-space-1` | `4px` | Tight gaps |
| `--ent-space-2` | `8px` | Icon padding |
| `--ent-space-3` | `12px` | Inline gaps |
| `--ent-space-4` | `16px` | Card padding (small) |
| `--ent-space-5` | `20px` | — |
| `--ent-space-6` | `24px` | Grid gutter, card padding |
| `--ent-space-8` | `32px` | Section gaps |
| `--ent-space-10` | `40px` | Page sections |
| `--ent-space-12` | `48px` | Major sections |
| `--ent-max-w` | `1440px` | Layout max width |
| `--ent-content-w` | `1200px` | Content area max |
| `--ent-sidebar-w` | `256px` | Sidebar expanded |
| `--ent-sidebar-collapsed` | `72px` | Sidebar collapsed |
| `--ent-topbar-h` | `56px` | Topbar height |

### 1.4 Elevation & Shadow

| Token | Value | Usage |
|-------|-------|-------|
| `--ent-shadow-none` | `none` | Flat surfaces |
| `--ent-shadow-modal` | `0 24px 48px -12px rgba(0,0,0,0.5)` | Modal |
| `--ent-shadow-dropdown` | `0 8px 24px -4px rgba(0,0,0,0.4)` | Dropdown |
| `--ent-shadow-card` | `0 1px 0 rgba(255,255,255,0.04)` | Card subtle edge |

**Rule:** Use surface elevation (background color shift) instead of heavy shadows. Shadow only for modal and dropdown.

### 1.5 Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--ent-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | ease-out |
| `--ent-duration-fast` | `150ms` | Micro-interactions |
| `--ent-duration` | `200ms` | Default transitions |
| `--ent-duration-slow` | `250ms` | Modal, drawer |

**Rules:** No bounce. No playful animation. Skeleton for loading; no spinner-only states.

### 1.6 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--ent-radius-sm` | `6px` | Badge, chip |
| `--ent-radius-md` | `8px` | Input, button |
| `--ent-radius-lg` | `12px` | Card |
| `--ent-radius-xl` | `16px` | Modal |

---

## 2. Layout Architecture

### 2.1 Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ Topbar (fixed, h=56px)                                           │
├─────────┬────────────────────────────────────────────────────────┤
│ Sidebar │ Main Content                                           │
│ 256/72  │ max-w 1200, px-24, py-24                               │
│         │                                                        │
│         │ ┌─────────────────────────────────────────────────────┐│
│         │ │ Page Header (title, date, branch filter)            ││
│         │ ├─────────────────────────────────────────────────────┤│
│         │ │ Content area (responsive grid, 12-col)               ││
│         │ └─────────────────────────────────────────────────────┘│
└─────────┴────────────────────────────────────────────────────────┘
```

### 2.2 Sidebar Sections

**Core**
- Dashboard
- Customers
- Booking
- Promotions

**Intelligence**
- Insights
- Knowledge
- Knowledge Brain
- AI Agents

**Operations**
- Finance
- Slot Settings
- Users

**System**
- Settings
- Feedback
- Admin Monitoring (owner only)

**Behavior:** Collapsible to icon-only (72px). Active route: left border + subtle surface-2 bg. Hover: surface-2 bg. No glow.

### 2.3 Topbar

- Left: Logo (collapsed sidebar toggle inline)
- Center: Branch selector (when multi-branch)
- Right: Global search (icon), Notification bell, User menu
- Current org name in user menu dropdown

---

## 3. Component Specifications

### 3.1 Buttons

| Variant | Bg | Text | Border | Hover |
|---------|-----|------|--------|-------|
| Primary | accent | white | none | accent-hover |
| Secondary | surface-2 | text-primary | border | surface-3 |
| Ghost | transparent | text-secondary | none | surface-2 |
| Danger | danger/10 | danger | danger/30 | danger/20 |
| Icon | transparent | text-secondary | none | surface-2 |

**Loading:** Opacity 0.7, pointer-events none, skeleton bar or spinner (small, muted).  
**Disabled:** opacity 0.5, cursor not-allowed.

### 3.2 Inputs

- Bg: surface-2
- Border: border (default), accent (focus), danger (error)
- Text: text-primary
- Placeholder: text-muted
- Height: 40px (md), 44px (lg)
- Padding: 12px 16px
- Radius: md
- Helper text: text-sm, text-muted, mt-1
- Error: text-danger, text-sm

**Floating label:** Optional; if used, label animates up on focus/filled.

### 3.3 Tables

- Header: bg surface-1, text-secondary, font-medium, text-xs uppercase, sticky top-0
- Row: border-b border
- Row hover: bg surface-2/50
- Cell padding: 12px 16px
- Sortable: caret icon on header, rotate on asc/desc
- Bulk select: Checkbox column, min-w 40px
- Pagination: Bottom, compact (prev/next + page numbers)

### 3.4 Cards

| Type | Bg | Border | Padding |
|------|-----|--------|---------|
| Default | surface-1 | border | 24px |
| Interactive | surface-1 | border | 24px, cursor pointer, hover: surface-2 |
| Analytics | surface-1 | border | 24px, large number + label + delta |
| Highlight | surface-2 | accent/30 | 24px |

### 3.5 Modal

- Backdrop: overlay, 200ms fade
- Panel: surface-1, radius-xl, shadow-modal, 200ms scale (0.98→1) + fade
- Max width: 480px (sm), 560px (md), 640px (lg)
- Centered
- Close: X top-right, Escape key

### 3.6 Drawer

- Right slide-in
- Width: 400px (sm), 480px (md)
- Bg: surface-1
- Shadow: dropdown
- Use for: Booking detail, Edit forms, Customer detail

---

## 4. Page Blueprints

### 4.1 Dashboard

```
[Page Header: Dashboard | Date picker | Branch filter]

[4 KPI cards, grid 4-col]
  Revenue Today | Bookings Today | AI Conversations | Conversion %

[Revenue chart, w-full, h-280]
  Line chart, minimal, 1 color (accent), grid lines subtle

[Booking trend, w-1/2] [Recent bookings table, w-1/2]
  Bar chart | Columns: Time, Customer, Service, Status

[AI Performance panel, full width]
  Summary: response rate, avg latency, escalation count
```

### 4.2 Customers & Chat

```
Two-panel layout (40% | 60% or collapsible)

Left panel:
  [Search input]
  [Branch filter chip]
  [Customer list - avatar, name, unread badge, last message snippet]
  Scroll, virtualized if > 100

Right panel:
  [Conversation header: name, LINE ID, branch]
  [Message thread - grouped by time, intent badge, AI confidence]
  [Escalate to human button]
  [Reply input]

Not WhatsApp clone. CRM-style: structured, badges, actions.
```

### 4.3 Booking

```
Tabs: Calendar | Today Queue | Timeline | Reports

Calendar:
  Full width
  [Doctor filter] [Branch filter]
  Color-coded status dots
  Click slot → right drawer (detail + actions)

Today Queue:
  List by time
  Status pills
  Quick actions

Timeline:
  Gantt-style by doctor

Reports:
  Table + export
```

### 4.4 Knowledge

```
Tabs: Services | FAQ | Promotions | Embedding Status

Each tab:
  [Search] [Filter: status]
  Table: Title, Type badge, Embedding status, Last updated, Actions
  Pagination
```

### 4.5 Knowledge Brain

```
[Health score card]
[Drift alerts list]
[Embedding queue status]
[Approve/reject list - pending items]
[Audit trail table]
```

### 4.6 Finance

```
[Revenue summary cards]
[Transactions table - filter by date, status]
[Subscription info card]
[AI Executive Brief - highlighted card, regenerate button]
  Token cost visible (owner only)
```

### 4.7 Insights

```
[Date range filter] [Branch filter]

Charts (minimal, no gradient explosion):
  Revenue by day
  Intent distribution (bar)
  Booking heatmap
  Top questions
  AI accuracy metric
```

---

## 5. RBAC Visibility Rules

| Route | Owner | Manager | Staff |
|-------|-------|---------|-------|
| Dashboard | ✓ | ✓ | ✓ |
| Customers | ✓ | ✓ | ✓ (branch-scoped) |
| Booking | ✓ | ✓ | ✓ (branch-scoped) |
| Promotions | ✓ | ✓ | ✓ |
| Insights | ✓ | ✓ | ✓ (owner: all branches) |
| Knowledge | ✓ | ✓ | ✓ |
| Knowledge Brain | ✓ | ✓ | — |
| AI Agents | ✓ | ✓ | ✓ |
| Finance | ✓ | ✓ | — |
| Slot Settings | ✓ | ✓ | — |
| Users | ✓ | ✓ | — |
| Settings | ✓ | ✓ | ✓ |
| Feedback | ✓ | ✓ | ✓ |
| Admin Monitoring | ✓ | — | — |

**Implementation:** Sidebar nav items use `allowedRoles`. Hidden routes not rendered. API enforces same rules.

---

## 6. Implementation Strategy

### 6.1 Phased Rollout

1. **Phase 1:** Add enterprise tokens to `globals.css` (new class `.ent-theme` or data attribute `data-theme="enterprise"`). Wire clinic layout root.
2. **Phase 2:** Replace Sidebar + Topbar with new layout component. Collapsible state in Context.
3. **Phase 3:** Page-by-page migration (Dashboard first, then Customers, Booking, etc.).
4. **Phase 4:** Component library (Button, Input, Card, Table) with new tokens.

### 6.2 CSS Variables File

Create `src/app/ent-tokens.css` (or section in globals.css) with all `--ent-*` tokens. Apply to `[data-theme="enterprise"]` or `.clinic-layout` wrapper.

### 6.3 Tailwind Integration

Extend `tailwind.config.ts` with `ent-*` colors and spacing from CSS variables:
```
colors: {
  ent: {
    bg: 'var(--ent-bg)',
    'surface-1': 'var(--ent-surface-1)',
    ...
  }
}
```

### 6.4 Font Loading

```tsx
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'th'], variable: '--ent-font-sans' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--ent-font-mono' });
```

### 6.5 Performance

- Sidebar collapse: CSS transition only, no layout reflow of main content
- Table: `react-window` or `@tanstack/react-virtual` for 100+ rows
- Charts: Dynamic import `next/dynamic` for Recharts
- Lazy load Knowledge Brain, Admin Monitoring panels

---

## 7. UX Reasoning (Key Decisions)

| Decision | Rationale |
|----------|-----------|
| Dark-first | Reduces eye strain for all-day use; signals premium/technical product |
| Surface elevation over shadow | Cleaner, more institutional; avoids "floating card" startup look |
| Inter + JetBrains Mono | High readability at density; mono for IDs/data |
| 8px spacing system | Predictable rhythm; easy mental math |
| No bounce/playful motion | Professional; users are managing business, not entertainment |
| Skeleton over spinner | Reduces perceived wait; shows structure |
| Drawer for detail/edit | Keeps context (list visible); faster than full-page navigation |
| RBAC in nav | Users never see routes they can't access; reduces confusion and errors |
