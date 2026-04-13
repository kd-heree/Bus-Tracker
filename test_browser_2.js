const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('dialog', async dialog => {
        console.log('DIALOG:', dialog.message());
        await dialog.accept();
    });
    
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => {
        localStorage.setItem("session_user", JSON.stringify({id: "USR-ADMIN", name: "Admin", email: "admin@gmail.com", role: "admin"}));
        localStorage.setItem("auth_token", "fake-token");
    });
    await page.goto('http://localhost:3000/index.html', {waitUntil: 'networkidle0'});
    
    await page.evaluate(async () => {
        console.log("Starting test...");
        const start = document.getElementById('startInput');
        start.dataset.lat = "28.6139";
        start.dataset.lng = "77.2090";
        start.value = "Delhi";
        
        const dest = document.getElementById('destInput');
        dest.dataset.lat = "19.0760";
        dest.dataset.lng = "72.8777";
        dest.value = "Mumbai";
        
        console.log("Calling confirmDispatch...");
        try {
            await window.confirmDispatch();
            console.log("Finished calling confirmDispatch. Wait for redirect...");
        } catch (e) {
            console.error(e.stack || e.message);
        }
    });
    
    await new Promise(r => setTimeout(r, 4000));
    console.log("Current URL is", await page.url());
    await browser.close();
})();
