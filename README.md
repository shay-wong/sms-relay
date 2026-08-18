# sms-relay

Relay iPhone Shortcuts SMS automation webhooks directly to a Feishu app bot, with OpeniLink Hub available as a legacy fallback.

## Configuration

Copy the example env file and fill in real values:

```bash
cp .env.example .env
```

Required values:

- `TOKEN`: shared secret for the webhook endpoint
- `WEBHOOK_PATH`: webhook endpoint path, defaults to `/sms`; set `/` to accept root-path POST requests
- `HEALTH_PATH`: health check endpoint path, defaults to `/health`
- `LOG_LEVEL`: log level, defaults to `info`; supported values are `debug`, `info`, `error`, `silent`, `off`
- `LARK_APP_ID`: Feishu custom app ID
- `LARK_APP_SECRET`: Feishu custom app secret
- `LARK_RECEIVE_ID`: private-message recipient identifier
- `LARK_RECEIVE_ID_TYPE`: `open_id`, `user_id`, `union_id`, or `email`; defaults to `open_id`
- `LARK_BASE_URL`: Feishu OpenAPI base URL; defaults to `https://open.feishu.cn`
- `OPENILINK_URL`, `OPENILINK_SEND_PATH`, `OPENILINK_APP_TOKEN`, `OPENILINK_TO`: legacy fallback used only when Feishu credentials are not configured
- `DEDUPE_TTL_SECONDS`: duplicate SMS suppression window, defaults to `120`; set `0` to disable
- `MAX_BODY_BYTES`: maximum request body size, defaults to `65536`
- `MESSAGE_TEMPLATE`: optional custom text template for forwarded messages
- `MESSAGE_TEMPLATE_FILE`: optional path to a mounted template file; takes precedence over `MESSAGE_TEMPLATE`

## Run

```bash
docker compose up -d --build
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Test forwarding:

```bash
curl -i -X POST "http://127.0.0.1:3000/sms?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"info":"sms","content":"验证码 123456","recipient":"iPhone","sender":"95588","name":"工商银行"}'
```

To accept webhook requests at the root path instead, set:

```env
WEBHOOK_PATH=/
```

Then test with:

```bash
curl -i -X POST "http://127.0.0.1:3000/?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"验证码 123456","sender":"95588","name":"工商银行"}'
```

Logs are written to process stdout/stderr. With Docker Compose, view them with:

```bash
docker compose logs -f sms-relay
```

## Request Fields

English keys are recommended:

```json
{
  "info": "sms",
  "content": "验证码 123456",
  "recipient": "iPhone",
  "sender": "95588",
  "name": "工商银行"
}
```

Chinese keys are also supported:

```json
{
  "信息": "短信",
  "内容": "验证码 123456",
  "收件人": "iPhone",
  "发件人": "95588",
  "名称": "工商银行"
}
```

The forwarded message is sent in Chinese:

```text
短信转发
名称: 工商银行
信息: sms
内容: 验证码 123456
收件人: iPhone
发件人: 95588
```

## Deduplication

The service keeps an in-memory SHA-256 fingerprint of recent SMS fields and skips repeats within `DEDUPE_TTL_SECONDS`.

This is designed for iPhone Shortcuts automations where several keyword rules can match the same verification SMS. The raw SMS body is not stored in the dedupe cache, and the cache is cleared when the container restarts.

## Message Template

By default, only populated fields are shown:

```text
短信转发
名称: 工商银行
内容: 验证码 123456
发件人: 95588
```

Set `MESSAGE_TEMPLATE` to control the exact forwarded text:

```env
MESSAGE_TEMPLATE=【{{name}}】{{content}}
```

Available placeholders:

- `{{info}}`
- `{{content}}`
- `{{recipient}}`
- `{{sender}}`
- `{{name}}`

Placeholders are plain-text replacements. Triple braces are accepted too:

```env
MESSAGE_TEMPLATE={{{content}}}
```

Use `:` to provide a default value when a field is empty:

```env
MESSAGE_TEMPLATE=【{{name:未知来源}}】{{content:无内容}}
```

The older `{{name|未知来源}}` form is still supported for compatibility.

For multiline templates, mount a file and set `MESSAGE_TEMPLATE_FILE`:

Example: `examples/message-template.txt`

```text
【{{name:未知来源}}】
{{content:无内容}}
发件人：{{sender:未知}}
收件人：{{recipient:未知}}
信息：{{info:未知}}
```

```bash
cp examples/message-template.txt message-template.txt
```

```yaml
services:
  sms-relay:
    image: shaywong/sms-relay:<version>
    network_mode: host
    env_file:
      - .env
    volumes:
      - ./message-template.txt:/app/config/message-template.txt:ro
```

```env
MESSAGE_TEMPLATE_FILE=/app/config/message-template.txt
```

## iPhone Shortcuts

Create an automation for Messages, then use "Get Contents of URL":

- URL: `http://your-server-ip/sms?token=...`
- Method: `POST`
- Body: JSON
- Fields: `info`, `content`, `recipient`, `sender`, `name`

If `WEBHOOK_PATH=/`, use `http://your-server-ip/?token=...` instead.

## Feishu Private Messages

Create an enterprise custom app in the Feishu developer console, enable its bot capability, and grant `im:message:send_as_bot`. Publish the app and include the recipient in its availability scope.

The recipient must open a direct conversation with the bot once. This establishes the direct-message relationship; unlike the WeChat iLink flow, no periodic keepalive message is required.

Configure the relay:

```env
LARK_APP_ID=cli_xxx
LARK_APP_SECRET=xxx
LARK_RECEIVE_ID_TYPE=open_id
LARK_RECEIVE_ID=ou_xxx
```

`email` can be used instead when it is easier to identify the recipient:

```env
LARK_RECEIVE_ID_TYPE=email
LARK_RECEIVE_ID=user@example.com
```

## CI/CD

GitHub Actions runs tests for pull requests and `main` pushes. After a successful `main` build, it publishes immutable `sha-<commit>` images to GHCR and Docker Hub, then deploys that exact Docker Hub image to production. A failed health check restores the previous Compose configuration and container image.

The application is deployed as one image. A frontend added to this repository and copied by the `Dockerfile` will therefore be released with the backend by the same pipeline.

The `production` GitHub Environment requires:

- Secret `DEPLOY_SSH_KEY`: restricted deployment private key
- Variable `DEPLOY_HOST`: production server address
- Variable `DEPLOY_PORT`: SSH port, normally `22`
- Variable `DEPLOY_USER`: restricted key owner
- Variable `DEPLOY_KNOWN_HOSTS`: pinned SSH host key

The matching public key must use a forced command that runs `ops/deploy-sms-relay` on the server. It accepts only immutable `sha-<commit>` image tags.

Version tags continue to publish versioned and `latest` images:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

For Docker Hub, configure repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

By default the Docker Hub image name is `<DOCKERHUB_USERNAME>/sms-relay`.
To publish under an organization or another Docker Hub namespace, set repository variable `DOCKERHUB_NAME`.
If `DOCKERHUB_NAME` is empty, it falls back to `DOCKERHUB_USERNAME`.

To override the full image name, set repository variable `DOCKERHUB_IMAGE`, for example:

```text
shay/sms-relay
```
