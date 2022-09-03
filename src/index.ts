import { AddressInfo, WebSocketServer } from 'ws'
import fs from 'fs'
import path from 'path'
import express from 'express'

const app = express();

app.use(express.static('public'));

const expressServer = app.listen(3000, () => {
  const address = expressServer.address() as AddressInfo;
  console.log(`express listening on port ${address.port}`);
})

const kibibyte = 1024;
const mebibyte = 1024 * 1024;
const defaultChunkSize = Math.floor(mebibyte * 0.1);

const server = new WebSocketServer({ port: 3001 }, () => {
  const address = server.address() as AddressInfo;
  console.log(`websocketserver listening on port ${address.port}`);
});

// function getMp4Codecs(filePath: string): [any] {
//   const buffer = fs.readFileSync(filePath);
//   return muxjs.mp4.probe.tracks(buffer)
// }

function readFileChunk(filePath: string, position: number, chunkSize: number) {
  const fileSize = fs.statSync(filePath).size;
  if (position > (fileSize - 1)) {
    return null;
  }
  if (position + chunkSize > fileSize) {
    chunkSize = fileSize - position;
  }
  const buffer = Buffer.allocUnsafe(chunkSize);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, { length: chunkSize, offset: 0, position: position })
  fs.closeSync(fd);

  return buffer;
}

server.on('connection', async (client, req) => {
  console.log(`connection established with ${(req.socket.address() as AddressInfo).address}`);

  client.on('message', async (data: string) => {
    const msg = JSON.parse(data);
    console.log('received message', msg);

    switch (msg.type) {
      case 'video_info': {
        if (!msg.filePath) {
          break;
        }

        const filePath = path.resolve('./assets/videos/', msg.filePath);
        if (!filePath) {
          break;
        }

        const fileSize = fs.statSync(filePath).size;

        client.send(JSON.stringify({
          type: msg.type,
          filePath: msg.filePath,
          fileSize: fileSize
        }));
        break;
      }
      case 'video': {
        if (!msg.filePath) {
          break;
        }
        const filePath = path.resolve('./assets/videos/', msg.filePath);
        const start = msg.start ?? 0;
        const size = msg.size ?? defaultChunkSize;

        const buffer = readFileChunk(filePath, start, size);
        if (!buffer) {
          break;
        }
        const data = buffer.toJSON().data;

        client.send(JSON.stringify({
          type: msg.type,
          filePath: msg.filePath,
          start: start,
          end: start + data.length,
          data: data
        }));
        break;
      }
      // case 'codecs': {
      //   const filePath = path.resolve('./assets/videos/', msg.filePath);
      //   const codecs = getMp4Codecs(filePath);
      //   client.send(JSON.stringify({
      //     type: 'codecs',
      //     filePath: msg.filePath,
      //     codecs: codecs
      //   }));
      //   break;
      // }
    }
  });
});