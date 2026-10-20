# Native DSH Web demo

## Role in My Meme

DSH Web is the live interview experience: native Chat handles messages and
user questions, results are displayed by DSH, and Trajectory exposes execution
events. The separate frontend presents saved evaluation evidence. Its live-demo
link opens DSH in a new tab; there is no iframe or
custom Chat component.

## Local startup

From the My Meme repository root:

```bash
node scripts/start-dsh.mjs
```

The helper runs `npm_config_cache="$PWD/.npm-cache" npx --yes @deepseek-ai/dsh web --no-open --port 3080`. When `DSH_TRUSTED_HOST` is set, it appends one `--trusted-host` argument for that hostname or IP address. It automatically captures the startup token and supplies a fixed local entry on port 3081. Stop any existing DSH process before starting it.

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

## Public interview deployment

The interview service runs on the Ubuntu ECS host and is available through
`https://121.40.130.20/demo`. Nginx terminates TLS with a short-lived
Let's Encrypt IP certificate and requires Basic Authentication. It proxies only
to loopback services: DSH on port 3080 and the current-token redirect helper on
port 3081. Neither port is exposed by the ECS security group.

The `my-meme-dsh` systemd unit starts both loopback services at boot and restarts
them after failure. Certbot renews the certificate and a deploy hook reloads
Nginx. The public frontend stores only the stable `/demo` URL; the process token
remains on the server. See the upstream
[Web deployment guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/public-deployments.md)
for the proxy requirements followed here.

The systemd environment file sets `DSH_TRUSTED_HOST=121.40.130.20`. This keeps
the deployment-specific address out of source code while allowing DSH's browser
trust fence to accept the public authority.

## Local portfolio link

The local frontend configuration points “Try My Meme” to
`http://127.0.0.1:3081/`. Start DSH with `node scripts/start-dsh.mjs` (or
`make dev-dsh`), then use the “Try My Meme” link. The helper redirects to the
current tokenized DSH URL on port 3080. Tokens stay in memory; redirects are not
cached. Restarting the helper captures the new token without editing the frontend.
Keep the helper running. This loopback entry is for local interviews, not remote
visitors. Running the original `npx ... web --no-open` command directly still
works, but does not start the automatic portfolio entry.

For the deployed interview site:

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Set `VITE_DSH_WEB_URL=https://121.40.130.20/demo`.
3. Restart frontend development or rebuild the deployed portfolio.
4. Verify the “Try My Meme” link and DSH access in a fresh browser session.

The setting is visible in the public frontend; do not include a launch token or
API key. Nginx authenticates the visitor before the helper resolves the current
process token. Until configured, the demo link is hidden.
The deployment is intended for controlled interview access, not concurrent
untrusted users.
