'use strict';
const http = require('http');
const dns = require('dns');
const url = require('url');
const stun = require('node-stun');
const alidns = require('./alidns.js');
const config = require('./config.json');


const fetchPublicIp = function (hosts, cb) {
  var i = 0;

  (function connectStunServer () {
    const host = hosts[i];
    i++;

    var client = stun.createClient();
    client.setServerAddr(host.addr, host.port || 3478);
    client.start(function (result) {
      var mapped = client.getMappedAddr();
      client.close();
      if (result === 0) {
        console.log('[' + hosts.length + '-' + i + '] Success(' + result + '): mapped=' + mapped.address + ':' + mapped.port);
        cb(null, mapped.address);
        return;
      }

      if (i < hosts.length) {
        console.log('[' + hosts.length + '-' + i + '] Fail(' + result + '): ' + host.addr + ':' + host.port);
        connectStunServer();
      } else {
        console.log('---------- fetchPublicIp fail! ----------');
        cb(true);
      }
    });
  })();
};



// hostname 以 query string 形式传入, 格式为 xx.example.com
// ip 如果在 query string 中出现, 则设定为该 ip, 否则设定为访问客户端的 ip
const getTarget = function (cb) {
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
  ]
  fetchPublicIp(hosts, function(err, ip) {
    if (err) {
      cb(true);
      return;
    }
    cb(null, {
      hostname: config.domain,
      type: 'A',
      ip: ip,
    });
  });
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
              console.err("Failed to update target error");
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

const delayed = 1000 * 60 * 10;
(function ddns () {
  getTarget(function (err, target) {
    if (err) {
      console.log('------------------getTarget----------------');
      setTimeout(ddns, delayed);
      return;
    }
    updateRecord(target, (msg) => {
      if (msg === 'error') {
        console.error('更新域名解析失败:', msg);
        return;
      }else if (msg === 'updated') {
        console.log('updated:' + new Date() + ': [' + msg + '] ' + JSON.stringify(target));
      } else {
        console.log('----------' + msg + '----------');
      }
      setTimeout(ddns, delayed);
    });
  });
})();