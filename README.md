# Node 动态域名解析
使用 Node.js 实现的一个动态域名解析工具，通过 STUN 公共服务器定时获取当前服务所在的公网 IP，并将域名绑定到该公网地址。


**如何构建？**

指定镜像名与上下文路径构建镜像，可以加参数 `-m` 指定容器最大占用内存。

```bash
// 构建时可指定容器最大内存：https://blog.csdn.net/ysl_228/article/details/77528793
$ docker build -t node-ddns .
```


**如何配置？**

默认配置如下：
```json
{
  "KEY_ID": "",
  "KEY_SECRET": "",
  "DOMAIN": "",
  "LOG": "off",
  "LOG_DIR": "/logs"
}
```

通过环境变量设置配置：设置环境变量需要在该字段上加上 `DDNS_` 前戳，支持默认配置中所有字段替换
。

```bash
# 设置 KEY_SECRET 与 KEY_SECRET
$ DDNS_KEY_ID=XXXXXX
$ DDNS_KEY_SECRET=XXXXXX
# 配置绑定的域名
$ DDNS_DOMAIN=your.domain.xx
# 开启日志记录
$ DDNS_LOG=no
```

**如何运行？**

1. 指定后台运行，以及容器名称。
2. 如需打印日志，则挂载数据卷到容器，对日志持久存储。
3. 设置环境变量，定义自己的配置。
4. 对容器设置自动重启。
5. 指定构建好的镜像名称。
6. 指定启动执行的命令。

```bash
$ docker run -d --name node-ddns \
  -v logs-ddns:/logs \
  -e DDNS_KEY_ID=XXXXXX \
  -e DDNS_KEY_SECRET=XXXXXX \
  -e DDNS_DOMAIN=your.domain.xx \
  --restart always \
  node-ddns node app.js > /dev/null
```


**todo**

* [ ] doc: 使用 Node.js 方式启动详细文档。
* [ ] doc: 使用 Docker 方式启动详细文档。
* [ ] doc: 在 Jenkins 中的实践应用。
* [ ] feat: 对进程的意外终止进行日志记录。