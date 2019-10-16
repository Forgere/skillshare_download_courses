const request = require("request");
const async = require('async');
const fs = require("fs");
const path = require('path');
const agent = require('superagent');
const cheerio = require('cheerio');
const { argv } = require('yargs');
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

// htmllink是h5播放器链接  m3u8link是默认的m3u8资源
function dealWithVideoDownload(htmllink, m3u8link, cb){
  console.log(`可直接观看`)
  var options = { method: 'GET',
    url: m3u8link,
    headers: 
    { 'postman-token': '493b22bc-6d97-b826-58d3-74f452d726c0',
      'cache-control': 'no-cache' } };

  const desUrl = path.join(__dirname, `./m3u8link.m3u8`);
  request(options)
    .pipe(fs.createWriteStream(desUrl))
    .on('finish', () => {
      fs.readFile(desUrl, (err, buffer) => {
        const str = buffer.toString()
        const match = str.match(new RegExp(/URI="([\W\w^"]*?.m3u8[\W\w^"]*?)"/));
        const video = str.match(/RESOLUTION=1280[\w\W]*?(http:[\w\W]*?)#EXT/)
        cb(null, match[1], video[1]);
      })
    })
}

// 处理m3u8文件
function dealWithMainM3U8(ttyurl, videourl, callback){
  async.parallel([
    (cb) => {
      dealWithM3U8(ttyurl, cb)
    },
    (cb) => {
      dealWithM3U8(videourl, cb)
    },
  ], (err, res) => {
    if (err) return callback(err)
    downloadFiles(res, callback)
  })
}

// 下载字幕 和 视频
function downloadFiles(arr, callback){

  function action(type, arr,cb){
    console.log(`下载${type}`);
    async.parallel(arr.map((url,index) => (cb) => {
      const ttyPath = path.join(__dirname, `./${type+index}.${type==='字幕' ? 'tty': 'mp4'}`);
      const fileExist = fs.existsSync(ttyPath)
      request.get(url)
        .pipe(fs.createWriteStream(ttyPath))
        .on('finish', () => {
          console.log(`${type}${index}`)
          cb(null, ttyPath)
        })
    }), (err, res) => {
      if(err) return cb(err);
      console.log(`${type}下载完成`)
      cb(null, res)
    })
  }

  function action2(type, arr,cb){
    console.log(`下载${type}`);
    async.parallel(arr.map((url,index) => (cb) => {
      const ttyPath = path.join(__dirname, `./${type}${index}.${type==='字幕' ? 'tty': 'mp4'}`);
      console.log(`${type}${index}`)
      request.get(url)
        .pipe(fs.createWriteStream(ttyPath))
        .on('close', () => {
          console.log(`${type}${index}`)
          cb(null, ttyPath)
        })
    }), (err, res) => {
      if(err) return cb(err);
      console.log(`${type}下载完成`)
      cb(null, res)
    })
  }

  async.parallel([
    (cb) => {
      action('字幕', arr[0] ,cb)
    },
    (cb) => {
      action2('视频', arr[1], cb)
    }
  ], (err,res) => {
    if (err) return callback(err)
    callback(null, res)
  })
}

function dealWithM3U8(url, cb) {
  request.get(url)
    .pipe(fs.createWriteStream(path.join(__dirname, `./master.m3u8`)))
    .on('finish', () => {
      fs.readFile(path.join(__dirname, `./master.m3u8`), (err, buffer) => {
        if (err) return cb(err);
        const str = buffer.toString();
        const match = str.match(/(http[\W\w]*?)[\n]/g)
        cb(null, match);
      })
    })
}

main(url, defaultUrl);
