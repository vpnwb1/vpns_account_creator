const mail_js   = require("@cemalgnlts/mailjs");
const request   = require('request');
const _         = require('lodash');

const mail      = new mail_js();
const maxTime   = 60000;

let email;
let password;
let fingerprint;

async function r(config, agent = null, retryCount = 3) {
    return new Promise((resolve, reject) => {

        if (!config.timeout) _.assign(config, {
            timeout: 15 * 1000
        });

        let t = setTimeout(async () => {
            try {
                if (retryCount === 0) return reject("r.retryCount === 0");
                return resolve(await this.r(config, agent, retryCount-1));
            } catch (e) {
                return reject(e);
            }
        }, config.timeout + 2 * 1000);

        request(config, (error, response, body) => {
            clearTimeout(t);
            if (error) return reject(error);
            let statusCode = response.statusCode;

            if (statusCode === 407) reject(new Error('407 proxy not linked'));
            if (statusCode === 461) reject(new Error('461 port limit reached'));
            if (statusCode === 561) reject(new Error('561 port limit reached'));

            return resolve({statusCode, body, response});
        });
    })
}

async function getFingerPrint() {

    try {

        let response = await r({
            'method': 'GET',
            'url': 'https://api.molorak.net/v2/servers/getFingerprint',
            'headers': {
                'Host': 'api.molorak.net',
                'userDevice': 'MacModel',
                'Platform': '2',
                'Accept': '*/*',
                'Accept-Language': 'ru',
                'userDeviceName': '',
                'User-Agent': 'VPN%20Satoshi/323 CFNetwork/1485 Darwin/23.1.0',
                'Connection': 'close'
            },
            json: true
        });

        if (response.statusCode !== 200 || !response.body.success) {
            return false;
        }

        return response.body.fingerprint;

    } catch (e) {
        console.log('getFingerPrint() error: ' + e.message);
        return false;
    }

}

async function register() {

    try {

        let response = await r({
            'method': 'POST',
            'url': 'https://api.molorak.net/v2/users/reg',
            'headers': {
                'Host': 'api.molorak.net',
                'fingerprint': fingerprint,
                'Accept': '*/*',
                'Accept-Language': 'ru',
                'Platform': '2',
                'userDeviceName': '',
                'User-Agent': 'VPN%20Satoshi/323 CFNetwork/1485 Darwin/23.1.0',
                'Connection': 'keep-alive',
                'userDevice': 'MacModel',
                'Content-Type': 'application/json'
            },
            body: {
                password,
                email
            },
            json: true
        });

        return !(response.statusCode !== 200 || !response.body.success);

    } catch (e) {
        console.log('cant get fingerprint, error: ' + e.message);
        return false;
    }

}

async function verifyCode(code) {

    try {

        let response = await r({
            'method': 'POST',
            'url': 'https://api.molorak.net/v2/users/reg/code',
            'headers': {
                'Host': 'api.molorak.net',
                'fingerprint': fingerprint,
                'Accept': '*/*',
                'Accept-Language': 'ru',
                'Platform': '2',
                'userDeviceName': '',
                'User-Agent': 'VPN%20Satoshi/323 CFNetwork/1485 Darwin/23.1.0',
                'Connection': 'keep-alive',
                'userDevice': 'MacModel',
                'Content-Type': 'application/json',
            },
            body: {
                email,
                code,
                partner: '',
                password,
            },
            json: true
        });

        return !(response.statusCode !== 200 || !response.body.success);

    } catch (e) {
        console.log('cant get fingerprint, error: ' + e.message);
        return false;
    }

}

function waitForArrival() {
    return new Promise((resolve, reject) => {

        const timeoutId = setTimeout(() => {
            resolve(false)
        }, maxTime);

        mail.on("arrive", msg => {
            clearTimeout(timeoutId);
            resolve(msg.id);
        });

    });
}

(async () => {

    let account = await mail.createOneAccount();

    mail.on('open');

    if (!account) {
        console.log('cant get account from mail.tm');
        return;
    }

    email       = account.data.username;
    password    = account.data.password;

    console.log('gathering fingeprint...')

    fingerprint = await getFingerPrint();

    if (!fingerprint) {
        console.log('cant get fingerprint')
        return;
    }

    let result = await register();

    console.log('making an account on vpns...')

    if (!result) {
        console.log('cant register on vpns');
        return;
    }

    console.log('waiting for verification code...')

    let message = await waitForArrival();

    if (!message) {
        console.log('message not arrived');
        return;
    }

    message = await mail.getMessage(message);

    let code = message.data.html[0].split(';padding-bottom: 20px;"><strong>')[1].split('</strong>')[0]

    console.log('verifying code...')

    result = await verifyCode(code);

    if (result) {
        console.log('account registered: ' + email + ':' + password)
    }

})()