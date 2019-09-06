const puppeteer = require('puppeteer');
const config = require('./config');

const LOG_PREFIX = ""
const log = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[" + new Date().toLocaleString() + "]" + LOG_PREFIX + " ");
    console.log.apply(console, args);
}

async function run() {
    let preNotes = []; // [{loanCode: 'MBIJ-1234234', type: '2'}, {loanCode: 'MBTX-3334234', type: '1'}]
    let excludeNotes = config.EXCLUDE_NOTES; // ['MBIJ-1234234', 'MBMTX-4534534']

    var browser = await puppeteer.launch({ headless: config.HIDE_BROWSER, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    var page = await browser.newPage();
    try {
        await page.goto(config.LOGIN_URL);
        await page.waitForSelector('[name=userName]')
        await page.type('[name=userName]', config.USERNAME)
        await page.type('[name=password]', config.PASSWORD)
        await page.click('[name=log-in-form-submit]')
        await page.waitForSelector('.accountOverviewBtn')
    }
    catch (ex) {
        log(ex)
    }

    preNotes = await findPreNotes(browser, preNotes, excludeNotes)
    preNotes.forEach(note => {
        attemptInvest(browser, note)
        excludeNotes.push(note.loanCode)
    })
    preNotes = [];

    //Find new notes every set minute interval
    setInterval(async () => {
        preNotes = await findPreNotes(browser, preNotes, excludeNotes)
        preNotes.forEach(note => {
            attemptInvest(browser, note)
            excludeNotes.push(note.loanCode)
        })
        preNotes = [];
    }, config.FIND_NEW_NOTES_MINUTE_INTERVAL * 60 * 1000)
}

async function findPreNotes(browser, preNotes, excludeNotes) {
    return new Promise(async resolve => {
        const page = await browser.newPage();
        await page.goto(config.LOAN_URL)
        var preNoteLoanCodes = preNotes.map(note => note.loanCode);

        for (var j = 0; j < 3; j++) {
            await page.waitForSelector('.btnBrowseLoan');
            await page.evaluate((type) => {
                document.getElementsByClassName('btnBrowseLoan')[type].click()
            },j)
            await page.waitForSelector('.loaded');
            var foundNewNotes = await page.evaluate((preNoteLoanCodes, excludeNotes, j) => {
                var notes = $('.browseLoanViewBoxContainer')
                var foundNewNotes = [];
                for (var i = 0; i < notes.length; i++) {
                    var note = notes[i]
                    var loanCode = note.getElementsByClassName('loanCode')[0].innerText
                    var investBtn = note.getElementsByClassName('btnInvest')
                    if (!preNoteLoanCodes.includes(loanCode) && !investBtn.length && !excludeNotes.includes(loanCode)) {
                        foundNewNotes.push({loanCode: loanCode, type: j})
                    }
                }                

                return foundNewNotes
            }, preNoteLoanCodes, excludeNotes, j)
            preNotes = preNotes.concat(foundNewNotes);
        }

        page.close();
        resolve(preNotes)
    })
}

async function attemptInvest(browser, attemptNote) {
    const page = await browser.newPage();
    await page.goto(config.LOAN_URL)
    var data = { success: false }

    while (!data.success) {
        log('[WAIT] - ' + attemptNote.loanCode + 'type-' + attemptNote.type)

        await page.reload()
        await page.waitForSelector('.btnBrowseLoan');
        await page.evaluate((type)=> {
            document.getElementsByClassName('btnBrowseLoan')[type].click()
        }, attemptNote.type)
        await page.waitForSelector('.loaded');

        data = await page.evaluate((attemptLoanCode) => {
            var success = false;
            var notes = $('.browseLoanViewBoxContainer')

            for (var i = 0; i < notes.length; i++) {
                var note = notes[i]
                var loanCode = note.getElementsByClassName('loanCode')[0].innerText
                var investBtn = note.getElementsByClassName('btnInvest')
                if (investBtn.length && loanCode == attemptLoanCode) {
                    investBtn = investBtn[0]
                    investBtn.click();
                    success = true;
                }
            }

            return { success: success }
        }, attemptNote.loanCode)
    }

    await page.waitForSelector('#amount')
    await page.type('#amount', config.INVEST_AMOUNT);
    await page.evaluate(() => {
        document.getElementById('investment-form-submit').click()
    })
    log('[SUCCESS] - ' + attemptLoanCode)
    await page.close()
}

run();