const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

const STAFF = ['吉川', 'スタッフA', 'スタッフB'];
const CUSTOMERS = [
    { name: '佐藤一郎', phone: '090-1111-2222' },
    { name: '山田花子', phone: '080-3333-4444' },
    { name: '鈴木二郎', phone: '070-5555-6666' }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendRequest(data) {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        console.log(`[${data.action}] Success: ${result.success}`);
    } catch (err) {
        console.error(`[${data.action}] Error:`, err.message);
    }
}

async function run() {
    console.log('--- Generating Demo Data ---');

    // 1. スタッフの登録
    for (const staff of STAFF) {
        await sendRequest({
            action: 'addStaff',
            name: staff,
            password: 'mypassword123',
            email: 'demo@example.com'
        });
        await sleep(1000);
    }

    // 2. 顧客の登録と事前チャージ
    for (const customer of CUSTOMERS) {
        await sendRequest({
            action: 'addCustomer',
            customerName: customer.name,
            customerPhone: customer.phone
        });
        await sleep(1000);

        // デポジットチャージ(10000円 + 500円ボーナス = 10500円)
        await sendRequest({
            action: 'updateDeposit',
            customerName: customer.name,
            amount: 10500,
            type: 'charge'
        });
        await sleep(1000);
    }

    // 3. 業務報告の作成(10件ほど)
    const today = new Date();
    for (let i = 0; i < 15; i++) {
        const s = STAFF[Math.floor(Math.random() * STAFF.length)];
        const c = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];

        // 日付を少しバラけさせる
        const dateObj = new Date(today);
        dateObj.setDate(today.getDate() - Math.floor(Math.random() * 5));
        const dateStr = dateObj.toLocaleDateString('ja-JP');

        // 売上をランダムに
        const sales = 3000 + Math.floor(Math.random() * 7000); // 3000〜10000
        const share = Math.floor(sales * 0.5); // スタッフ50%

        console.log(`Sending report ${i + 1}/15...`);
        await sendRequest({
            action: 'addReport',
            checkDuplicate: false, // テストデータ用なのでチェックなし
            date: dateStr,
            staff: s,
            customerName: c.name,
            customerPhone: c.phone,
            services: `傾聴(${Math.floor(Math.random() * 60) + 30}分 -> 計算${Math.floor(Math.random() * 60) + 30}分)`,
            totalSales: sales,
            staffShare: share
        });
        await sleep(2000); // GASの制限を避けるため少し待機
    }

    console.log('--- Demo Data Generation Complete ---');
}

run();
