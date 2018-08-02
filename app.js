'use strict';
const http = require('http');
const fs = require('fs');
const dns = require('dns');
const url = require('url');
const path = require('path');
const stun = require('node-stun');
const moment = require('moment');
const _ = require('lodash');
const alidns = require('./alidns.js');
const CONSTANT = require('./constant');

// 日志时间格式
const format = 'YYYY-MM-DD HH:mm:ss Z';
// 公共 STUN 服务器地址。
const hosts = [
  { addr: 'sip1.lakedestiny.cordiaip.com' },
  { addr: 'stun.callwithus.com' },
  { addr: 'stun.counterpath.net' },
  { addr: 'stun.ideasip.com' },
  { addr: 'stun.internetcalls.com' },
  { addr: 'stun.sipgate.net' },
  { addr: 'stun.stunprotocol.org' },
  { addr: 'stun.voip.aebc.com' },
  { addr: 'stun.voipbuster.com' },
  { addr: 'stun.voxgratia.org' },
  { addr: 'stun.xten.com' },
];
// 获取ip信息间隔
const delayed = 1000 * 60 * 10;

// 打印日志
const log = function() {
  const arr = Array.prototype.slice.call(arguments);
  const type = arr[0];
  arr[0] = moment().format(format) + ' ' + type + ': ';
  const msg = arr.join(' ') + '\n';

  if (!CONSTANT.LOG || CONSTANT.LOG !== 'on') {
    console.log(msg);
    return;
  }

  fs.stat(CONSTANT.LOG_DIR || __dirname, function (err, stats) {
    if (err || !stats.isDirectory()) {
      writeLog('ddns.log', msg);
    }
    writeLog(path.join(CONSTANT.LOG_DIR, 'ddns.log'), msg);
  })
}

const writeLog = function (path, msg){
  fs.appendFile(path, msg, 'utf8', function(err) {
    if (err) {
      console.error('Log write failure: ', msg);
    }
  });
}

// 查询域名解析地址
const dnsLookup = function (target, cb) {
  dns.lookup(target, (err, address, family) => {
    if (err) {
      log('error', 'lookup error:', err);
      return;
    }
    log('log', target + ': address: %j family: IPv%s', address, family);
    cb(null, address, family);
  });
};

// 通过 STUN 查询当前公网 IP 地址。
const fetchPublicIp = function (servers, cb) {
  var i = 0;

  (function connectStunServer () {
    const host = servers[i];
    i++;

    var client = stun.createClient();
    client.setServerAddr(host.addr, host.port || 3478);
    client.start(function (result) {
      var mapped = client.getMappedAddr();
      client.close();
      if (result === 0) {
        log('log', '[connectStunServer] ' + i + '/' + servers.length + ': ', host.addr + ' Success(' + result + ')! ip=' + mapped.address);
        cb(null, mapped.address);
        return;
      }

      if (i < servers.length) {
        log('log', '[connectStunServer] ' + i + '/' + servers.length + ': ', host.addr + ' Fail(' + result + ')!');
        connectStunServer();
      } else {
        cb(true);
      }
    });
  })();
};

// 这段代码首先会检查已有的记录
// 如果记录不存在, 会新建一个解析, 并返回 created
// 如果记录存在, ip 没变化, 不会更新 ip, 并返回 nochg
// 如果记录存在, ip 有变化, 会更新 ip, 并返回 updated
// 如果阿里云端返回 400 错误, 则返回 error
const updateRecord = function (target, callback) {

  // Normalize target url name.
  let domainParts = target.hostname.split('.');
  if(domainParts[domainParts.length] === '') {
    // Removing tail dot.
    domainParts.pop();
  }

  let RR = (domainParts.length > 2) ?
      domainParts[0] : '@';
  let normHostname = '';
  if(domainParts.length > 2) {
      // Remove only the first element, and then copy rest of it.
      domainParts.shift();
  }

  domainParts.forEach(ele => {
    normHostname += ele + '.';
  });

  normHostname = normHostname.substr(0, normHostname.length - 1);

  const describeParams = {
    Action: 'DescribeDomainRecords',
    DomainName: normHostname
  };
  const updateParams = {
    Action: 'UpdateDomainRecord',
    // RecordId: '',
    RR: RR,
    Type: target.type,
    Value: target.ip
  };
  const addParams = {
    Action: 'AddDomainRecord',
    DomainName: describeParams.DomainName,
    RR: updateParams.RR,
    Type: updateParams.Type,
    Value: updateParams.Value
  };

  // 首先获取域名信息, 目的是获取要更新的域名的 RecordId
  http.request({
    host: alidns.ALIDNS_HOST,
    path: alidns.getPath(describeParams)
  }, res => {
    let body = [];
    res
      .on('data', chunk => body.push(chunk))
      .on('end', () => {
        body = Buffer.concat(body).toString();
        const result = JSON.parse(body);
        // 获取要更新的域名的 RecordId, 并检查是否需要更新
        let shouldUpdate = false;
        let shouldAdd = true;

        if(!result.DomainRecords) {
            console.log(result);
            return;
        }

        result.DomainRecords.Record
          .filter(record => record.RR === updateParams.RR &&
                 record.Type === updateParams.Type )
          .forEach(record => {
            shouldAdd = false;
            if (record.Value !== updateParams.Value) {
              shouldUpdate = true;
              updateParams.RecordId = record.RecordId;
            }
          });
        if (shouldUpdate) {
          // 更新域名的解析
          http.request({
            host: alidns.ALIDNS_HOST,
            path: alidns.getPath(updateParams)
          }, res => {
            if (res.statusCode === 200) {
              callback('updated');
            } else {
              log('error', '[request] 更新域名解析失败：', 'Failed to update target error');
              res.pipe(process.stderr);
              callback('error');
            }
          }).end();
        } else if (shouldAdd) {
          // 增加新的域名解析
          http.request({
            host: alidns.ALIDNS_HOST,
            path: alidns.getPath(addParams)
          }, res => {
            if (res.statusCode === 200) {
              callback('added');
            } else {
              callback('error');
            }
          }).end();
        } else {
          callback('nochg');
        }
      });
  }).end();
};

(function ddns () {
  const servers = _.shuffle(hosts);
  fetchPublicIp(servers, function(err, ip) {
    if (err) {
      log('error', '[fetchPublicIp] 获取公网IP失败：', err);
      setTimeout(ddns, delayed);
      return;
    }
    const target = {
      hostname: CONSTANT.DOMAIN,
      type: 'A',
      ip: ip,
    };
    updateRecord(target, (msg) => {
      if (msg === 'error') {
        log('error', '[updateRecord] 更新域名解析失败：', msg);
        return;
      }else if (msg === 'updated') {
        log('log', '[updateRecord] 更新域名解析成功：', JSON.stringify(target));
      } else if (msg === 'nochg') {
        log('log', '[updateRecord] 域名解析正常无需更新。');
      } else {
        log('log', '[updateRecord] 其他：', '----------' + msg + '----------');
      }
      setTimeout(ddns, delayed);
    });
  });
})();
