## What this changes

<!-- A sentence or two, and the issue it closes, e.g. "Closes #12". -->

## Type

- [ ] New cleanup rule
- [ ] Bug fix
- [ ] Feature
- [ ] UI / design
- [ ] Docs or tooling

## Checklist

- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass
- [ ] New or changed rules have a test that checks what's deleted **and** what survives
- [ ] Every deletion still goes through the guard (`assertDeletable` / `assertTrashable`)
- [ ] UI changes: ran `npm run test:e2e` and attached a screenshot below
- [ ] Updated the README rule table or CHANGELOG if users will notice the change

## Screenshots

<!-- For UI changes. -->
