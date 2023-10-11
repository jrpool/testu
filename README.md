# testu
Ask Testaro to test a web page for accessibility

## Introduction

Instructions for deploying Testu on an AWS EC2 server with an Ubuntu image:

Based largely on:
https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04

Create an instance on AWS with Ubuntu OS, t2-micro type, 30GiB SSD storage.

Connect to it.

create directory /opt/apps

Change group of apps to ubuntu.

Change group permission on apps to add write.

Do not install git, because it is already installed.

Install node per https://github.com/nodesource/distributions#nodejs

Install build-essential (sudo apt-get install build-essential)

With /opt/apps as the working directory, clone testu.

Create an .npmrc file in /home/ubuntu with:

	//registry.npmjs.org/:_username=…
	//registry.npmjs.org/:_authToken=npm_…

Change its mode so only the user can read or write.

Delete its package-lock.json file to prevent the password bug.

Install its dependencies (npm install).

Check it with “node index” inside /opt/apps/testu, then ^C to quit.

Install PM2 (sudo npm install -g pm2@latest).

Get an elastic IP address and associate it with the instance.

Reboot the instance (sudo shutdown -r).

Upgrade packages (sudo apt-get upgrade).

Start the application with watching with PM2 (pm2 start /opt/apps/testu/index.js --name testu --watch).

