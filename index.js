const puppeteer = require('puppeteer');
const config = require('./config');

async function run() {
    let preNotes = ['MBBT-19060094'];

    var browser = await puppeteer.launch({ headless: false });
    var page = await browser.newPage();
    try {
        await page.goto(config.LOGIN_URL);
        await page.waitForSelector('[name=userName]')
        await page.type('[name=userName]', config.USERNAME)
        await page.type('[name=password]', config.PASSWORD)
        await page.click('[name=log-in-form-submit]')
    }
    catch (ex) {
        console.log(ex)
    }

    preNotes.forEach(note => {
        attemptInvest(browser, note)
    })
}

async function attemptInvest(browser, attemptLoanCode) {
    const page = await browser.newPage();
    await page.goto(config.LOAN_URL)
    var data = { success: false }

    while (!data.success) {
        await page.reload()
        await page.waitForSelector('.browseLoanViewBoxContainer');
        data = await page.evaluate((attemptLoanCode) => {
            var success = false;
            var notes = $('.browseLoanViewBoxContainer')
            var promises = [];
            for (var i = 0; i < notes.length; i++) {
                var note = notes[i]
                var loanCode = note.getElementsByClassName('loanCode')[0].innerText
                var investBtn = note.getElementsByClassName('btnInvest')
                console.log(attemptLoanCode)
                if (investBtn.length && loanCode == attemptLoanCode) {
                    investBtn = investBtn[0]
                    investBtn.click();
                    success = true;
                }
            }

            return { success: success }
        }, attemptLoanCode)
        console.log('wait')
    }

    if (data.success) {
        await page.waitForSelector('#amount')
        await page.type('#amount', '10');
        await page.evaluate(()=> {
            document.getElementById('investment-form-submit').click()
        })
    }
}

run();