var ffmpeg = require('fluent-ffmpeg');
const async = require('async');
const fs = require("fs");
const path = require('path');
const vtt2srt = require('node-vtt-to-srt');
const request = require("request");
const child_process = require('child_process');

let dist, name, randomDirection;

function concatTty(arr, fileName, callback) {
  async.series(
    arr.map((path) => cb => {
      fs.readFile(path, (err, buffer) => {
        if (err) return cb(err)
        cb(null, buffer.toString())
      })
    }),
    (err, res) => {
      if (err) return callback(err)
      fs.writeFile(path.join(__dirname, `../${randomDirection}/list.vtt`), res.join('\n').split(/X-TIMESTAMP-MAP[\w\W]*?\n/).join('\n'), (err) => {
        if (err) return callback(err);
        fs.createReadStream(path.join(__dirname, `../${randomDirection}/list.vtt`))
          .pipe(vtt2srt())
          .pipe(fs.createWriteStream(path.join(__dirname, `../${randomDirection}/a.srt`)))
        console.log('info: 字幕完成合并');
        callback(null, 'info: 合并完成字幕')
      })
    }
  )
}

function action(type, array, cb) {
  async.parallelLimit(
    array.map((url, index) => cb => {
      const ttyPath = path.join(
        __dirname,
        `../${randomDirection}/${name}${type}${index}.${type === '字幕' ? 'vtt' : 'mp4'}`
      );
      const req = request
        .get(url)
      req.pipe(fs.createWriteStream(ttyPath))
        .on('close', () => {
          cb(null, ttyPath);
        })
    }),
    (err, res) => {
      if (err) return cb(err);
      console.log(`info: ${type}下载完成`);
      const exsit = fs.existsSync(`${dist}`);
      if (!exsit) fs.mkdirSync(`${dist}`)
      if (type === '视频') {
        concatMp4(res, `${dist}/${name}.mp4`, cb);
      } else {
        concatTty(res, `${dist}/${name}`, cb)
      }
    }
  ,4);
}

// 下载字幕 和 视频
function downloadFiles(arr, callback) {
  console.log('info: 开始下载字幕')
  async.mapLimit(arr, 4, (url,cb) => {
    const index = arr.findIndex(item => item === url)
    const ttyPath = path.join(
      __dirname,
      `../${randomDirection}/${name}字幕${index}.srt}`
    );
    console.log(`${name}字幕${index}`)
    const req = request
      .get(url)
    req.pipe(fs.createWriteStream(ttyPath))
      .on('close', () => {
        cb(null, ttyPath);
      })
  },(err, res) => {
    if (err) return cb(err);
    console.log(`info: 字幕下载完成`);
    const exsit = fs.existsSync(`${dist}`);
    if (!exsit) fs.mkdirSync(`${dist}`)
    concatTty(res, `${dist}/${name}`, callback)
  })
}

// 处理m3u8文件
function dealWithMainM3U8(ttyurl, videourl, callback) {
  async.series(
    [
      cb => {
        dealWithM3U8(ttyurl, (err, url) => {
          downloadFiles(url, cb)
        });
      },
      cb => {
        child_process.exec(`ffmpeg -i ${videourl}${ttyurl?' ':` -vf subtitles=${randomDirection}/a.srt`} -c copy -bsf:a aac_adtstoasc ${randomDirection}/a.mp4`, () => {
          cb()
        })
      },
    ],
    (err, res) => {
      if (err) return callback(err);
      console.log(`info: 开始合并`)
      child_process.exec(`ffmpeg -i ${randomDirection}/a.mp4 -vf subtitles=${randomDirection}/a.srt "${filename}"`, (err) => {
        if (err) return callback(err);
        callback(null, '完成添加字幕');
      })
    }
  );
}

function dealWithM3U8(url, cb) {
  if (!url) return cb()
  request
    .get(url)
    .pipe(fs.createWriteStream(path.join(__dirname, `../${randomDirection}/${name}master.m3u8`)))
    .on('finish', () => {
      fs.readFile(
        path.join(__dirname, `../${randomDirection}/${name}master.m3u8`),
        (err, buffer) => {
          if (err) return cb(err);
          const str = buffer.toString();
          const match = str.match(/(http[\W\w]*__)/g);
          cb(null, match);
        }
      );
    });
}

// htmllink是h5播放器链接  m3u8link是默认的m3u8资源
function dealWithVideoDownload(htmllink, m3u8link, cb) {
  var options = {
    method: 'GET',
    url: m3u8link,
    headers: {
      'postman-token': '493b22bc-6d97-b826-58d3-74f452d726c0',
      'cache-control': 'no-cache',
    },
  };
  const exist = fs.existsSync(path.join(__dirname, `../${randomDirection}`));
  if (!exist) {
    fs.mkdirSync(path.join(__dirname, `../${randomDirection}`));
  }
  const desUrl = path.join(__dirname, `../${randomDirection}/${name}.m3u8`);
  request(options)
    .pipe(fs.createWriteStream(desUrl))
    .on('finish', () => {
      fs.readFile(desUrl, (err, buffer) => {
        const str = buffer.toString();
        const match = str.match(
          new RegExp(/URI="([\W\w^"]*?.m3u8[\W\w^"]*?)"/)
        );
        const video = str.match(/RESOLUTION=(720|1024|1280)[\w\W]*?(http:[\w\W]*?)(#EXT|$)/);
        if(!match){
          console.log(options.url)
        }
        cb(null, match?match[1]:null, video[2]);
      });
    });
}

// 主页面进入之后 根据账户 视频 返回的信息， 拿到sources
function dealWithVideoPage(accountId, videoId, cb) {
  const videoUrl = `https://edge.api.brightcove.com/playback/v1/accounts/${accountId}/videos/${videoId}`;
  console.log(`info: 开始下载${videoUrl}`)
  var options = {
    method: 'GET',
    url: videoUrl,
    headers: {
      'postman-token': '43fded51-6506-e244-fb9d-bbd4a233ca86',
      'cache-control': 'no-cache',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      'sec-fetch-mode': 'cors',
      referer:
        'https://www.skillshare.com/classes/Customizing-Type-with-Draplin-Creating-Wordmarks-That-Work/1395825904?via=homepage',
      origin: 'https://www.skillshare.com',
      accept:
        'application/json;pk=BCpkADawqM2OOcM6njnM7hf9EaK6lIFlqiXB0iWjqGWUQjU7R8965xUvIQNqdQbnDTLz0IAO7E6Ir2rIbXJtFdzrGtitoee0n1XXRliD-RH9A-svuvNW9qgo3Bh34HEZjXjG4Nml4iyz3KqF',
    },
  };

  request(options, function(error, response, body) {
    if (error) return cb(error);
    const sources = JSON.parse(body).sources;
    name = JSON.parse(body).name;
    cb(null, sources.slice(-1)[0].src, sources[0].src);
  });
}

function downVideo(accountId, videoId, diststr, callback) {
  dist = diststr
  randomDirection = `${require('uuid/v4')()}${videoId}`
  console.log(`文件夹${randomDirection}`)
  async.waterfall(
    [
      cb => {
        dealWithVideoPage(accountId, videoId, cb);
      },
      (htmllink, m3u8link, cb) => {
        dealWithVideoDownload(htmllink, m3u8link, cb);
      },
      (url, video, cb) => {
        console.log("info: 准备字幕 视频资源")
        dealWithMainM3U8(url, video, cb);
      },
    ],
    (err, result) => {
      if(err) return callback(err)
      callback(null, result)

    }
  );
}

process.on('message', (res) => {
  downVideo(res[0], res[1], res[2], ()=> {})
})

module.exports.downVideo = downVideo
