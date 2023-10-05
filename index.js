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
process.env.REPORT_URL ??= 'http://localhost:3008/testu/api/report';
const {merge} = require('testilo/merge');
const {scorer} = require('testilo/procs/score/tsp36');
const {score} = require('testilo/score');
const {digest} = require('testilo/digest');
const {digester} = require('testilo/procs/digest/tdp36/index');
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

// ########## FUNCTIONS

// Serves the result page.
const serveResult = async (requestParams, result, isEnd, response) => {
  let resultPage = await fs.readFile('result.html', 'utf8');
  Object.keys(requestParams).forEach(paramName => {
    const paramRegEx = new RegEx(`__${paramName}__`, 'g');
    resultPage = resultPage.replace(paramRegEx, params[paramName]);
  });
  resultPage = resultPage.replace('__result__', result);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Location', 'result.html');
  response.write(resultPage);
  if (isEnd) {
    response.end();
  }
};
// Serves an error message.
const serveError = async (error, response) => {
  console.log(error.message);
  if (! response.writableEnded) {
    response.statusCode = 400;
    await serveResult({
      pageURL: 'N/A',
      pageWhat: 'N/A'
    }, error.message, true, response);
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
  // Get its URL, without any trailing slash.
  const requestURL = request.url.replace(/\/$/, '');
  // If the request is a GET request:
  if (method === 'GET') {
    // If it is for the stylesheet:
    if (requestURL === '/testu/style.css') {
      // Serve it.
      const styleSheet = await fs.readFile('style.css', 'utf8');
      response.end(styleSheet);
    }
    // Otherwise, if it is for the script:
    else if (requestURL === '/testu/script') {
      // Serve it.
      const script = await fs.readFile('script.js', 'utf8');
      response.end(script);
    }
    // Otherwise, if it is for the application icon:
    else if (requestURL === '/favicon.ico') {
      // Serve nothing.
      response.end('');
    }
    // Otherwise, if it is for the request form:
    else if (['/testu', '/testu/index.html'].some(suffix => requestURL.endsWith(suffix))) {
      // Serve it.
      const formPage = await fs.readFile(`index.html`, 'utf8');
      response.end(formPage);    
    }
    // Otherwise, if it is from a testing agent for a job to do:
    else if (requestURL.startsWith('/testu/api/job')) {
      // If the agent is authorized:
      const requestQuery = requestURL.replace(/^[^?]+/, '');
      const queryParams = new URLSearchParams(requestQuery);
      const agent = queryParams.get('agent');
      if (['TXRIWin', 'RIWSMac', 'PoolMac'].includes(agent)) {
        // If there are any jobs to be assigned:
        if (Object.keys(jobs.todo).length) {
          // Choose the first-created job not yet assigned.
          const jobTimeStamps = Object.keys(jobs.todo);
          const firstTimeStamp = jobTimeStamps.reduce(
            (first, current) => current < first ? current : first
          );
          // Assign it to the agent.
          const {job} = jobs.todo[firstTimeStamp];
          serveObject(job, response);
          jobs.assigned[firstTimeStamp] = job;
          delete jobs.todo[firstTimeStamp];
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
    // Otherwise, if it is for a digest:
    else if (requestURL.startsWith('/testu/report/') && requestURL.endsWith('.html')) {
      // Serve the digest.
      await serveDigest(requestURL.slice(14, -5), response);
    }
    // Otherwise, if it is any other GET request:
    else {
      // Report this.
      console.log('ERROR: Invalid GET request received');
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
      // Initialize the request data.
      const requestData = {};
      // Get a query string from the request body.
      const queryString = Buffer.concat(bodyParts).toString();
      // Parse it as an array of key-value pairs.
      const requestParams = new URLSearchParams(queryString);
      // Convert it to an object with string or array-valued properties.
      requestParams.forEach((value, name) => {
        requestData[name] = value;
      });
      // If the request is from a user for a job to be performed:
      if (requestURL === '/testu') {
        // If the request is valid:
        if (
          requestData.pageURL
          && requestData.pageURL.startsWith('http')
          && requestData.pageWhat
        ){
          // Convert it to a Testaro job.
          const timeStamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
          const jobBatch = batch(
            'testuList', '1 target', [['target', requestData.pageWhat, requestData.pageURL]]
          );
          const job = merge(script, jobBatch, null, true)[0];
          jobs.todo[timeStamp] = {
            job,
            response
          };
        }
      }
      // Otherwise, if the request is a job report from a testing agent:
      else if (requestURL === '/testu/api/report') {
        // If the report is valid:
        const {report} = requestData;
        if (report && reportProperties.every(propertyName => Object.hasOwn(report, propertyName))) {
          // Send an acknowledgement to the agent.
          response.end({
            message: `Report ${report.id} received and validated`
          });
          // Score and save it.
          await fs.mkdir('reports', {recursive: true});
          score(scorer, [report]);
          await fs.writeFile(`reports/${report.id}.json`, `${JSON.stringify(report, null, 2)}\n`);
          // Digest it and save the digest.
          const digests = await digest(digester, [[report]]);
          await fs.writeFile(`reports/${report.id}.html`, digests[0]);
          // Notify the requester that the digest is ready to retrieve.
          const jobResponse = jobs.assigned[report.timeStamp].response;
          const requestParams = {
            pageURL: report.sources.target.which,
            pageWhat: report.sources.target.what
          };
          const result = `<p><a href="${appURL}/report/${report.id}.html">Digest ${report.id}</a> is complete and ready to retrieve.</p>`;
          await serveResult(requestParams, result, true, jobResponse);
        }
        // Otherwise, i.e. if the report is invalid:
        else {
          // Report this.
          console.log(`ERROR: Invalid job report received from agent `);
          response.end({
            message: `Report received, but it was invalid`
          });
        }
      }
    });
  }
  // Otherwise, i.e. if it uses another method:
  else {
    // Report this.
    console.log(`ERROR: Request with method ${method} received`);
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
