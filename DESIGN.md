# Product design

## Product intent

Build a dependable, self-hostable visual automation tool for automation consultants and technical operators at small teams. A user should be able to assemble a workflow, run it with real data, and understand what happened when a step fails.

This product takes inspiration from node-based automation tools. It uses its own visual identity, interface language, and interaction details.

## Design principles

1. **Make the run legible.** Show workflow structure, current execution state, and step-level data without making users hunt through separate screens.
2. **Keep the canvas quiet.** The workflow is the main content. Toolbars and inspectors support it without competing for attention.
3. **Expose complexity progressively.** Start each node with the settings needed for its common case. Keep advanced options available when needed.
4. **Make failures actionable.** Name the failed step, show the relevant error, and offer the next useful action.
5. **Keep frequent actions immediate.** Saving, searching, keyboard commands, and canvas selection should not feel delayed by decorative motion.
6. **Use one vocabulary.** Keep action labels, status names, and completion messages consistent across the product.

## Visual direction

Use a precise, calm control-room aesthetic. A pale neutral workspace gives the graph room to breathe. Strong blue marks the primary action and selected path. Green, amber, and red communicate execution state only. Use borders and spacing to group information before adding cards or shadows.

The workflow graph is the memorable visual element. Keep surrounding chrome compact and restrained. Align text to the start edge. Reserve monospace for expressions, IDs, timestamps, and structured values.

### Core color tokens

Use OKLCH values in CSS. Keep semantic colors separate from decorative colors, and derive hover, tint, and transparent variants with `color-mix(in oklch, ...)`.

| Token       | Light value              | Use                                      |
| ----------- | ------------------------ | ---------------------------------------- |
| `--canvas`  | `oklch(0.985 0.004 250)` | App and canvas background                |
| `--surface` | `oklch(1 0 none)`        | Inspector and menus                      |
| `--ink`     | `oklch(0.24 0.025 250)`  | Primary text                             |
| `--muted`   | `oklch(0.52 0.025 250)`  | Secondary text                           |
| `--line`    | `oklch(0.89 0.012 250)`  | Borders and separators                   |
| `--action`  | `oklch(0.53 0.19 260)`   | Primary actions and selection            |
| `--success` | `oklch(0.56 0.14 160)`   | Successful execution                     |
| `--warning` | `oklch(0.70 0.16 75)`    | Warnings and waiting state               |
| `--danger`  | `oklch(0.58 0.21 25)`    | Failed execution and destructive actions |

Defer dark mode until after the MVP. Keep semantic token names stable so a second theme can be added without changing component APIs.

### Typography

- Use **Geist Sans** for interface text and headings.
- Use **Geist Mono** for expressions, IDs, timestamps, and JSON values.
- Keep headings sentence case and labels short. Avoid all-caps micro-labels.
- Keep prose lines below roughly 80 characters. Let the graph and data tables use the width they need.

### Layout and hierarchy

The single-user app uses four functional areas: a narrow navigation rail, a large canvas, a contextual inspector, and a first-party wiki. The user can create a separate workspace for each client, with workflows and credentials isolated by workspace. The inspector opens when a user selects a node. On smaller screens, the inspector becomes a sheet so the canvas remains usable. The wiki explains how to build, run, and troubleshoot workflows.

```text
┌──────────┬───────────────────────────────────────┬──────────────────┐
│ Workspaces│ Workflow title · Save · Test · Active │ Node inspector   │
│          ├───────────────────────────────────────┤                  │
│ Flows    │                                       │ Settings         │
│ Runs     │              Workflow canvas          │ Input / output   │
│ Wiki     │                                       │                  │
│          │                                       │                  │
└──────────┴───────────────────────────────────────┴──────────────────┘
```

Let the canvas take remaining space. Keep the navigation and inspector independently scrollable. Keep the editor shell within the dynamic viewport so the primary controls remain visible on mobile browsers.

## Component and interaction choices

- **Canvas:** React Flow (`@xyflow/react`) with custom nodes and edges. Use it for node placement, connections, selection, pan, and zoom.
- **Accessible primitives:** shadcn/ui configured with **Base UI** for dialogs, menus, popovers, and selects.
- **Shared editor state:** Zustand when state must coordinate the canvas, inspector, and toolbar. Keep isolated control state local.
- **Command menu:** `cmdk` for node search and keyboard commands.
- **Notifications:** Sonner for save and run feedback. Keep detailed execution errors in the inspector or run view.
- **Structured values:** Shiki for syntax-highlighted JSON and expressions.
- **Long histories:** Virtuoso only when measured execution history needs list virtualization.
- **Motion:** Motion for gesture-driven or layout transitions. Use CSS for ordinary color changes and simple feedback.

The first vertical slice is a manual or webhook trigger, an HTTP request, a condition, a Google Sheets append action, and an email action. It must expose the result of every step in the run inspector.

### Interaction rules

- Make the entire node body easy to select. Keep connection handles visually clear and large enough to use.
- Show keyboard focus with `:focus-visible` and an outline. Do not remove the browser outline without an equivalent.
- Give pressable controls a visible `:active` state.
- Put hover styling inside `@media (hover: hover) and (pointer: fine)`.
- Use transitions only for named properties. Put movement and scale transitions under `prefers-reduced-motion: no-preference`.
- Keep keyboard-triggered actions immediate. Avoid animated command-menu and shortcut responses.
- Give empty, loading, success, and failure states a clear message and next action.

## CSS rules

Apply the `good-css` skill in the project's existing styling system.

- Use logical properties such as `padding-inline` and `inset-block-start`.
- Use `oklch()` for colors and `color-mix()` for derived colors.
- Use `clamp()` tokens for sizes that should scale with the viewport.
- Use intrinsic grid sizing instead of breakpoint-specific column counts where it fits.
- Use `overflow: clip` for visual clipping. Use `overflow: hidden` only when code needs a scroll container.
- Respect reduced motion and avoid `transition: all` and `ease-in`.
- Read the relevant `good-css` reference before implementing layout, interaction, motion, or scroll behavior.

## Product language

Use plain action labels that describe their outcome. Keep the same verb across the action, status, and confirmation. Prefer “Run workflow”, “Save changes”, and “Activate” over vague labels such as “Submit” or “Done”.

Errors name the step and explain how to recover. Empty states point to a concrete next action. Keep technical identifiers and raw payloads available without making them the first thing a new user sees.

## Landing page

The public landing page introduces the product before a user enters the editor. Show a real example workflow and its inspectable run result in the first screen. Explain self-hosting, client workspaces, and step-level run visibility in plain language. Use one primary action that takes the user to setup or the app. Keep the page within the same visual system as the editor.

## Accessibility and responsive behavior

- Support keyboard access to navigation, node selection, configuration, and execution controls.
- Keep focus visible and preserve meaningful labels for icon-only controls.
- Do not rely on color alone for execution state. Pair color with text or an icon.
- Respect reduced-motion preferences.
- Keep controls usable on touch screens. Do not make hover the only way to discover an action.
- Use a compact navigation and a sheet inspector on narrow screens. Do not shrink the canvas until nodes and connections become unusable.

## Decisions after the MVP

- Add team access only after users need multiple people inside one client workspace.
- Revisit a distributed queue only when measured execution volume or deployment needs exceed the initial PostgreSQL-backed worker queue.
- Add dark mode after the MVP.
