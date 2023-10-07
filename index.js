/*
  index.js
  Manages Testu.
*/

// ########## IMPORTS

// Module to keep secrets local.
require('dotenv').config();
// Module to access files.
const fs = require('fs/promises');
// Module to create an HTTP server and client.
const http = require('http');
// Module to create an HTTPS server and client.
const https = require('https');
// Module to handle Testaro jobs.
const {batch} = require('testilo/batch');
// URL of testu for users.
process.env.APP_URL ??= 'http://localhost:3008/testu';
// URL for Testilo to use as the value of sources.sendReportTo in jobs.
process.env.REPORT_URL = `${process.env.APP_URL}/api/report`;
// Functions from Testilo.
const {merge} = require('testilo/merge');
const {scorer} = require('testilo/procs/score/tsp36');
const {score} = require('testilo/score');
const {digest} = require('testilo/digest');
const {digester} = require('testilo/procs/digest/tdp36/index');
// Script object.
const script = require('./scripts/ts36a.json');

// ########## CONSTANTS

const protocol = process.env.PROTOCOL || 'http';
const jobs = {
  todo: {},
  assigned: {}
};
const reportProperties = [
  'id',
  'what',
  'strict',
  'timeLimit',
  'acts',
  'sources',
  'creationTime',
  'timeStamp',
  'jobData'
];
const resultStreams = {};

// ########## FUNCTIONS

// Serves an error message.
const serveError = async (error, response) => {
  console.log(error.message);
  if (! response.writableEnded) {
    response.statusCode = 400;
    const errorTemplate = await fs.readFile('error.html', 'utf8');
    const errorPage = errorTemplate.replace(/__error__/, error);
    response.end(errorPage);
  }
};
// Serves a digest.
const serveDigest = async (id, response) => {
  try {
    const digest = await fs.readFile(`reports/${id}.html`, 'utf8');
    response.end(digest);
  }
  catch(error) {
    await serveError(error, response);
  }
};
// Serves an object as a JSON file.
const serveObject = (object, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(object));
};
// Handles a request.
const requestHandler = async (request, response) => {
  const {method} = request;
  // Get its URL.
  const requestURL = request.url;
  // If the URL ends with a slash:
  if (requestURL.endsWith('/')) {
    // Redirect the client permanently.
    response.writeHead(301, {'Location': requestURL.slice(0, -1)});
    response.end();
  }
  // Otherwise, if the request is a GET request:
  else if (method === 'GET') {
    // If it is for the stylesheet:
    if (requestURL === '/testu/style.css') {
      // Serve it.
      const styleSheet = await fs.readFile('style.css', 'utf8');
      response.end(styleSheet);
    }
    // Otherwise, if it is for a script:
    else if (requestURL === '/testu/script') {
      // Serve it.
      const script = await fs.readFile('script.js', 'utf8');
      response.end(script);
    }
    else if (requestURL === '/testu/result') {
      // Serve it.
      const script = await fs.readFile('result.js', 'utf8');
      response.end(script);
    }
    // Otherwise, if it is for the application icon:
    else if (requestURL === '/favicon.ico') {
      // Serve nothing.
      response.end('');
    }
    // Otherwise, if it is for the request form:
    else if (['/testu', '/testu/index.html'].includes(requestURL)) {
      // Serve it, leaving the connection open for the result to be added.
      const formPage = await fs.readFile(`index.html`, 'utf8');
      response.setHeader('Content-Location', '/testu');
      response.end(formPage);
    }
    // Otherwise, i.e. if it is any other GET request:
    else {
      // Get the query paramaters of the request.
      const requestQuery = requestURL.replace(/^[^?]+\??/, '');
      const requestPath = requestURL.replace(/\?.*/, '');
      const queryParams = new URLSearchParams(requestQuery);
      // If there are any (size property requires Node v. 19):
      if (Array.from(queryParams.keys()).length) {
        // If the request is from a testing agent for a job to do:
        if (requestPath === '/testu/api/job') {
          // If the agent is authorized:
          const agent = queryParams.get('agent');
          if (agent && ['TXRIWin', 'RIWSMac', 'PoolMac'].includes(agent)) {
            console.log(`Job request received from agent ${agent}`);
            // If there are any jobs to be assigned:
            if (Object.keys(jobs.todo).length) {
              // Choose the first-created job not yet assigned.
              const jobIDs = Object.keys(jobs.todo);
              const firstJobID = jobIDs.reduce(
                (first, current) => current < first ? current : first
              );
              // Assign it to the agent.
              const job = jobs.todo[firstJobID];
              serveObject(job, response);
              jobs.assigned[firstJobID] = job;
              delete jobs.todo[firstJobID];
              console.log(`Job ${firstJobID} assigned to agent ${agent}`);
              // Notify the requester.
              resultStreams[firstJobID].write(`data: Job assigned to Testaro agent ${agent}.\n\n`);
            }
            // Otherwise, i.e. if there are no jobs to be assigned:
            else {
              // Notify the agent.
              serveObject({
                message: `No network job at ${protocol}://${request.headers.host} to do`
              }, response);
            }
          }
          // Otherwise, i.e. if the agent is not authorized:
          else {
            // Report this.
            console.log(`ERROR: Job request made by unauthorized agent ${agent}`);
          }
        }
        // Otherwise, i.e. if the request requires a jobID parameter:
        else {
          // Get the job ID.
          const jobID = queryParams.get('jobID');
          // If none was specified:
          if (! jobID) {
            // Report this to the requester.
            const message = 'ERROR: No job ID specified';
            console.log(message);
            await serveError(message, response);
          }
          // Otherwise, i.e. if a job ID was specified:
          else {
            // If the request is for a digest:
            if (requestPath === '/testu/digest') {
              // Serve the digest if it exists.
              await serveDigest(jobID, response);
            }
            // Otherwise, if it is from the result page for a result stream:
            else if (requestPath === '/testu/status') {
              console.log('Result stream requested');
              // Prepare the stream.
              response.setHeader('Content-Type', 'text/event-stream');
              response.setHeader('Cache-Control', 'no-cache');
              response.setHeader('Connection', 'keep-alive');
              // Save the stream for future use.
              resultStreams[jobID] = response;
              // Send an initial message.
              response.write('data: Job received.\n\n');
            }
            // Otherwise, i.e. if it is an invalid request with a job ID.
            else {
              // Report this to the requester.
              const message = 'ERROR: Invalid request with job ID';
              console.log(message);
              await serveError(message, response);
            }
          }
        }
      }
      // Otherwise, i.e. if no query parameters were specified:
      else {
        const message = 'ERROR: No query parameters specified';
        console.log(message);
        await serveError(message, response);
      }
    }
  }
  // Otherwise, if the request is a POST request:
  else if (method === 'POST') {
    const bodyParts = [];
    request.on('error', async err => {
      await serveError(err, response);
    })
    .on('data', chunk => {
      bodyParts.push(chunk);
    })
    // When the request has arrived:
    .on('end', async () => {
      // If the request is from a user for a job to be performed:
      if (requestURL === '/testu/result.html') {
        // Get a query string from the request body.
        const queryString = Buffer.concat(bodyParts).toString();
        // Parse it as an array of key-value pairs.
        const requestParams = new URLSearchParams(queryString);
        // Convert it to an object with string- or array-valued properties.
        const requestData = {};
        requestParams.forEach((value, name) => {
          requestData[name] = value;
        });
        // If the request is valid:
        if (
          requestData.pageURL
          && requestData.pageURL.startsWith('http')
          && requestData.pageWhat
        ){
          // Convert it to a Testaro job.
          const jobBatch = batch(
            'testuList', '1 target', [['target', requestData.pageWhat, requestData.pageURL]]
          );
          const job = merge(script, jobBatch, null, true)[0];
          // Add it to the jobs to be done.
          jobs.todo[job.id] = job;
          // Serve a result page to the requester.
          const resultTemplate = await fs.readFile('result.html', 'utf8');
          const resultPage = resultTemplate
          .replace('__pageWhat__', requestData.pageWhat)
          .replace('__pageURL__', requestData.pageURL)
          .replace(/__jobID__/g, job.id);
          response.setHeader('Content-Location', '/testu/result.html');
          response.end(resultPage);
        }
        // Otherwise, i.e. if the request is invalid:
        else {
          // Report this to the requester.
          const message = 'ERROR: invalid request';
          console.log(message);
          await serveError(message, response);
        }
      }
      // Otherwise, if the request is a job report from a testing agent:
      else if (requestURL === '/testu/api/report') {
        // If the report is valid:
        const reportJSON = Buffer.concat(bodyParts).toString();
        // Process the report.
        try {
          // If it is valid:
          const report = JSON.parse(reportJSON);
          if (report && reportProperties.every(propertyName => Object.hasOwn(report, propertyName))) {
            // Send an acknowledgement to the agent.
            serveObject({
              message: `Report ${report.id} received and validated`
            }, response);
            console.log(`Valid report ${report.id} received from agent ${report.jobData.agent}`);
            // Notify the requester.
            const {id} = report;
            resultStreams[id].write('data: Report received from Testaro.\n\n');
            // Score and save it.
            await fs.mkdir('reports', {recursive: true});
            score(scorer, [report]);
            await fs.writeFile(`reports/${report.id}.json`, `${JSON.stringify(report, null, 2)}\n`);
            // Notify the requester.
            resultStreams[id].write('data: Report scored.\n\n');
            // Digest it and save the digest.
            const digests = await digest(digester, [report]);
            const jobDigest = Object.values(digests)[0];
            await fs.writeFile(`reports/${report.id}.html`, jobDigest);
            // Notify the requester.
            const digestURL = `${process.env.APP_URL}/digest?jobID=${id}`;
            resultStreams[id].write(
              `data: Report digested. <a href="${digestURL}">Get the digest</a>.\n\n`
            );
            // Close the event source for the requester.
            resultStreams[id].end();
          }
          // Otherwise, i.e. if the report is invalid:
          else {
            // Report this.
            console.log(`ERROR: Invalid job report received from agent `);
            serveObject({
              message: `Report received, but it was invalid`
            }, response);
          }
        }
        // If the processing fails:
        catch(error) {
          // Report this.
          const message = 'ERROR: Report processing failed';
          console.log(`${message} (${error.message})`);
        }
      }
    });
  }
  // Otherwise, i.e. if it uses another method:
  else {
    // Report this.
    console.log(`ERROR: Request with prohibited method ${method} received`);
  }
};
// ########## SERVER
const serve = (protocolModule, options) => {
  const server = protocolModule.createServer(options, requestHandler);
  const port = process.env.PORT || '3008';
  server.listen(port, () => {
    console.log(`Testu server listening at ${protocol}://localhost:${port}.`);
  });
};
if (protocol === 'http') {
  serve(http, {});
}
else if (protocol === 'https') {
  globals.fs.readFile(process.env.KEY, 'utf8')
  .then(
    key => {
      globals.fs.readFile(process.env.CERT, 'utf8')
      .then(
        cert => {
          serve(https, {key, cert});
        },
        error => console.log(error.message)
      );
    },
    error => console.log(error.message)
  );
}
