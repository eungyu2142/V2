# 2026-07-19 Blue Theme Cleanup

- Replaced remaining mint and green CSS accents across diary planning, QNA status/category controls, hospital category icons, location mark, and saved-hospital heart controls with the navy and blue palette.
- Added final blue hover and active elevation rules so interactive controls no longer turn green on mouse or touch interaction.
- Replaced the remaining legacy green palette values in the shared and diary stylesheets.
- Set selected filters, choice buttons, tabs, calendar selections, and navigation states to deep navy `#0f2742` with white text.
- Removed the remaining diary green accents from calendar, record, smart-add, and writing controls.
- Fixed progress-step buttons so the shared selected-button style cannot turn the whole gauge into a square; only the step marker is circular.
- Added a single writing keyword below each writing header: `펫`, `질문`, `나눔`, `기록`, or `계획`.
- Added a shared component design layer for primary/secondary/danger buttons, chips, tags, inputs, cards, sheets, modals, icon buttons, likes, and review forms.
- Standardized shared control height, radius, blue hover/active elevation, white chip surfaces, deep-blue selected states, and circular 44px icon buttons.
- Prevented full-screen modal and bottom-sheet dismiss layers from inheriting button hover/active blue fills; they now remain a neutral deep-navy translucent overlay.
- Increased overlay dismiss-button selector specificity so the profile overlay also stays dark on hover and pointer press.
- Removed the duplicate general care-plan panel from the diary layout; `오늘 할 일` is now the primary panel, with a three-dot menu for adding plans and per-task edit/delete menus.
- Made pet, QNA, share, draft, care-record, reminder, and daily-task actions update local UI state before Supabase synchronization, so server/RPC failures no longer make save or complete buttons appear inert.
- Added a visible map SDK failure state showing the current origin that must be registered in NAVER Cloud Maps Web service URLs.
- Verified with `npm run build`.
- Made daily-plan checkbox completion idempotent so repeated clicks do not create duplicate records; completion remains inline in the diary view.
- Updated diary visualization so the third chart option is a pie chart using date-based record frequency.
- Applied the navy design rule across the remaining legacy CSS accents in App, diary, and global styles; green/mint component states now use the shared blue palette.
