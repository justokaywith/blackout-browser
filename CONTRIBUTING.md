# Contributing to Blackout Browser

Thank you for your interest in contributing to Blackout Browser! We welcome bug reports, documentation polish, feature requests, and code contributions.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect and kindness.

---

## Development Workflow

### 1. Fork and Clone
Fork the repository and clone it to your local machine:

```sh
git clone https://github.com/<your-username>/blackout-browser.git
cd blackout-browser
```

### 2. Install Dependencies
Ensure you have Node.js 22 or newer installed:

```sh
npm ci
```

### 3. Run Development Build
To start the browser in development mode:

```sh
npm start
```

### 4. Run Automated Tests
Before submitting any changes, verify that all regression tests pass:

```sh
npm test
```

All 110+ automated tests must pass cleanly.

---

## Guidelines for Contributions

1. **Privacy First:** Never introduce external tracking scripts, third-party analytics pixels, or unauthorized remote network requests.
2. **Preserve Documentation & Comments:** Maintain existing inline comments and architectural notes across the codebase.
3. **No Hardcoded Secrets or Credentials:** Never commit API keys, personal login tokens, or live credentials.
4. **Follow Minimalist Code Style:** Keep dependencies minimal. Favor native Node.js and Chromium capabilities over heavy npm packages.

---

## Submitting Pull Requests

1. Create a descriptive branch: `git checkout -b feature/my-new-feature`
2. Commit your changes with clear, concise commit messages.
3. Push to your fork: `git push origin feature/my-new-feature`
4. Open a Pull Request against the `main` branch with:
   - A clear description of the problem solved.
   - Evidence of test execution (`npm test` output).
   - Any relevant screenshots for UI enhancements.
