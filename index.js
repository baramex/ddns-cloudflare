require('dotenv').config();
const { default: axios } = require('axios');
const schedule = require('node-schedule');

var oldIp = '';

const job = schedule.scheduleJob('*/15 * * * *', async function () {
    const ip = await getIp();
    if (oldIp && oldIp !== ip) {
        console.log('IP changed!', ip);
        const zones = await cloudflareRequest("GET", "zones");
        if (!zones) {
            return;
        }
        for (const zone of zones.data.result) {
            const dnsRecords = await cloudflareRequest("GET", `zones/${zone.id}/dns_records`, undefined, { type: "A", content: { exact: oldIp }, match: "all" });
            if (!dnsRecords) {
                continue;
            }
            const patches = [];
            for (const dnsRecord of dnsRecords.data.result) {
                console.log('Updating', dnsRecord.name, 'to', ip);
                patches.push({
                    id: dnsRecord.id,
                    content: ip
                });
            }
            if (patches.length === 0) {
                console.log('No DNS records found for zone', zone.name);
                continue;
            }
            await cloudflareRequest("POST", `zones/${zone.id}/dns_records/batch`, { patches });
        }
        oldIp = ip;
    }
});

function cloudflareRequest(method, url, data, params) {
    return axios({
        method,
        url: `https://api.cloudflare.com/client/v4/${url}`,
        headers: {
            'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
            'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
            'Content-Type': 'application/json'
        },
        data,
        params
    }).catch(err => {
        console.error('Error:', err.response.data);
    });
}

async function getIp() {
    return (await axios.get('https://api.ipify.org?format=json')).data.ip;
}

getIp().then(ip => {
    oldIp = ip;
});