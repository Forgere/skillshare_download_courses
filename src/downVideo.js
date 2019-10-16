function concatMp4(arr, filename, callback) {
  var listFileName = path.join(__dirname, '../dist/list.txt'),
    fileNames = '';
  // ffmpeg -f concat -i mylist.txt -c copy output
  arr.forEach(function(fileName, index) {
    fileNames = fileNames + `file '${fileName}'\n`;
  });

  fs.writeFileSync(listFileName, fileNames);

  var merge = ffmpeg();
  merge
    .input(listFileName)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions('-c copy')
    .save(filename)
    .on('end', function() {
      console.log('完成合并');
      callback(null, 'finish merge');
    });
}

function action(type, array, cb) {
  console.log(`下载${type}`);
  async.parallel(
    array.map((url, index) => cb => {
      const ttyPath = path.join(
        __dirname,
        `../dist/${type}${index}.${type === '字幕' ? 'tty' : 'mp4'}`
      );
      request
        .get(url)
        .pipe(fs.createWriteStream(ttyPath))
        .on('close', () => {
          cb(null, ttyPath);
        });
    }),
    (err, res) => {
      if (err) return cb(err);
      console.log(`${type}下载完成`);
      if (type === '视频') {
        concatMp4(res, path.join(__dirname, '../dist/output.mp4'), cb);
      } else {
        cb(null, res);
      }
    }
  );
}

// 下载字幕 和 视频
function downloadFiles(arr, callback) {
  async.parallel(
    [
      cb => {
        action('字幕', arr[0], cb);
      },
      cb => {
        action('视频', arr[1], cb);
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
  async.parallel(
    [
      cb => {
        dealWithM3U8(ttyurl, cb);
      },
      cb => {
        dealWithM3U8(videourl, cb);
      },
    ],
    (err, res) => {
      if (err) return callback(err);
      downloadFiles(res, callback);
    }
  );
}

function dealWithM3U8(url, cb) {
  request
    .get(url)
    .pipe(fs.createWriteStream(path.join(__dirname, `../dist/master.m3u8`)))
    .on('finish', () => {
      fs.readFile(path.join(__dirname, `../dist/master.m3u8`), (err, buffer) => {
        if (err) return cb(err);
        const str = buffer.toString();
        const match = str.match(/(http[\W\w]*?)[\n]/g);
        cb(null, match);
      });
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
    const exist = fs.existsSync(path.join(__dirname, './dist'));
    if (!exist) {
      fs.mkdirSync(path.join(__dirname, './dist'))
    }
    const desUrl = path.join(__dirname, `./dist/m3u8link.m3u8`);
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
