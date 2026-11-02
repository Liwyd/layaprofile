# TODO.md — LayaProfile Project Constitution

## Product Rules
- LayaProfile must remain lightweight.
- Laya must run locally, without requiring a paid cloud AI API.
- Core functionality must not depend on an external AI provider.
- GitHub public data must be handled responsibly.
- Analysis results must be explainable.
- Missing information must never be presented as a verified negative result.
- AI predictions must not be treated as unquestionable facts.

## Engineering Rules
- No unnecessary microservices.
- No unnecessary databases.
- No unnecessary dependencies.
- No speculative abstractions.
- No duplicated business logic.
- No secrets in source code.
- No hardcoded deployment credentials.
- No unverified API assumptions.
- No silent swallowing of errors.
- No committing known failing changes.
- No disabling tests simply to make CI pass.

## UX Rules
- No generic AI-generated-looking dashboard.
- No excessive gradients.
- No excessive glassmorphism.
- No unnecessary animations.
- No decorative elements that reduce readability.
- Responsive behavior is mandatory.
- Accessibility and keyboard navigation must be considered.
- Loading, empty, partial, and error states must be designed.

## Testing and Git Rules
- Run relevant tests before every commit.
- Run relevant build checks before every commit.
- Never commit known broken code.
- Use short, one-line commit messages.
- Push completed implementation commits to the GitHub repository.
- Keep PLAN.md synchronized with the actual repository state.

## Deployment Rules
- The project must be Dockerized.
- GitHub Actions must validate changes.
- Docker images must be published to Docker Hub using GitHub Actions secrets.
- Deployments must pull published images from Docker Hub rather than rebuild the application on the deployment server.
- Model weights and runtime cache must not be unnecessarily included in the Docker image.
