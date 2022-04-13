# TRON HISTORY DOWNLOADER
## download an TRON account's balance history

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)

### Requirments
- docker (https://docs.docker.com/engine/install/)
- nodejs (https://nodejs.org/en/download/)
- yarn (`npm install yarn`)

### Usage

- To start the download run `yarn start <accountname>`. This will beging the download into the local postgres database. once the download is complete you can use a tool like tablePlus, psql, dbeaver to connect to the db at localhost:5432.

### Notes
- New tron blocks are published on average every 3 seconds. The downloader makes the rather naive assumption that each day will contain 28800 ledgers which is not always the case. if you need you more fine grain balance data you can decrease this value to whatever you want.