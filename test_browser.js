const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // We will bypass localstorage login check by setting it directly
    await page.goto('http://localhost:3000/login.html');
    await page.evaluate(() => {
        localStorage.setItem("session_user", JSON.stringify({id: "USR-ADMIN", name: "Admin", email: "admin@gmail.com", role: "admin"}));
        localStorage.setItem("auth_token", "fake-token");
    });
    
    // go to index.html
    await page.goto('http://localhost:3000/index.html', {waitUntil: 'networkidle0'});
    
    // fill input
    await page.evaluate(() => {
        document.getElementById('startInput').dataset.lat = "28.6139";
        document.getElementById('startInput').dataset.lng = "77.2090";
        document.getElementById('startInput').value = "Delhi";
        
        document.getElementById('destInput').dataset.lat = "19.0760";
        document.getElementById('destInput').dataset.lng = "72.8777";
        document.getElementById('destInput').value = "Mumbai";
    });
    
    // click button
    await page.evaluate(async () => {
        try {
            await confirmDispatch();
            console.log("confirmDispatch executed successfully");
        } catch (e) {
            console.error("confirmDispatch error: " + e.message);
        }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    const url = await page.url();
    console.log("Current URL: ", url);
    await browser.close();
})();
