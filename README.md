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
信息: sms
内容: 验证码 123456
收件人: iPhone
发件人: 95588
名称: 工商银行
```

## iPhone Shortcuts

Create an automation for Messages, then use "Get Contents of URL":

- URL: `http://your-server-ip/sms?token=...`
- Method: `POST`
- Body: JSON
- Fields: `info`, `content`, `recipient`, `sender`, `name`

## Docker Image Publishing

GitHub Actions builds images for GHCR and Docker Hub.

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
