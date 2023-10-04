/*
  index.js
  Manages Testu.
*/

// ########## IMPORTS

// Module to keep secrets local.
require('dotenv').config();
// Module to access files.
globals.fs = require('fs/promises');
// Module to create an HTTP server and client.
const http = require('http');
// Module to create an HTTPS server and client.
const https = require('https');
// Module to handle Testaro jobs.
const testilo = require('testilo');

// ########## CONSTANTS

const jobs = {};

// ########## FUNCTIONS

// Serves the result page.
const serveResult = async (requestParams, result, isEnd, response) => {
  let resultPage = await fs.readFile('result.html', 'utf8');
  Object.keys(requestParams).forEach(paramName => {
    const paramRegEx = new RegEx(`__${paramName}__`, 'g');
    resultPage = resultPage.replace(paramRegEx, params[paramName]);
  });
  resultPage = resultPage.replace('__result__', result);)
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Location', 'result.html');
  response.write(resultPage);
  if (isEnd) {
    response.end();
  }
};
// Serves an error message.
const serveError = async (requestParams, error, response) => {
  console.log(error.message);
  if (! response.writableEnded) {
    response.statusCode = 400;
    await serveResult(requestParams, error.message, true, response);
  }
};
// Handles a request.
const requestHandler = async (request, response) => {
  const {method} = request;
  if (method === 'POST') {
    const bodyParts = [];
    request.on('error', async err => {
      const requestParams = {
        pageURL: 'N/A',
        pageWhat:'N/A'
      };
      await serveError(requestParams, err, response);
    })
    .on('data', chunk => {
      bodyParts.push(chunk);
    })
    // When the request has arrived:
    .on('end', () => {
      // Get its URL, without any trailing slash.
      const requestURL = request.url.replace(/\/$/, '');
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
          const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
          const batch = [[jobID, pageData.pageWhat, pageData.pageURL]];
          const script = await fs.readFile('testilo/scripts/tsp36.js');
          const job = testilo.merge(script, batch);
          jobs[timestamp] = job;
          // Acknowledge receipt.
          await serveResult()
        }
      }
      const pathParts = [pathName.slice(1, -1), Number.parseInt(pathName.slice(-1), 10)];
      if (
        pathName[0] === '/'
        && postPaths[pathParts[0]]
        && pathParts[1] >= postPaths[pathParts[0]][0]
        && pathParts[1] <= postPaths[pathParts[0]][1]
      ) {
        // Process the submission.
        require(`.${pathName}`).formHandler(globals, query, response);
      }
      // Otherwise, i.e. if the request is invalid:
      else {
        // Serve an error message.
        globals.serveMessage('ERROR: Form submission invalid.', response);
      }
    }
  });
};
// ########## SERVER
const serve = (protocolModule, options) => {
  const server = protocolModule.createServer(options, requestHandler);
  const port = process.env.PORT || '3000';
  server.listen(port, () => {
    console.log(`CAT server listening at ${protocol}://localhost:${port}.`);
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
