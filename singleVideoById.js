const { argv } = require('yargs');
const child_process = require('child_process')
const path = require('path')
const request = require('request')
const url = argv._[0];
const converter = require("node-m3u8-to-mp4");
const wr = child_process.fork('src/downVideo.js');
const {dealWithVideoDownload} = require('./src/downVideo')

// https://edge.api.brightcove.com/playback/v1/accounts/3695997568001/videos/5485882300001

const videoUrl = url
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
  const sources = JSON.parse(body).sources;
  converter(sources[0].src,"a.mp4").then(() => {
    console.log("finished");
    });
});