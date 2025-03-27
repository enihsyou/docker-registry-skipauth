# docker-registry-skipauth

自动以公共身份完成认证，代理 Docker Registry API 请求的 Cloudflare Worker

## 简介

`docker-registry-skipauth` 是一个运行在 Cloudflare Worker 上的代理程序，旨在简化对 Docker Registry API 的访问。
它允许用户无需提供身份认证信息即可访问 Docker Registry API，代理程序会自动以公共匿名身份获取认证 token，并正确传递 HTTP header，返回相应的 API 响应。

## 使用场景

本工具设计用于 **公共镜像代理测速**。

[chsrc](https://github.com/RubyMetric/chsrc) 是一个全平台通用换源工具与框架，但目前 v0.2 仅支持静态测速链接，
而大部分 Docker Registry 需要获取 Bearer Token 才能访问。

使用 `docker-registry-skipauth` 作为代理，可绕过动态认证过程，直接跳转到 blob 下载链接，进而实现镜像测速。

## 安装和配置

按照以下步骤部署你的 Cloudflare Worker：

1. **克隆仓库**
   将项目克隆到本地，安装依赖：

   ```bash
   git clone https://github.com/enihsyou/docker-registry-skipauth.git
   cd docker-registry-skipauth
   npm install
   ```

2. **部署到 Cloudflare**
   使用 Wrangler 工具发布 Worker：

   ```bash
   npm deploy
   ```

## 使用方法

部署完成后，你可以通过 Worker 的 URL 访问 Docker Registry API。例如：

```bash
curl https://your-worker-url.workers.dev/v2/library/alpine/manifests/latest?upstream=registry-1.docker.io
```

通过 `upstream` 参数指定 Docker Registry 的地址，Worker 会自动处理认证并返回响应。

## 开发

当前版本的 `@cloudflare/vitest-pool-workers` 在 Windows 下无法打断点。
如果使用 Visual Studio Code 进行开发，建议在 Linux / macOS 下进行。

## 许可证

本项目采用 MIT 许可证。详情请查看 [LICENSE](LICENSE) 文件。
