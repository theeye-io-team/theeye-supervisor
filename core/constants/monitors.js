"use strict";

const RESOURCE_FAILURE = 'failure';
const RESOURCE_NORMAL = 'normal';
const RESOURCE_STOPPED = 'updates_stopped';
const RESOURCE_RECOVERED = 'recovered';
const AGENT_STOPPED = 'agent_stopped';

const FAILURE_STATES = ['error','fail','failure'];
const SUCCESS_STATES = ['success','ok','normal'];

exports.SUCCESS_STATES = SUCCESS_STATES;
exports.FAILURE_STATES = FAILURE_STATES;

exports.RESOURCE_FAILURE = RESOURCE_FAILURE;
exports.RESOURCE_NORMAL = RESOURCE_NORMAL;
exports.RESOURCE_STOPPED = RESOURCE_STOPPED;
exports.RESOURCE_RECOVERED = RESOURCE_RECOVERED;
exports.AGENT_STOPPED = AGENT_STOPPED;
exports.RESOURCE_TYPE_DSTAT = 'dstat';
exports.RESOURCE_TYPE_PSAUX = 'psaux';
exports.RESOURCE_TYPE_SCRIPT = 'script';
exports.RESOURCE_TYPE_PROCESS = 'process';
exports.RESOURCE_TYPE_SCRAPER = 'scraper';
