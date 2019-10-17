var ffmpeg = require('fluent-ffmpeg');
const async = require('async');
const fs = require("fs");
const path = require('path');
const vtt2srt = require('node-vtt-to-srt');
const request = require("request");
const child_process = require('child_process');

let dist, name;

function concatMp4(arr, filename, callback) {
  var listFileName = path.join(__dirname, `../dist/${name}list.txt`),
    fileNames = '';
  // ffmpeg -f concat -i mylist.txt -c copy output
  arr.forEach(function(fileName, index) {
    fileNames = fileNames + `file '${fileName}'\n`;
  });

  fs.writeFileSync(listFileName, fileNames);

  var merge = ffmpeg();
  // ffmpeg -i VIDEO\ 1\ Class\ Trailer\ \ \ Draft\ 8\ BA\ FINAL.mp4 -vf subtitles=VIDEO\ 1\ Class\ Trailer\ \ \ Draft\ 8\ BA\ FINAL.srt 1.mp4
  merge
    .input(listFileName)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions([
      '-c copy',
    ])
    .save(path.join(__dirname, '../dist/a.mp4'))
    .on('end', function() {
      child_process.exec(`ffmpeg -i dist/a.mp4 -vf subtitles=dist/a.srt "${filename}"`, (err) => {
        if (err) return callback(err);
        callback(null, '完成添加字幕');
      })
    });
}

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
      fs.writeFile(path.join(__dirname, '../dist/list.vtt'), res.join('\n').split(/X-TIMESTAMP-MAP[\w\W]*?\n/).join('\n'), (err) => {
        if (err) return callback(err);
        fs.createReadStream(path.join(__dirname, '../dist/list.vtt'))
          .pipe(vtt2srt())
          .pipe(fs.createWriteStream(path.join(__dirname, '../dist/a.srt')))
        console.log('字幕完成合并');
        callback(null, '合并完成字幕')
      })
    }
  )
}

function action(type, array, cb) {
  console.log(`下载${type}`);
  async.parallel(
    array.map((url, index) => cb => {
      const ttyPath = path.join(
        __dirname,
        `../dist/${name}${type}${index}.${type === '字幕' ? 'vtt' : 'mp4'}`
      );
      request
        .get(url)
        .pipe(fs.createWriteStream(ttyPath))
        .on('close', () => {
          cb(null, ttyPath);
        })
    }),
    (err, res) => {
      if (err) return cb(err);
      console.log(`${type}下载完成`);
      const exsit = fs.existsSync(`${dist}`);
      if (!exsit) fs.mkdirSync(`${dist}`)
      if (type === '视频') {
        concatMp4(res, `${dist}/${name}.mp4`, cb);
      } else {
        concatTty(res, `${dist}/${name}`, cb)
      }
    }
  );
}

// 下载字幕 和 视频
function downloadFiles(arr, callback) {
  async.parallel(
    [
      cb => {
        action('字幕', arr[1], cb);
      },
      cb => {
        action('视频', arr[0], cb);
      },
    ],
    (err, res) => {
      if (err) return callback(err);
      callback(null, res);
    }
  );
}

// 处理m3u8文件
function dealWithMainM3U8(ttyurl, videourl, callback) {
  async.series(
    [
      cb => {
        dealWithM3U8(videourl, cb);
      },
      cb => {
        dealWithM3U8(ttyurl, cb);
      },
    ],
    (err, res) => {
      if (err) return callback(err);
      callback(null, res);
    }
  );
}

function dealWithM3U8(url, cb) {
  request
    .get(url)
    .pipe(fs.createWriteStream(path.join(__dirname, `../dist/${name}master.m3u8`)))
    .on('finish', () => {
      fs.readFile(
        path.join(__dirname, `../dist/${name}master.m3u8`),
        (err, buffer) => {
          if (err) return cb(err);
          const str = buffer.toString();
          const match = str.match(/(http[\W\w]*?)[\n]/g);
          cb(null, match);
        }
      );
    });
}

// htmllink是h5播放器链接  m3u8link是默认的m3u8资源
function dealWithVideoDownload(htmllink, m3u8link, cb) {
  console.log(`可直接观看`);
  var options = {
    method: 'GET',
    url: m3u8link,
    headers: {
      'postman-token': '493b22bc-6d97-b826-58d3-74f452d726c0',
      'cache-control': 'no-cache',
    },
  };
  const exist = fs.existsSync(path.join(__dirname, '../dist'));
  if (!exist) {
    fs.mkdirSync(path.join(__dirname, '../dist'));
  }
  const desUrl = path.join(__dirname, `../dist/${name}.m3u8`);
  request(options)
    .pipe(fs.createWriteStream(desUrl))
    .on('finish', () => {
      fs.readFile(desUrl, (err, buffer) => {
        const str = buffer.toString();
        const match = str.match(
          new RegExp(/URI="([\W\w^"]*?.m3u8[\W\w^"]*?)"/)
        );
        const video = str.match(/RESOLUTION=(1280|1024)[\w\W]*?(http:[\w\W]*?)#EXT/);

        cb(null, match[1], video[2]);
      });
    });
}

// 主页面进入之后 根据账户 视频 返回的信息， 拿到sources
function dealWithVideoPage(accountId, videoId, cb) {
  const videoUrl = `https://edge.api.brightcove.com/playback/v1/accounts/${accountId}/videos/${videoId}`;
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

function downVideo(accountId, videoId, diststr, cb) {
  dist = diststr
  async.waterfall(
    [
      cb => {
        dealWithVideoPage(accountId, videoId, cb);
      },
      (htmllink, m3u8link, cb) => {
        dealWithVideoDownload(htmllink, m3u8link, cb);
      },
      (url, video, cb) => {
        console.log("准备下载字幕 视频")
        dealWithMainM3U8(url, video, cb);
      },
      (res, cb) => {
        console.log("开始下载字幕 视频")
        downloadFiles(res, cb)
      }
    ],
    (err, result) => {
      if(err) return cb(err)
      child_process.exec(`rm -rf ${path.join(__dirname, '../dist')}`, () => {
        cb(null, result)
      })
    }
  );
}

module.exports.downVideo = downVideo
