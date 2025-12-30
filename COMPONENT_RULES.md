# Component Rules

Use this file as the default checklist when adding or refactoring UI components.

## Structure
- For route segments (e.g. `app/room/[roomId]`), keep only `page.tsx` and `page.module.css` in the route folder.
- Place rendered UI in a subfolder named after the component (kebab-case), e.g. `room-view/`.
- The top-level folder uses `folder-name.component.tsx` and `folder-name.module.css`.
- Components rendered inside that folder live in their own subfolders and follow `ComponentName/ComponentName.tsx` and `ComponentName.module.css`.
- Colocate helpers and types as `folder-name.helper.ts` and `folder-name.types.ts`.
- Keep one component per `.component.tsx`.

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
app/room/[roomId]/page.tsx
app/room/[roomId]/page.module.css
app/room/[roomId]/room-view/
  room-view.component.tsx
  room-view.module.css
  RoomHeader/
    RoomHeader.tsx
    RoomHeader.module.css
```
