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

console.log('config:', config);

module.exports = config;
