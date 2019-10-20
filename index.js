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

const cookie = "470742eb68edf76848bf4fbf18b1ca7bc6747904a%3A4%3A%7Bi%3A0%3Bs%3A7%3A%222692164%22%3Bi%3A1%3Bs%3A27%3A%22wsz.wangshuangzhi%40gmail.com%22%3Bi%3A2%3Bi%3A2592000%3Bi%3A3%3Ba%3A11%3A%7Bs%3A5%3A%22email%22%3Bs%3A27%3A%22wsz.wangshuangzhi%40gmail.com%22%3Bs%3A9%3A%22firstName%22%3Bs%3A7%3A%22Sharrie%22%3Bs%3A8%3A%22lastName%22%3Bs%3A4%3A%22Wang%22%3Bs%3A8%3A%22headline%22%3Bs%3A0%3A%22%22%3Bs%3A3%3A%22pic%22%3Bs%3A67%3A%22https%3A%2F%2Fstatic.skillshare.com%2Fassets%2Fimages%2Fdefault-profile-lrg.jpg%22%3Bs%3A5%3A%22picSm%22%3Bs%3A66%3A%22https%3A%2F%2Fstatic.skillshare.com%2Fassets%2Fimages%2Fdefault-profile-sm.jpg%22%3Bs%3A5%3A%22picLg%22%3Bs%3A67%3A%22https%3A%2F%2Fstatic.skillshare.com%2Fassets%2Fimages%2Fdefault-profile-lrg.jpg%22%3Bs%3A9%3A%22isTeacher%22%3Bs%3A1%3A%220%22%3Bs%3A8%3A%22username%22%3Bs%3A7%3A%229280939%22%3Bs%3A3%3A%22zip%22%3Bs%3A0%3A%22%22%3Bs%3A6%3A%22cityID%22%3Bs%3A1%3A%220%22%3B%7D%7D"
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
      "Cookie": `skillshare_user_=${cookie}; path=/; domain=.skillshare.com; Expires=Sun, 17 Nov 2019 07:03:57 GMT;`
    }
  };

  request(options, function (error, response, body) {
    if (error) return callback(error);
    const videoId = [...new Set(body.match(new RegExp(/"videoId":"bc:(\d*)"?/g)))];
    const videos = videoId.map(item => item.match(/bc:(\d*)"/)[1])
    console.log(`本课程一共有${videos.length}个视频`);
    const $ = cheerio.load(body);
    const accountId = $('.js-select-menu-off.vjs-video').attr('data-account');
    const direction = $('.class-details-header-name').text().trim()
    callback(null, accountId, videos, direction)
  });
}

main(url, defaultUrl);