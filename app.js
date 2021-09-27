/* eslint-disable no-unused-vars */
const fs = require('fs');
const morgan = require('morgan');
const mongoose = require('mongoose');
const http = require('http');
const schedule = require('node-schedule');
const socketPlugin = require('socket.io');

require('dotenv').config();

// create folder contain excel
if (!fs.existsSync('./fileExcel')) fs.mkdirSync('./fileExcel');

const { index, addProductsToStock } = require('./src/services/googleMail');

schedule.scheduleJob('* * * * *', async () => {
  await index();
  await addProductsToStock();
});

mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB_URL, {
  autoIndex: false,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
});
mongoose.connection.on('error', (err) => {
  if (err) {
    throw new Error(`Unable to connect to database: ${err.toString()}`);
  }
});

const app = require('./config/express');
const helpers = require('./src/helpers');
const cronJob = require('./src/cron-job');

const resetCheckScanProductTime = '00 00 15 * * *';

schedule.scheduleJob(resetCheckScanProductTime, (fireDate) => {
  cronJob.resetCheckScanProduct(fireDate);
});

const httpServer = http.createServer(app);
const socketIO = socketPlugin(httpServer, {
  pingTimeout: 900000,
  pingInterval: 25000,
});

global.socketIO = socketIO;
global.listSocketUser = { restaurantInfo: {}, socketId: {} };

global.socketIO.on('connection', (socket) => {
  socket.on('disconnect', () => {
    const restaurantId = global.listSocketUser.restaurantInfo[socket.id];
    delete global.listSocketUser.socketId[restaurantId];
    delete global.listSocketUser.restaurantInfo[socket.id];
  });

  socket.on('client-request-notification', ({ restaurantId }) => {
    global.listSocketUser.socketId[restaurantId] = socket.id;
    global.listSocketUser.restaurantInfo[socket.id] = restaurantId;
  });
});

if (process.env.NODE_ENV === 'production') {
  const dir = './logs';

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  app.use(morgan('combined', {
    stream: fs.createWriteStream(`${__dirname}/logs/access.log`, { flags: 'a' }),
  }));
} else {
  app.use(morgan('dev'));
}

const port = process.env.PORT || 8000;

const routes = require('./src/modules/v1.0/routes');

app.use('/api', routes);

const googleRoutes = require('./src/modules/v1.0/google/routes');

app.use('/auth/google', googleRoutes);

const { sendReport } = require('./src/modules/v1.0/profile/report/controllers');

sendReport();

httpServer.listen(port, (err) => {
  if (err) {
    throw new Error(`Unable to list to port: ${err.toString()}`);
  }
  // eslint-disable-next-line no-console
  console.info(`🚀 Server running on ${process.env.HOST}:${port}`);
});
