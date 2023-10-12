# testu
Ask Testaro to test a web page for accessibility

## Introduction

## Deployment

Instructions for deploying Testu on an AWS EC2 server with an Ubuntu image, derived in part from [Digital Ocean documentation on Node](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04), [on Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04), and [on Certbot](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04).

- Create an instance on AWS with Ubuntu OS, t2-micro type, 30GiB SSD storage.
- Connect to it in the AWS Console.
- Create directory `/opt/apps`.
- Change group of `apps` to `ubuntu`.
- Change group permission on `apps` to add write.
- Do not install `git`, because it is already installed.
- Install `nodejs` per `https://github.com/nodesource/distributions#nodejs`.
- Install `build-essential` (`sudo apt-get install build-essential`).
- With `/opt/apps` as the working directory, clone `testu`.
- Create an `.npmrc` file in `/home/ubuntu` with:
    - `//registry.npmjs.org/:_username=…`
    - //`registry.npmjs.org/:_authToken=npm_…`
- Change its mode so only the user can read or write.
- Delete its `package-lock.json` file to avoid the password bug.
- Install its dependencies (`npm install`).
- Check it with `node index` inside `/opt/apps/testu`, then `^C` to quit.
- Install PM2 (`sudo npm install -g pm2@latest`).
- Get an elastic IP address and associate it with the instance.
- Get a domain name for the site and make it point to the site by giving it 2 DNS records:
    - An `A` record with host `@`, value equal to the elastic IP address, and automatic TTL.
    - A `CNAME` record with host `www`, value equal to the domain name, and TTL 30 minutes.
- Reboot the instance (`sudo shutdown -r now`).
- Upgrade packages (`sudo apt-get upgrade`).
- Start the application with watching with PM2 (`pm2 start /opt/apps/testu/index.js --name testu --watch`).
- Configure PM2 to restart `testu` when the server is rebooted (`pm2 startup systemd` plus the additional statement returned by that statement).
- Save the PM2 process list and environments (`pm2 save`).
- Try to start PM2 (`sudo systemctl start pm2-ubuntu`).
- It will fail, so reboot the server (`sudo shutdown -r now`) and wait about 2 minutes.
- Connect to the server again with `ssh`.
- Start PM2 (`sudo systemctl start pm2-ubuntu`).
- Update the package lists (`sudo apt update`).
- If the output says that packages can be upgraded, do that (`sudo apt upgrade`).
- If the output recommends rebooting, do that (`sudo shutdown -r now`) and wait about 2 minutes, and then repeat the update and upgrade commands. If the output says some packages are obsolete, remove them (`sudo apt autoremove`).
- Install Nginx (`sudo apt-get install nginx`).
- Check that Nginx is running and reachable with HTTP by browsing to the site domain name (e.g., `testaro.tools`).
- If you want to customize the default page that Nginx will serve when Testu is not available, edit the file at `/var/www/html/index.nginx-debian.html`.
- Create a directory for Testu (`sudo mkdir -p /var/www/testu/html`);
- Install Certbot (`sudo apt install certbot python3-certbot-nginx`).
-
