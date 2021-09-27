const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const app = express();

app.use(compression());
app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('./src/public'));

app.use('/', session({
  name: 'compass',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.DB_URL,
    ttl: 7 * 24 * 60 * 60,
  }),
}));

module.exports = app;
