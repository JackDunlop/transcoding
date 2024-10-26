var createError = require('http-errors');
import express, { Request, Response, NextFunction } from 'express';
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
import dotenv from 'dotenv';

import usersRouter from './routes/users';
import uploadRouter from './routes/upload';
import transcodeRouter, { processMessages } from './routes/transcode';
import downloadRouter from './routes/download';
const cors = require('cors');
dotenv.config();

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());


app.use('/users', usersRouter);
app.use('/upload', uploadRouter);
app.use('/transcode', transcodeRouter); // Now transcodeRouter is a function
app.use('/download', downloadRouter);

// Start the message processing
processMessages();

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;



