# Node 动态域名解析
使用 Node.js 实现的一个动态域名解析工具，通过 STUN 公共服务器定时获取当前服务所在的公网 IP，并将域名绑定到该公网地址。


**如何构建？**

指定镜像名与上下文路径构建镜像，可以加参数 `-m` 指定容器最大占用内存。

```bash
// 构建时可指定容器最大内存：https://blog.csdn.net/ysl_228/article/details/77528793
$ docker build -t node-ddns .
```


**如何运行？**

1. 指定后台运行，以及容器名称。
2. 如需打印日志，则挂载数据卷到容器，对日志持久存储。
3. 对容器设置自动重启。
4. 指定构建好的镜像名称。
5. 指定启动执行的命令。

```bash
$ docker run -d --name node-ddns \
  -v logs-ddns:/logs \
  --restart always \
  node-ddns node app.js > /dev/null
```
