# Coding Rules

## 1. Clean Code & Architecture
- All code must be clean, modular, and strictly follow **SOLID principles**.
- Utilize the **MVC (Model-View-Controller)** pattern where appropriate to maintain strict separation of concerns.
- Always refer to and follow the official framework and language documentation for idiomatic patterns and best practices.

## 2. Frontend & UI Design
- All frontend design tasks must adhere to the design system rules specified in the frontend-design skill: [Frontend Design Skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md).
- You can add the skill via: `npx skills add https://github.com/anthropics/skills --skill frontend-design`
- All dashboards and user interfaces MUST be built using **shadcn/ui** and its components.
- Frontend architecture must remain modular and uphold SOLID principles.

## 3. Backend & Testing
- The backend must have comprehensive and robust test coverage.
- You must write **Unit**, **Integration**, **Smoke**, and **Redundant** tests for all backend logic to guarantee system resilience.

## 4. Pull Requests
- All pull requests MUST be assigned to `dineshkorukonda`.
