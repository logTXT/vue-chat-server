import http from 'http';
import url from 'url';
import WebSocket from 'ws';
import config from './config/config';
import userModel from './model/user';
import msgModel from './model/msg';
import db from './mongodb/db';

const server = http.createServer( async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:8080");
  res.setHeader('Access-Control-Allow-Credentials', true);
  // 注意该项设置，不能只设置X-Requested-With，否则前端无法配置Content-Type等内容
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.setHeader("Content-Type", "application/json;charset=utf-8");
  if (req.method === 'GET' && reqUrl.pathname === '/user/isExist') {
    console.log('route isExist');
    let userDoc = await userModel.findOne({ userName: reqUrl.query.userName });
    console.log('userDoc: ', userDoc);
    if (userDoc) {
      res.write(JSON.stringify({
        code: 200,
        isExist: true,
        user: userDoc
      }));
    } else {
      let newJoinUser = await new userModel({userName: reqUrl.query.userName}).save();
      res.write(JSON.stringify({
        code: 200,
        isExist: false,
        user: newJoinUser
      }));
    }
  } else if (req.method === 'GET' && reqUrl.pathname === '/user/getUser') {
    console.log('route getUser');
    let userDoc = await userModel.findOne({ userName: reqUrl.query.userName });
    console.log('userDoc: ', userDoc);
    if (userDoc) {
      res.write(JSON.stringify({
        code: 200,
        user: userDoc
      }));
    } else {
      res.write(JSON.stringify({
        code: 300,
        msg: 'user not exist'
      }));
    }
  }
  // 注意这句！！！
  res.end();
});
const wss = new WebSocket.Server({
  server,
  // port: config.wsPort,
  path: config.wsPath
});

wss.on('connection', async (ws) => {
  console.log('server connection');
  try {
    let userDoc = await userModel.find();
    let msgDoc = await msgModel.find().populate('user');
    let data = {
      type: 'init',
      userList: userDoc,
      msgList: msgDoc
    }
    ws.send(JSON.stringify(data));
    ws.on('message', async (res) => {
      console.log(res);
      let obj = JSON.parse(res);
      let resData = {};
      if (obj.type === 'join') {
        console.log('received message join');
        let retUser = await userModel.find();
        resData = {
          type: 'join',
          userList: retUser
        }
      } else if (obj.type === 'msg') {
        console.log('received message msg');
        let retMsg = await new msgModel(obj.msg).save();
        let retMsgRef = await msgModel.findOne({ _id: retMsg._id }).populate('user');
        resData = {
          type: 'msg',
          msg: retMsgRef
        };
      }
      wss.clients.forEach((client) => {
        client.send(JSON.stringify(resData), (err) => {
          if (err) {
            console.log(`[SERVER ERROR]: ${ err }`);
          }
        });
      });
    });
  } catch (error) {
    console.log(error);
  }
});

server.listen(config.wsPort);
console.log('success listen port ' + config.wsPort);
