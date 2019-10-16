const request = require("request");
const async = require('async');
const fs = require("fs");
const path = require('path');
const agent = require('superagent');
const cheerio = require('cheerio');
const { argv } = require('yargs');
var ffmpeg = require('fluent-ffmpeg');
const url = argv._[0];
const defaultUrl = 'https://www.skillshare.com/classes/Customizing-Type-with-Draplin-Creating-Wordmarks-That-Work/1395825904';

function main(url) {
  console.log(`开始爬取课程`);
  async.waterfall([
    (cb) => {
      dealWithMainPage(url,cb)
    },
    (accountId, videoId, cb) => {
      dealWithVideoPage(accountId, videoId, cb)
    },
    (htmllink, m3u8link, cb) => {
      dealWithVideoDownload(htmllink, m3u8link, cb)
    },
    (url,video, cb) => {
      dealWithMainM3U8(url, video, cb)
    }
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

    callback(null, accountId, videoId)
  });
}

// 主页面进入之后 根据账户 视频 返回的信息， 拿到sources
function dealWithVideoPage(accountId, videoId, cb){
  const videoUrl = `https://edge.api.brightcove.com/playback/v1/accounts/${accountId}/videos/${videoId}`;
  var options = { method: 'GET',
  url: videoUrl,
  headers: 
   { 'postman-token': '43fded51-6506-e244-fb9d-bbd4a233ca86',
     'cache-control': 'no-cache',
     'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
     'sec-fetch-mode': 'cors',
     referer: 'https://www.skillshare.com/classes/Customizing-Type-with-Draplin-Creating-Wordmarks-That-Work/1395825904?via=homepage',
     origin: 'https://www.skillshare.com',
     accept: 'application/json;pk=BCpkADawqM2OOcM6njnM7hf9EaK6lIFlqiXB0iWjqGWUQjU7R8965xUvIQNqdQbnDTLz0IAO7E6Ir2rIbXJtFdzrGtitoee0n1XXRliD-RH9A-svuvNW9qgo3Bh34HEZjXjG4Nml4iyz3KqF' } };

  request(options, function (error, response, body) {
    if (error) return cb(error);
    const sources = JSON.parse(body).sources;
    cb(null, sources.slice(-1)[0].src, sources[0].src)
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