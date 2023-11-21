/*
  rescore.js
  Revises the scores and digests of Testaro reports.
*/

// ########## IMPORTS

// Module to keep secrets local.
require('dotenv').config();
// Module to access files.
const fs = require('fs/promises');
// Functions from Testilo.
const {score} = require('testilo/score');
const {scorer} = require('testilo/procs/score/tsp38');
const {digest} = require('testilo/digest');
const {digester} = require('testilo/procs/digest/tdp38/index');

// ########## FUNCTIONS

// Handles a request.
const rescore = async () => {
  // Get the report filenames.
  const reportFileNames = await fs.readdir('reports');
  // For each report:
  await fs.mkdir('reports/rescored', {recursive: true});
  const reportIDs = reportFileNames
  .filter(fileName => fileName.endsWith('.json'))
  .map(fileName => fileName.slice(0, -5));
  for (const reportID of reportIDs) {
    // Get it.
    const reportJSON = await fs.readFile(`reports/${reportID}.json`);
    const report = JSON.parse(reportJSON);
    // Rescore and save it.
    score(scorer, [report]);
    await fs.writeFile(`reports/rescored/${reportID}.json`, `${JSON.stringify(report, null, 2)}\n`);
    // Digest it and save the digest.
    const digests = await digest(digester, [report]);
    const jobDigest = Object.values(digests)[0];
    await fs.writeFile(`reports/rescored/${reportID}.html`, jobDigest);
  };
};
rescore();
