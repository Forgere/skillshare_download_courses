const request = require("request");
const async = require('async');
const fs = require("fs");
const path = require('path');
const agent = require('superagent');
const cheerio = require('cheerio');
const { argv } = require('yargs');
const child_process = require("child_process");
const os = require("os");
const cluster = require('cluster');

const {downVideo} = require('./src/downVideo')
const url = argv._[0];
const defaultUrl = 'https://www.skillshare.com/classes/Customizing-Type-with-Draplin-Creating-Wordmarks-That-Work/1395825904';

const cookie = argv._[1];
let works = [];

function main(url) {
  async.waterfall([
    (cb) => {
      dealWithMainPage(url,cb)
    },
  ], (err, accountId, videos, direction) => {
    if (err) console.log(err)
    
    async.parallelLimit(videos.map((videoId, index) => cb => {
      if (err) return cb(`dealwithmainpage error ${err}`)
      const wr = child_process.fork('src/downVideo.js');
      
      if (!fs.existsSync('download')){
        fs.mkdirSync('download')
      }

      if (!fs.existsSync('tmp')) {
        fs.mkdirSync('tmp')
      }

      wr.send([accountId, videoId, path.join(__dirname, `download/${direction}`), index])
      wr.on('message', (res) => {
        console.log(res)
        wr.kill()
        cb(null, videoId)
      })
    }),4,(err, res) => {
      if (err) return console.log(err);
      console.log(res)
    })
  })
}

function dealWithMainPage(url, callback) {
  var options = {
    method: 'GET',
    url: url,
    qs: { via: 'homepage' },
    headers: {
      'postman-token': '6fe39874-45a0-7ab2-f53c-5b9778aca679',
      'cache-control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
    }
  };

  if (cookie) {
    options.headers.Cookie = `skillshare_user_=${cookie}; path=/; domain=.skillshare.com; Expires=Sun, 17 Nov 2019 07:03:57 GMT;`
  }

  request(options, function (error, response, body) {
    if (error) return callback(error);
    const videoId = [...new Set(body.match(new RegExp(/"videoId":"bc:(\d*)"?/g)))];
    const videos = videoId.map(item => item.match(/bc:(\d*)"/)[1])
    console.log(`本课程一共有${videos.length}个视频`);
    const $ = cheerio.load(body);
    const accountId = $('.js-select-menu-off.vjs-video').attr('data-account');
    const direction = $('.class-details-header-name').text().trim().split('\n').join('').replace(/(  )/g, '')
    console.log(JSON.stringify(direction))

    callback(null, accountId, videos, direction)
  });
}

main(url, defaultUrl);