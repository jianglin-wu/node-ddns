const confDft = require('./config-default.json');

const prefixCls = 'DDNS_';
const config = {};

Object.keys(confDft).forEach((keyName) => {
	if (prefixCls + keyName in process.env) {
		config[keyName] = process.env[prefixCls + keyName];
		return;
	}
	config[keyName] = confDft[keyName];
});

if (!config.KEY_ID || !config.KEY_SECRET) {
	console.log('请配置 KEY_ID 与 KEY_SECRET！');
	process.exit(2);
}

if (!config.DOMAIN) {
	console.log('请配置 DOMAIN！');
	process.exit(2);
}

module.exports = config;
