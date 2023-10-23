# testu
Ask Testaro to test a web page for accessibility

## Introduction

Testu is a web-based demonstration user interface for ensemble testing of web accessibility. It uses [Testaro](https://www.npmjs.com/package/testaro) and [Testilo](https://www.npmjs.com/package/testilo) to perform and report tests of a web page.

The purpose of Testu is to allow users to experience the functionalities of Testaro and Testilo with minimal effort. Users identify a web page to be tested, and Testu does everything else.

## Architecture

An application that uses Testaro and Testilo to test and report the accessibility of a web page must choose how to handle the time that elapses from the user’s request to the delivery of results. That time is typically 3 minutes, but can be double that when the page being tested is complex, large, or slow.

One strategy is to acknowledge the request immediately and send the user a message when the work is complete, with a link to a document containing results.

Another strategy is to keep the web connection open and give incremental updates to the user describing progress, with the final update providing the results or a link to the results.

Testu adopts this second strategy, so it has no need to collect messaging addresses from users and transmit non-web messages. Testu uses server-sent events in order to provide the updates.

Testilo is a dependency of Testu. Testu uses Testilo to prepare jobs for Testaro and to convert Testaro reports into web-based human-oriented digests.

Testaro is not a dependency of Testu. Testaro is installed on one or more workstations. Each instance of Testaro watches for jobs from the server deploying Tustu. More precisely, the Testaro instance periodically contacts the server to ask whether the server has a job for Testaro to perform. When a user asks Testu to test a web page, Testu creates a job and assigns it to the next Testaro instance that asks for a job. While the Testaro instance works on the job, Testaro sends updates to Testu, which Testu converts into server-sent events and forwards to the user agent. When Testaro finishes the job, Testaro sends its report to the server, which uses Testilo to further process the report and create a web-based digest. Testu then completes its response to the user agent with a link to the digest, which in turn contains a link to the full JSON report.

## Deployment

One deployment of Testu is described here.

Testu was deployed on an Amazon Web Services (AWS) EC2 server with an Ubuntu image. The deployment process was based, in part, on [Digital Ocean documentation on Node](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04), [on Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04), and [on Certbot](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04). The process was as follows:
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
1. Add an `.env` file to the `/var/www/testu` directory, containing these environment variables (replacing `abc+xyz` with a `+`-delimited list of authorized testing agent IDs and replacing `ts…` with a script ID such as `ts99`):

    ```bash
    APP_URL=https://testaro.tools/testu
    PROTOCOL=http
    REQUESTER=demo@testaro.tools
    AGENTS=abc+xyz
    SCRIPT=ts…
    REJECT_UNAUTHORIZED=true
    ```

1. Create an `.npmrc` file in `/home/ubuntu` with your username and authorization token for NPM replacing “…”:
    - `//registry.npmjs.org/:_username=…`
    - //`registry.npmjs.org/:_authToken=npm_…`
1. Change its mode so only the user can read or write.
1. Delete the `package-lock.json` file in `/var/www/testu` to avoid the password bug.
1. With `/var/www/testu` as the working directory, install the Testu dependencies (`npm install`).
1. Check Testu with `node index`, then `^C` to quit.
1. Use PM2 to start Testu without watching (`pm2 start index.js --name testu`). Watching is convenient for development, but it ruins the operation of Testu, because it restarts Testu whenever Testu writes a file. So, when you make changes to the code, you will need to restart PM2 (`pm2 restart testu`).
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

## Configuration

To allow testing of pages whose SSL certificates are self-signed or have unrecognized certificate authorities, you can change the value of `REJECT_UNAUTHORIZED` in the `.env` file to `false`.

Testu must accept job requests from at least one Testaro agent. The list of accepted agents is a `+`-delimited string that is the value of `AGENTS` in the `.env` file.

The job that Testu submits to Testaro is derived from a Testilo script located in the `scripts` directory. The script selected for jobs is the one identified by `SCRIPT` in the `.env` file.
