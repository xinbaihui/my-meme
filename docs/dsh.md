# Native DSH Web demo

## Role in My Meme

DSH Web is the live interview experience: native Chat handles messages and
user questions, results are displayed by DSH, and Trajectory exposes execution
events. The separate portfolio presents a brief Overview and saved evaluation
evidence. Its live-demo link opens DSH in a new tab; there is no iframe or
custom Chat component.

## Local startup

From the My Meme repository root:

```bash
node scripts/start-dsh.mjs
```

The helper runs `npm_config_cache="$PWD/.npm-cache" npx --yes @deepseek-ai/dsh web --no-open --port 3080`. It automatically captures the startup token and supplies a fixed local entry on port 3081. Stop any existing DSH process before starting it.

This command uses the current DSH configuration and does not pin a CLI version
or require a new `DSH_HOME`. If the shell already defines `DSH_HOME`, keep using
that same setting for startup and plugin installation.

Open the complete startup URL printed by DSH. Select the My Meme repository as
the Web workspace so `.agents/skills/meme-selection/SKILL.md` is available.
Configure model access and make `GIPHY_API_KEY` available to the runtime for
live GIF searches. DSH uses its own profile/session state; starting the Python
API is not required.

## First plugin setup

Build the standalone plugin independently:

```bash
cd plugin
pnpm install --frozen-lockfile
pnpm run build
```

Then, from the repository root, install it into the same Web profile:

```bash
npm_config_cache="$PWD/.npm-cache" npx --yes @deepseek-ai/dsh web --help
npm_config_cache="$PWD/.npm-cache" npx --yes @deepseek-ai/dsh plugin --profile web add "$PWD/plugin"
```

The source stays in `plugin/`. The plugin declares compatibility
with the DSH `0.2.0-rc.2` API; the startup command follows the existing unpinned
CLI workflow. Verify compatibility when changing the installed DSH version.

## Interview publishing plan

Publish a running DSH Web service, not only its static assets. Hosting and
browser access are separate from deploying the portfolio. A public address,
working browser authentication, and the expected My Meme workspace/tools must
be verified before sharing the demo. Public deployment is not yet implemented
in this repository. See the upstream
[Web deployment guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/public-deployments.md)
for deployment-specific configuration supported by the chosen DSH version.

## Local portfolio link

The local frontend configuration points “Try My Meme” to
`http://127.0.0.1:3081/`. Start DSH with `node scripts/start-dsh.mjs` (or
`make dev-dsh`), then use the Overview button. The helper redirects to the
current tokenized DSH URL on port 3080. Tokens stay in memory; redirects are not
cached. Restarting the helper captures the new token without editing the frontend.
Keep the helper running. This loopback entry is for local interviews, not remote
visitors. Running the original `npx ... web --no-open` command directly still
works, but does not start the automatic portfolio entry.

For public hosting, once a public base address is available:

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Set `NEXT_PUBLIC_DSH_WEB_URL` to that HTTP(S) base address.
3. Restart frontend development or rebuild the deployed portfolio.
4. Verify the “Try My Meme” link and DSH access in a fresh browser session.

The setting is visible in the public frontend; do not include a launch token or
API key. The link itself does not authenticate the visitor. Until configured,
the Overview shows “Live demo coming soon”. No per-user isolation is supplied
by the portfolio, and the demo has not been validated as a multi-user service.
