# sms-relay

Relay iPhone Shortcuts SMS automation webhooks to OpeniLink Hub.

## Configuration

Copy the example env file and fill in real values:

```bash
cp .env.example .env
```

Required values:

- `TOKEN`: shared secret for `/sms`
- `OPENILINK_URL`: Hub URL, usually `http://127.0.0.1:9800`
- `OPENILINK_APP_TOKEN`: OpeniLink App token with `message:write`
- `OPENILINK_TO`: WeChat user id from Hub contacts, usually `xxx@im.wechat`
- `DEDUPE_TTL_SECONDS`: duplicate SMS suppression window, defaults to `120`; set `0` to disable
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

The WeChat message is sent in Chinese:

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

## Docker Image Publishing

GitHub Actions builds and publishes images for GHCR and Docker Hub only when a version tag is pushed.

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
