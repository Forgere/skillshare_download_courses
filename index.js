const request = require("request");
const async = require('async');
const fs = require("fs");
const path = require('path');
const agent = require('superagent');
const cheerio = require('cheerio');
const { argv } = require('yargs');

const {downVideo} = require('./src/downVideo')
const url = argv._[0];
const defaultUrl = 'https://www.skillshare.com/classes/Customizing-Type-with-Draplin-Creating-Wordmarks-That-Work/1395825904';

function main(url) {
  console.log(`开始爬取课程`);
  async.waterfall([
    (cb) => {
      dealWithMainPage(url,cb)
    },
    (accountId, videoId, direction, cb) => {
      downVideo(accountId, videoId, `./${direction}`, cb)
    },
  ], (err, result) => {
    console.log(result)
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
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
    }
  };

  request(options, function (error, response, body) {
    if (error) return callback(error);

    const videoId = body.match(new RegExp(/"videoId":"bc:(\d*)"/))[1];
    
    const $ = cheerio.load(body);
    const accountId = $('.js-select-menu-off.vjs-video').attr('data-account');
    const direction = $('.class-details-header-name').text().trim()
    callback(null, accountId, videoId, direction)
  });
}

main(url, defaultUrl);
// concatMp4([
//   '/Users/sharrie/workspace/alibaba/study/node-skillshare/dist/视频0.mp4',
//   '/Users/sharrie/workspace/alibaba/study/node-skillshare/dist/视频1.mp4',
//   '/Users/sharrie/workspace/alibaba/study/node-skillshare/dist/视频2.mp4',
//   '/Users/sharrie/workspace/alibaba/study/node-skillshare/dist/视频3.mp4',
//   '/Users/sharrie/workspace/alibaba/study/node-skillshare/dist/视频4.mp4',
//   '/Users/sharrie/workspace/alibaba/study/node-skillshare/dist/视频5.mp4',
// ], 'oupt.mp4', ()=>{});