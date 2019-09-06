const puppeteer = require('puppeteer');
const config = require('./config');

async function run() {
    let preNotes = [];
    let processedNotes = []
    let excludeNotes = config.EXCLUDE_NOTES;

    var browser = await puppeteer.launch({ headless: config.HIDE_BROWSER, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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

    preNotes = await findPreNotes(browser, preNotes, excludeNotes)
    preNotes.forEach(note => {
        attemptInvest(browser, note)
    })
    excludeNotes = excludeNotes.concat(preNotes)
    preNotes = [];

    //Find new notes every set minute interval
    setInterval(async () => {
        preNotes = await findPreNotes(browser, preNotes, excludeNotes)
        preNotes.forEach(note => {
            attemptInvest(browser, note)
        })
        excludeNotes = excludeNotes.concat(preNotes)
        preNotes = [];
    }, config.FIND_NEW_NOTES_MINUTE_INTERVAL * 60 * 1000)
}

async function findPreNotes(browser, preNotes, excludeNotes) {
    return new Promise(async resolve => {
        const page = await browser.newPage();
        await page.goto(config.LOAN_URL)
        await page.waitForSelector('.browseLoanViewBoxContainer');

        var foundNewNotes = await page.evaluate((preNotes, excludeNotes) => {
            var success = false;
            var notes = $('.browseLoanViewBoxContainer')
            var foundNewNotes = [];
            for (var i = 0; i < notes.length; i++) {
                var note = notes[i]
                var loanCode = note.getElementsByClassName('loanCode')[0].innerText
                var investBtn = note.getElementsByClassName('btnInvest')
                if (!preNotes.includes(loanCode) && !investBtn.length && !excludeNotes.includes(loanCode)) {
                    foundNewNotes.push(loanCode)
                }
            }

            return foundNewNotes
        }, preNotes, excludeNotes)

        preNotes = preNotes.concat(foundNewNotes);
        page.close();
        resolve(preNotes)
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
        await page.evaluate(() => {
            document.getElementById('investment-form-submit').click()
        })
    }
}

run();