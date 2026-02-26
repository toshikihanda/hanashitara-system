const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

async function run() {
    console.log('Sending initDemoData request to clean and seed data...');
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'initDemoData' })
        });
        const result = await res.json();
        console.log(result);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
