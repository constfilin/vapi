#!/usr/bin/env node.

"use strict";

import path         from 'node:path';

import express      from 'express';
import ejs          from 'ejs';

import Server       from './Server';
import api          from './api/';

const web = async () => {
    const server = new Server();
    const app    = express();
    app.engine('ejs',(path,data,cb) => ejs.renderFile(path,data,cb));
    app.use(express.static(path.join(server.config.web.path,'static')));
    app.use(express.json({limit:'1mb'}));
    app.use(express.urlencoded({extended:true}));
    app.set('trust proxy','loopback');
    app.use("/api",api());
    app.listen(server.config.web.port,'localhost',() => {
        server.module_log(module.filename,0,`Started at port ${server.config.web.port} at log level ${server.config.web.loglevel}`);
    });
};

web();