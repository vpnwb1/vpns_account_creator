const mail_js   = require("@cemalgnlts/mailjs");
const axios     = require('axios');

const mail      = new mail_js();
const maxTime   = 60000;

let email;
let password;
let fingerprint;

const instance = axios.create({
    baseURL: 'https://api.molorak.net/',
    validateStatus: function (status) {
        return status >= 200 && status < 500;
    },
    headers: {
        'Host': 'api.molorak.net',
        'Accept': '*/*',
        'Accept-Language': 'ru',
        'Platform': '2',
        'userDeviceName': '',
        'User-Agent': 'VPN%20Satoshi/323 CFNetwork/1485 Darwin/23.1.0',
        'Connection': 'keep-alive',
        'userDevice': 'MacModel',
        'Content-Type': 'application/json'
    },
});

async function getFingerPrint() {

    try {

        const response = await instance.get('/v2/servers/getFingerprint');

        if (!response.data.success) {
            return false;
        }

        return response.data.fingerprint

    } catch (e) {
        console.log('cant get fingerprint: ' + e.message);
        return false;
    }

}

async function register() {

    try {

        const response = await instance.post('/v2/users/reg', {
            password,
            email
        },{
            headers: {
                'fingerprint': fingerprint
            }
        });

        return !(response.status !== 200 || !response.data.success);

    } catch (e) {
        console.log('cant register, error: ' + e.message);
        return false;
    }

}

async function verifyCode(code) {

    try {

        const response = await instance.post('/v2/users/reg', {
            email,
            code,
            partner: '',
            password,
        },{
            headers: {
                'fingerprint': fingerprint
            }
        });

        return !(response.status !== 200 || !response.data.success);

    } catch (e) {
        console.log('cant verify code, error: ' + e.message);
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