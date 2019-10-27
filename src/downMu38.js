const child_process = require('child_process')
const request = require('request')
const { argv } = require('yargs');
const {parse} = require('url')
const url = argv._[0];
const name = argv._[1];

function downM3u8(url,name="b",cb) {
    console.log(`${name}info: 开始下载视频`)
    console.log(`ffmpeg -i "${url}" -bsf:a aac_adtstoasc ${name}.mp4`)
    let cp = child_process.exec(`ffmpeg -i "${url}" -bsf:a aac_adtstoasc ${name}.mp4`, (error, stdout, stderr) => {
      cp.kill()
    })
}

function downMaster(url, name="b",cb){

    var options = { method: 'GET',
    url: url,
    headers: 
    { 'cache-control': 'no-cache',
    Connection: 'keep-alive',
    'Accept-Encoding': 'gzip, deflate',
    Host: parse(url).hostname,
    'Cache-Control': 'no-cache',
    Accept: '*/*',
    'User-Agent': 'PostmanRuntime/7.19.0' } };
  
  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    const m3u8 = JSON.stringify(body).match(/RESOLUTION=[\w\W]*?(index-[\w\W]*?)(\?)/)[1];
    const newUrl = url.replace('master.m3u8', m3u8)
    downM3u8(newUrl, name, cb)
  });
}


downMaster(url, name);