# Private Data Policy

## Principle

The GitHub repository contains only reusable application code, schemas, prompts, empty examples, documentation, and tests. Personal Pokémon Sleep account data must remain on the user's device.

## Never commit

- Gameplay screenshots or screenshot ZIP archives
- Personal SQLite databases or exports
- Completed AI update packages containing account data
- Pokémon box, ingredient, item, recipe unlock, weekly plan, or collection data
- Any file under `private-data/`, `local-data/`, `screenshots/`, `imports/private/`, or `exports/private/`

The repository `.gitignore` excludes common private artifacts. GitHub Actions also runs `Private Data Guard` and rejects tracked private file types or paths.

## Supported private initialization workflow

1. Keep screenshots or their ZIP archive outside the repository.
2. Ask an AI to generate an Update Package v1.1 JSON locally.
3. Open the deployed PWA on the target device.
4. In Update Center, select the JSON, validate it, review flagged operations, run Dry Run, and apply it.
5. The resulting SQLite database is stored in browser IndexedDB on that device.
6. Download a private SQLite backup and store it outside GitHub.

## Multiple screenshots

For multiple game screenshots, compress them into one ZIP before sending them to the AI. Use clear, unique filenames so `evidence.source_image_ref` can map every operation back to its source image.

## Repository visibility

Making the code repository private does not automatically make a GitHub Pages site private. A private repository can publish Pages when the account plan supports private-repository Pages, but a privately accessible Pages site requires GitHub Enterprise Cloud organization access control.
