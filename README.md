# testu
Ask Testaro to test a web page for accessibility

## Introduction

## Deployment

Instructions for deploying Testu on an Amazon Web Services (AWS) EC2 server with an Ubuntu image, derived in part from [Digital Ocean documentation on Node](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04), [on Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04), and [on Certbot](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04).
1. Create an instance on AWS with the Ubuntu operating system, `t2-micro` type, and 30GiB non-encrypted SSD storage.
1. Connect to it in the AWS Console.
1. Do not install `git`, because it is already installed.
1. Install `nodejs` per `https://github.com/nodesource/distributions#installation-instructions`.
1. Install `build-essential` (`sudo apt-get install build-essential`).
1. Install PM2 (`sudo npm install -g pm2@latest`).
1. Configure PM2 to restart `testu` when the server is rebooted (`pm2 startup systemd` plus the additional statement returned by that statement).
1. Save the PM2 process list and environments (`pm2 save`).
1. Try to start PM2 (`sudo systemctl start pm2-ubuntu`).
1. It will fail, so reboot the server (`sudo shutdown -r now`) and wait about 2 minutes.
1. Connect to the server again with `ssh`.
1. Start PM2 (`sudo systemctl start pm2-ubuntu`).
1. Get an elastic IP address from AWS and associate it with the instance.
1. Get a domain name for the site. The domain name obtained for this site was `testaro.tools`.
1. Make the domain name point to the site by giving it 2 DNS records:
    - An `A` record with host `@`, value equal to the elastic IP address, and automatic TTL.
    - A `CNAME` record with host `www`, value `testaro.tools`, and TTL 30 minutes.
1. Reboot the instance (`sudo shutdown -r now`).
1. Upgrade packages (`sudo apt-get upgrade`).
1. Update the package lists (`sudo apt update`).
1. If the output says that packages can be upgraded, do that (`sudo apt upgrade`).
1. If the output recommends rebooting, do that (`sudo shutdown -r now`) and wait about 2 minutes, and then repeat the update and upgrade commands. If the output says some packages are obsolete, remove them (`sudo apt autoremove`).
1. Install Nginx (`sudo apt-get install nginx`).
1. Check that Nginx is running and reachable with HTTP by browsing to the server domain name (`testaro.tools`).
1. Customize the fall-back page that Nginx will serve when Testu is not available by editing the file at `/var/www/html/index.nginx-debian.html`.
1. Verify that the revision worked by navigating again to the same URL.
1. Create directories for the main site and web page (`sudo mkdir -p /var/www/testaro.tools/html`).
1. Make `ubuntu` their owner and group (`sudo chown ubuntu:ubuntu /var/www/testaro.tools /var/www/testaro.tools/html`);
1. Copy the fall-back page of the server, making it the main web page (`cp /var/www/html/index.nginx-debian.html /var/www/testaro.tools/html/index.html`).
1. Edit it to make it the main page of the site, containing a link to run Testu, with the destination being `https://testaro.tools/testu`.
1. Create a configuration block file for the `testaro.tools` site named `/etc/nginx/sites-available/testaro.tools`. Give it this content:

    ```bash
    server {
      listen 80;
      listen [::]:80;
      root /var/www/testaro.tools/html;
      index index.html;
      server_name testaro.tools www.testaro.tools;
      location / {
        try_files $uri $uri/ =404;
      }
    }
    ```

1. Adjust the Nginx configuration to allow multiple sites by removing the `#` on the `server_names_hash_bucket_size 64;` line in the `/etc/nginx/nginx.conf` file.
1. Check the above work (`sudo nginx -t`).
1. Restart Nginx (`sudo systemctl restart nginx`).
1. Verify the above work by navigating to the site (`http://testaro.tools`) with a browser.
1. Create a symbolic link to the configuration block file where Nginx will find it (`sudo ln -s /etc/nginx/sites-available/testaro.tools /etc/nginx/sites-enabled/`).
1. Install Certbot (`sudo apt install certbot python3-certbot-nginx`).
1. Get an SSL certificate (`sudo certbot --nginx -d testaro.tools -d www.testaro.tools`). Doing this revises the `/etc/nginx/sites-available/testaro.tools` file that you created, making Nginx permanently redirect any requests for `http://testaro.tools` to `https://testaro.tools`.
1. Check the automatic certificate renewal process (`sudo systemctl status certbot.timer`).
1. Test that process (`sudo certbot renew --dry-run`).
1. With `/var/www` as the working directory, clone `testu` (`sudo git clone https://github.com/jrpool/testu.git`).
1. Change the owner and group of the `testu` directory and all subdirectories and files in it to `ubuntu` (`sudo chown -R ubuntu:ubuntu /var/www/testu`).
1. Make `git` accept `ubuntu` as the owner of the `testu` directory (`git config --global --add safe.directory /var/www/testu`).
1. Add a `.env` file to the `/var/www/testu` directory, containing these environment variables:
    ```bash
    APP_URL=https://testaro.tools/testu
    PROTOCOL=http
    REQUESTER=demo@testaro.tools
    ```
1. Create an `.npmrc` file in `/home/ubuntu` with:
    - `//registry.npmjs.org/:_username=…`
    - //`registry.npmjs.org/:_authToken=npm_…`
1. Change its mode so only the user can read or write.
1. Delete the `package-lock.json` file in `/var/www/testu` to avoid the password bug.
1. With `/var/www/testu` as the working directory, install the Testu dependencies (`npm install`).
1. Check Testu with `node index`, then `^C` to quit.
1. Use PM2 to start Testu with watching (`pm2 start index.js --name testu --watch`).
1. Edit `/etc/nginx/sites-available` (previously revised by Certbot), to make Nginx hand HTTPS `testu` requests to the `testu` application on port 3008, as HTTP requests. Specifically, add a second `location` block immediately before or after the existing one (the order does not matter, because Nginx chooses the location with the longest matching prefix, and `/testu` is longer than `/`). The new `location` block is:

    ```bash
    location /testu {
      proxy_pass http://localhost:3008;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection '';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }
    ```

1. Reload Nginx to use this configuration (`sudo systemctl reload nginx`).
1. Test Nginx as a reverse proxy and Testu by navigating to:
- `https://testaro.tools`
- `http://testaro.tools`
- `https://testaro.tools/testu`
- `http://testaro.tools/testu`
