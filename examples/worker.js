'use strict';

const logger = require('./log');
const Worker = require('../lib/workers');

const log = logger('worker');

const worker = new Worker({
    queue: 'link.archive',
    backend: {
        host: 'localhost',
        port: 6379
    }
});


worker
    .on('task.ran', task => {
        log('Job complete...\n');
        log('- This "task" has run "%s" times', task.runs);
        log('- "job" ran "%s" times with %s errors and %s failures', worker.runs - worker.errors, worker.errors, worker.failed);
        // log('- execution took %sms', timeout);
        log('----------------------\n');
    }).on('task.added', task => {
        log('! on task added');
        log('* Task has been ran %s before.', task.runs);
        log('* Pulled queue: "%s" task id "%s"', 'tasks:active', task.id);
    }).on('task.error', task => {
        log('\t----- ERROR ----');
        log('\tTask "%s" failed...', task.id);
        log('\tErrors: %s/%s', task.errorCount, task.maxTries);
        // log('\tserialized: %s', task.serialize());
        log('-------------------\n');
    })
    .run(taskHandler);

async function taskHandler(task) {
    log('-------- WORKER --------');
    if (!task.data) {
        log('No task data!!');
        log('%j', task);
        process.exit(1);
    }

    log('Start job with id: %s...', task.id);
    log('Prepare to summarize url %s...', task.data.url);

    // const timeout = randomInt(100, 2000);

    // if (timeout > 1400) {
    //     log('Timed out error...');
    //     throw new TaskRunError(`${task.id}`, 504);
    // }
    // curl -H "Content-Type: application/json" -d '{"url":"http://goliatone.com","tags":["nodejs"], "description":"Notes to self"}' http://localhost:9000/link/archive

    const opts = {
        headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
        }
    };
    opts.url = task.data.url;

    // const summary = await summarizeURL(opts);

    const metascraper = require('metascraper')([
        require('metascraper-author')(),
        require('metascraper-date')(),
        require('metascraper-description')(),
        require('metascraper-image')(),
        require('metascraper-logo')(),
        require('metascraper-clearbit')(),
        require('metascraper-publisher')(),
        require('metascraper-title')(),
        require('metascraper-url')(),
        require('metascraper-readability')(),
        require('../wbm')(),
    ]);

    const got = require('got');
    const { body: html, url } = await got(task.data.url, {
        headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
        }
    });

    const metadata = await metascraper({ html, url });
    console.log(metadata);

    // console.log('Summary:', summary);
    // setTimeout(_ => {
    //     log('Download done!');
    //     resolve();
    // }, timeout);
}


/*
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}


const summarize = require('summarize');
const summary = require('node-summary');
const request = require('request-promise');
const unfluff = require('unfluff');

const summarizeOptions = {
    includeRaw: true,
    excludeStats: false,
};

async function summarizeURL(requestOptions, options = {}) {
    const body = await request(requestOptions);

    let pageContent = unfluff(body);

    if (options && options.includeRaw) {
        pageContent.raw = body;
    }

    if (!options.excludeStats) {
        pageContent.stats = summarize(body);
    }

    const pageSummary = await summarizeArticle(pageContent.title, pageContent.text);
    pageContent.summary = pageSummary;

    return pageContent;
}

function summarizeArticle(title, story) {
    return new Promise((resolve, reject) => {
        summary.summarize(title, story, (err, summary) => {
            if (err) return reject(err);
            summary = summary.replace(title, '');
            return resolve(summary);
        });
    });
}
*/