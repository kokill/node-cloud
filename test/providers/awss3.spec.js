'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const restler = require('restler');
const BPromise = require('bluebird');
const fs = BPromise.promisifyAll(require('fs'));
const path = require('path');
const AWS = require('../../providers/awss3.provider')({
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              region: process.env.AWS_REGION
            });

// NOTE: These tests aren't just stubs. They actually save files to aws, and
// retrieve them.

describe('AWSS3', function() {
  this.timeout(20000);
  let sandbox, bucket = process.env.S3_BUCKET;
  let filepath, saveFilepath;
  let downloadReadStream;
  let key, copyKey, content;
  let signedURL, signedURLResp;

  beforeEach(function(done) {
    sandbox = sinon.sandbox.create();
    done();
  });

  afterEach(function(done) {
    sandbox.restore();
    done();
  });

  before(function(done) {
    // Create the key with a random number so that tests being run at the same
    // time won't cause problems.
    key = 'demo' + Math.floor(Math.random() * 10000) + '.txt';
    filepath = path.resolve(__dirname, '../assets/demo.txt');
    saveFilepath = path.resolve(__dirname, '../assets/download.txt');

    const readFile = BPromise.promisify(fs.readFile, {multiArgs: true});

    return readFile(filepath, 'utf8')
      .then(function(data) {
        content = data;
        return AWS.uploadFile(bucket, key, filepath)
      }).then(function(data) {
        return AWS.downloadFile(bucket, key, saveFilepath);
      }).then(function() {
        downloadReadStream = fs.createReadStream(saveFilepath);
        return AWS.getFileUrl(bucket, key);
      }).then(function(url) {
        restler.get(url)
          .on('complete', function(resp){
            signedURLResp = resp;
            return AWS.deleteFile(bucket, key)
              .then(function(data) {
                done();
              });
          });
      }).catch(function(err) {
        console.log(err);
      });
  });

  it('dowloaded stream is readable', function(done) {
    downloadReadStream.on('readable', function() {
      done();
    });
  });

  it('original file matches file downloaded from s3', function(done) {
    fs.readFile(saveFilepath, 'utf8', function(err, downloadedContent) {
      if(err) {
        console.log(err);
      } else {
        expect(downloadedContent).to.be.eql(content);
        done();
      }
    });
  });

  it('getSignedURL provides link to file', function(done) {
    expect(content).to.be.eql(signedURLResp);
    done();
  });
});
