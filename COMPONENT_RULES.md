# Component Rules

Use this file as the default checklist when adding or refactoring UI components.

## Structure
- Create a folder per component: `ComponentName/`.
- Inside the folder, keep `ComponentName.tsx` and `ComponentName.module.css`.
- Export the component as the default export from `ComponentName.tsx`.
- Keep exactly one component per file.

## Styling
- Use CSS Modules for component-specific styles.
- Prefer class names that match the component file name in camelCase.
- Keep layout or page-level styles in the page-level module (not in global CSS).
- Only use `:global(...)` when styling shared utility classes like `.button`.

## Imports
- Import only the CSS module used by the component.
- Avoid importing parent or sibling styles from other components.
- Prefer relative imports within the component folder.

## UI Conventions
- Keep inline styles to small, local tweaks that are not worth a class.
- Do not rely on global utility classes for components.
- If a style or UI element is reused, create a shared atom in `app/components/atoms/` with its own CSS module.
- Keep component bodies focused on rendering; move side effects, data prep, and event wiring into hooks.
- Extract helper functions into a colocated `.helper.ts` file.

## Example
```
app/room/[roomId]/components/Example/
  Example.tsx
  Example.module.css
```
